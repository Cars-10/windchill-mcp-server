/**
 * @fileoverview ProdPlatformMgmt Agent - Token-Efficient MCP Tools for Windchill Options & Variants
 *
 * This agent provides comprehensive tools for managing Windchill Options & Variants (Product Platform
 * Management), optimized for LLM token efficiency.
 *
 * Features:
 * - Response format options (markdown/json)
 * - Detail levels (concise/detailed)
 * - Pagination with has_more, next_offset, total_count
 * - Character limit enforcement with truncation
 * - Tool annotations for MCP clients
 * - Comprehensive descriptions with usage examples
 *
 * **Note:** This domain requires Windchill Product Platform Management (Options & Variants) module.
 * Many operations are read-only in Windchill 13.0.2 OData.
 */

import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { logger } from '../config/logger.js';
import { ToolDefinition, ToolAnnotations } from '../types/common.js';
import {
  ResponseFormat,
  DetailLevel,
  StandardToolParams,
  STANDARD_LIST_SCHEMA_PROPS,
  FORMAT_SCHEMA_PROPS,
  buildListResponse,
  buildSingleItemResponse,
  buildErrorResponse,
  buildODataPagination,
  buildTextFilter,
  combineFilters,
  DEFAULT_LIMIT,
  MAX_LIMIT
} from '../utils/response-formatter.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default fields to include in concise option responses */
const OPTION_CONCISE_FIELDS = ['ID', 'Name', 'Description', 'OptionGroup', 'DisplayName'] as const;

/** Default fields to include in concise option set responses */
const OPTIONSET_CONCISE_FIELDS = ['ID', 'Name', 'Description', 'State', 'Container'] as const;

/** Default fields to include in concise choice responses */
const CHOICE_CONCISE_FIELDS = ['ID', 'Name', 'Description', 'DisplayName', 'Sequence'] as const;

/** Markdown column definitions for option tables */
const OPTION_MARKDOWN_COLUMNS = {
  Name: 'Name',
  DisplayName: 'Display Name',
  OptionGroup: 'Option Group',
  Description: 'Description'
};

/** Markdown column definitions for option set tables */
const OPTIONSET_MARKDOWN_COLUMNS = {
  Name: 'Name',
  Description: 'Description',
  State: 'State',
  Container: 'Container'
};

/** Markdown column definitions for choice tables */
const CHOICE_MARKDOWN_COLUMNS = {
  Name: 'Name',
  DisplayName: 'Display Name',
  Sequence: 'Sequence',
  Description: 'Description'
};

// ============================================================================
// TOOL ANNOTATIONS
// ============================================================================

const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

const WRITE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true
};

// ============================================================================
// PRODPLATFORMMGMT AGENT
// ============================================================================

/**
 * ProdPlatformMgmtAgent provides comprehensive tools for managing Windchill Options & Variants.
 *
 * All tools support:
 * - `response_format`: 'markdown' (default, token-efficient) or 'json' (complete)
 * - `detail_level`: 'concise' (default, essential fields) or 'detailed' (all fields)
 * - Pagination with `limit` and `offset` parameters
 *
 * @extends BaseAgent
 */
export class ProdPlatformMgmtAgent extends BaseAgent {
  protected agentName = 'prodplatformmgmt';

  protected tools: ToolDefinition[] = [
    // =========================================================================
    // PRIORITY 1: OPTION MANAGEMENT
    // =========================================================================

    {
      name: 'list_options',
      description: `List all options in the Windchill system or within a specific option pool.

**Parameters:**
- containerId: Container OID (product/library) to get options from
- name: Filter by option name (partial match with wildcard support)
- optionGroup: Filter by option group (exact match)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Display Name | Option Group | Description |
Pagination info with has_more and next_offset

**Returns (json):**
{ data: [...], pagination: { total, count, offset, limit, has_more, next_offset } }

**Examples:**
- List all: {}
- Filter by name: { "name": "Color*" }
- Filter by group: { "optionGroup": "Appearance" }
- From container: { "containerId": "OR:wt.pdmlink.PDMLinkProduct:12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID (product/library) to get options from'
          },
          name: {
            type: 'string',
            description: 'Filter by option name with optional wildcards (e.g., "Color*", "*Size*")'
          },
          optionGroup: {
            type: 'string',
            description: 'Filter by option group (exact match)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Options',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);
          const filters: string[] = [];

          if (params.name) {
            filters.push(buildTextFilter('Name', params.name));
          }

          if (params.optionGroup) {
            filters.push(`OptionGroup eq '${params.optionGroup}'`);
          }

          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          // If container specified, get options from that container's option pool
          const baseUrl = params.containerId
            ? `${apiEndpoints.containers}('${params.containerId}')/OptionPool/PTC.ProdPlatformMgmt.Option`
            : `${apiEndpoints.options}`;

          const response = await this.api.get(`${baseUrl}?${queryParams.toString()}`);

          return buildListResponse(response.data, params, {
            title: 'Options',
            conciseFields: OPTION_CONCISE_FIELDS,
            markdownColumns: OPTION_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list options',
            suggestion: 'Check container OID format. Ensure Options & Variants module is licensed.'
          });
        }
      }
    },

    {
      name: 'get_option',
      description: `Get detailed information for a specific option by ID.

**Parameters:**
- optionId (required): Option OID (e.g., "OR:wt.option.Option:12345")
- expand: Navigation properties to expand (e.g., "Choices,OptionGroup")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Option details with Name, DisplayName, OptionGroup, Description, and more based on detail_level.

**Examples:**
- Get option: { "optionId": "OR:wt.option.Option:12345" }
- With choices: { "optionId": "OR:wt.option.Option:12345", "expand": "Choices" }
- Detailed: { "optionId": "OR:wt.option.Option:12345", "detail_level": "detailed" }

**Error handling:**
- Not found: Returns error with suggestion to search first`,
      inputSchema: {
        type: 'object',
        properties: {
          optionId: {
            type: 'string',
            description: 'Option OID (e.g., "OR:wt.option.Option:12345")'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "Choices,OptionGroup")'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['optionId']
      },
      annotations: {
        title: 'Get Option Details',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();

          if (params.expand) {
            queryParams.append('$expand', String(params.expand));
          }

          const queryString = queryParams.toString();
          const url = queryString
            ? `${apiEndpoints.options}('${params.optionId}')?${queryString}`
            : `${apiEndpoints.options}('${params.optionId}')`;

          const response = await this.api.get(url);

          return buildSingleItemResponse(response.data, params, {
            title: `Option: ${response.data?.Name || params.optionId}`,
            conciseFields: OPTION_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get option',
            suggestion: 'Verify the option ID. Use list_options to find valid IDs.'
          });
        }
      }
    },

    {
      name: 'search_options',
      description: `Search for options by name or description with wildcard support.

**Supports wildcards:** Use "*" for pattern matching (e.g., "Color*", "*Size*", "*Option")

**Parameters:**
- query (required): Search query for option name or description
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Display Name | Option Group | Description |
Pagination info with has_more and next_offset

**Examples:**
- Search by name: { "query": "Color" }
- Wildcard search: { "query": "Size*" }
- Paginate: { "query": "Material", "offset": 20, "limit": 10 }`,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for option name or description (supports wildcards)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['query']
      },
      annotations: {
        title: 'Search Options',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          // Build filter for name OR description search
          const cleanQuery = params.query.replace(/\*/g, '');
          queryParams.append(
            '$filter',
            `(contains(Name,'${cleanQuery}') or contains(Description,'${cleanQuery}'))`
          );

          const response = await this.api.get(`${apiEndpoints.options}?${queryParams.toString()}`);

          return buildListResponse(response.data, params, {
            title: `Options Search: "${params.query}"`,
            conciseFields: OPTION_CONCISE_FIELDS,
            markdownColumns: OPTION_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search options',
            suggestion: 'Check search query syntax. Try simpler search terms.'
          });
        }
      }
    },

    {
      name: 'get_option_choices',
      description: `Get all choices available for a specific option.

**Parameters:**
- optionId (required): Option OID to get choices for
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Display Name | Sequence | Description |
Pagination info with has_more and next_offset

**Examples:**
- Get choices: { "optionId": "OR:wt.option.Option:12345" }
- Paginate: { "optionId": "OR:wt.option.Option:12345", "limit": 50 }`,
      inputSchema: {
        type: 'object',
        properties: {
          optionId: {
            type: 'string',
            description: 'Option OID to get choices for'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['optionId']
      },
      annotations: {
        title: 'Get Option Choices',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          const response = await this.api.get(
            `${apiEndpoints.options}('${params.optionId}')/Choices?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Choices for Option: ${params.optionId}`,
            conciseFields: CHOICE_CONCISE_FIELDS,
            markdownColumns: CHOICE_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get option choices',
            suggestion: 'Verify the option ID. Use list_options to find valid IDs.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 2: OPTION SET MANAGEMENT
    // =========================================================================

    {
      name: 'list_option_sets',
      description: `List all option sets in the Windchill system.

**Parameters:**
- containerId: Container OID to filter option sets by container
- name: Filter by option set name (partial match with wildcard support)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Description | State | Container |
Pagination info with has_more and next_offset

**Examples:**
- List all: {}
- Filter by name: { "name": "Vehicle*" }
- From container: { "containerId": "OR:wt.pdmlink.PDMLinkProduct:12345" }
- Paginate: { "offset": 20, "limit": 20 }`,
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID to filter option sets by container'
          },
          name: {
            type: 'string',
            description: 'Filter by option set name with optional wildcards'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Option Sets',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);
          const filters: string[] = [];

          if (params.name) {
            filters.push(buildTextFilter('Name', params.name));
          }

          if (params.containerId) {
            filters.push(`Container eq '${params.containerId}'`);
          }

          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(`${apiEndpoints.optionSets}?${queryParams.toString()}`);

          return buildListResponse(response.data, params, {
            title: 'Option Sets',
            conciseFields: OPTIONSET_CONCISE_FIELDS,
            markdownColumns: OPTIONSET_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list option sets',
            suggestion: 'Check container OID format. Ensure Options & Variants module is licensed.'
          });
        }
      }
    },

    {
      name: 'get_option_set',
      description: `Get detailed information for a specific option set by ID.

**Parameters:**
- optionSetId (required): Option set OID
- expand: Navigation properties to expand (e.g., "Options,AssignedObjects")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Option set details with Name, Description, State, Container, and more based on detail_level.

**Examples:**
- Get option set: { "optionSetId": "OR:wt.option.OptionSet:12345" }
- With options: { "optionSetId": "OR:wt.option.OptionSet:12345", "expand": "Options" }
- Detailed: { "optionSetId": "OR:wt.option.OptionSet:12345", "detail_level": "detailed" }

**Error handling:**
- Not found: Returns error with suggestion to search first`,
      inputSchema: {
        type: 'object',
        properties: {
          optionSetId: {
            type: 'string',
            description: 'Option set OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "Options,AssignedObjects")'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['optionSetId']
      },
      annotations: {
        title: 'Get Option Set Details',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();

          if (params.expand) {
            queryParams.append('$expand', String(params.expand));
          }

          const queryString = queryParams.toString();
          const url = queryString
            ? `${apiEndpoints.optionSets}('${params.optionSetId}')?${queryString}`
            : `${apiEndpoints.optionSets}('${params.optionSetId}')`;

          const response = await this.api.get(url);

          return buildSingleItemResponse(response.data, params, {
            title: `Option Set: ${response.data?.Name || params.optionSetId}`,
            conciseFields: OPTIONSET_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get option set',
            suggestion: 'Verify the option set ID. Use list_option_sets to find valid IDs.'
          });
        }
      }
    },

    {
      name: 'search_option_sets',
      description: `Search for option sets by name or description with wildcard support.

**Supports wildcards:** Use "*" for pattern matching (e.g., "Vehicle*", "*Config*")

**Parameters:**
- query (required): Search query for option set name or description
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Description | State | Container |
Pagination info with has_more and next_offset

**Examples:**
- Search by name: { "query": "Vehicle" }
- Wildcard search: { "query": "Config*" }
- Paginate: { "query": "Product", "offset": 10, "limit": 10 }`,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for option set name or description (supports wildcards)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['query']
      },
      annotations: {
        title: 'Search Option Sets',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          const cleanQuery = params.query.replace(/\*/g, '');
          queryParams.append(
            '$filter',
            `(contains(Name,'${cleanQuery}') or contains(Description,'${cleanQuery}'))`
          );

          const response = await this.api.get(`${apiEndpoints.optionSets}?${queryParams.toString()}`);

          return buildListResponse(response.data, params, {
            title: `Option Sets Search: "${params.query}"`,
            conciseFields: OPTIONSET_CONCISE_FIELDS,
            markdownColumns: OPTIONSET_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search option sets',
            suggestion: 'Check search query syntax. Try simpler search terms.'
          });
        }
      }
    },

    {
      name: 'get_option_set_assignments',
      description: `Get all objects (parts/documents) assigned to a specific option set.

**Parameters:**
- optionSetId (required): Option set OID
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of assigned objects (parts, documents) using this option set

**Examples:**
- Get assignments: { "optionSetId": "OR:wt.option.OptionSet:12345" }
- Paginate: { "optionSetId": "OR:wt.option.OptionSet:12345", "limit": 50 }`,
      inputSchema: {
        type: 'object',
        properties: {
          optionSetId: {
            type: 'string',
            description: 'Option set OID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['optionSetId']
      },
      annotations: {
        title: 'Get Option Set Assignments',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          const response = await this.api.get(
            `${apiEndpoints.optionSets}('${params.optionSetId}')/AssignedObjects?${queryParams.toString()}`
          );

          // Use generic columns for assigned objects (could be parts or documents)
          const assignmentColumns = {
            Number: 'Number',
            Name: 'Name',
            Type: 'Type',
            State: 'State'
          };

          return buildListResponse(response.data, params, {
            title: `Assignments for Option Set: ${params.optionSetId}`,
            conciseFields: ['Number', 'Name', 'Type', 'State', 'ID'],
            markdownColumns: assignmentColumns
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get option set assignments',
            suggestion: 'Verify the option set ID. Use list_option_sets to find valid IDs.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 3: CHOICE MANAGEMENT
    // =========================================================================

    {
      name: 'list_choices',
      description: `List all choices for options in an option pool or across the system.

**Parameters:**
- optionId: Filter by specific option OID (optional)
- name: Filter by choice name (partial match with wildcard support)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Display Name | Sequence | Description |
Pagination info with has_more and next_offset

**Examples:**
- List all: {}
- Filter by option: { "optionId": "OR:wt.option.Option:12345" }
- Filter by name: { "name": "Red*" }
- Combined: { "optionId": "OR:wt.option.Option:12345", "name": "Large" }`,
      inputSchema: {
        type: 'object',
        properties: {
          optionId: {
            type: 'string',
            description: 'Filter by specific option OID'
          },
          name: {
            type: 'string',
            description: 'Filter by choice name with optional wildcards'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Choices',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);
          const filters: string[] = [];

          if (params.name) {
            filters.push(buildTextFilter('Name', params.name));
          }

          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          // If option specified, get choices from that option
          const baseUrl = params.optionId
            ? `${apiEndpoints.options}('${params.optionId}')/Choices`
            : `${apiEndpoints.prodPlatform}/Choices`;

          const response = await this.api.get(`${baseUrl}?${queryParams.toString()}`);

          const title = params.optionId
            ? `Choices for Option: ${params.optionId}`
            : 'Choices';

          return buildListResponse(response.data, params, {
            title,
            conciseFields: CHOICE_CONCISE_FIELDS,
            markdownColumns: CHOICE_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list choices',
            suggestion: 'Check option OID format if filtering by option.'
          });
        }
      }
    },

    {
      name: 'get_choice',
      description: `Get detailed information for a specific choice by ID.

**Parameters:**
- choiceId (required): Choice OID
- expand: Navigation properties to expand
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Choice details with Name, DisplayName, Sequence, Description, and more based on detail_level.

**Examples:**
- Get choice: { "choiceId": "OR:wt.option.Choice:12345" }
- Detailed: { "choiceId": "OR:wt.option.Choice:12345", "detail_level": "detailed" }

**Error handling:**
- Not found: Returns error with suggestion to list choices first`,
      inputSchema: {
        type: 'object',
        properties: {
          choiceId: {
            type: 'string',
            description: 'Choice OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['choiceId']
      },
      annotations: {
        title: 'Get Choice Details',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();

          if (params.expand) {
            queryParams.append('$expand', String(params.expand));
          }

          const queryString = queryParams.toString();
          const url = queryString
            ? `${apiEndpoints.prodPlatform}/Choices('${params.choiceId}')?${queryString}`
            : `${apiEndpoints.prodPlatform}/Choices('${params.choiceId}')`;

          const response = await this.api.get(url);

          return buildSingleItemResponse(response.data, params, {
            title: `Choice: ${response.data?.Name || params.choiceId}`,
            conciseFields: CHOICE_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get choice',
            suggestion: 'Verify the choice ID. Use list_choices to find valid IDs.'
          });
        }
      }
    },

    {
      name: 'search_choices',
      description: `Search for choices by name or description with wildcard support.

**Supports wildcards:** Use "*" for pattern matching (e.g., "Red*", "*Blue*")

**Parameters:**
- query (required): Search query for choice name or description
- optionId: Filter by specific option OID (optional)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Display Name | Sequence | Description |
Pagination info with has_more and next_offset

**Examples:**
- Search all: { "query": "Red" }
- Within option: { "query": "Large", "optionId": "OR:wt.option.Option:12345" }
- Wildcard: { "query": "*Blue*" }`,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for choice name or description (supports wildcards)'
          },
          optionId: {
            type: 'string',
            description: 'Filter by specific option OID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['query']
      },
      annotations: {
        title: 'Search Choices',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          const cleanQuery = params.query.replace(/\*/g, '');
          queryParams.append(
            '$filter',
            `(contains(Name,'${cleanQuery}') or contains(Description,'${cleanQuery}'))`
          );

          const baseUrl = params.optionId
            ? `${apiEndpoints.options}('${params.optionId}')/Choices`
            : `${apiEndpoints.prodPlatform}/Choices`;

          const response = await this.api.get(`${baseUrl}?${queryParams.toString()}`);

          const title = params.optionId
            ? `Choices Search: "${params.query}" (Option: ${params.optionId})`
            : `Choices Search: "${params.query}"`;

          return buildListResponse(response.data, params, {
            title,
            conciseFields: CHOICE_CONCISE_FIELDS,
            markdownColumns: CHOICE_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search choices',
            suggestion: 'Check search query syntax. Try simpler search terms.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 4: VARIANT CONFIGURATION
    // =========================================================================

    {
      name: 'get_variant_expression',
      description: `Get the variant expression for a configurable part or document.

**EXPERIMENTAL:** This feature may not work in all Windchill versions.

**Parameters:**
- objectId (required): Part or document OID
- objectType (required): Object type ('Part' or 'Document')
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Variant expression configuration for the specified object

**Examples:**
- Get part expression: { "objectId": "VR:wt.part.WTPart:12345", "objectType": "Part" }
- Get document expression: { "objectId": "VR:wt.doc.WTDocument:12345", "objectType": "Document" }

**Error handling:**
- Not configurable: Returns error if object has no variant expression
- Not found: Returns error with suggestion to verify object ID`,
      inputSchema: {
        type: 'object',
        properties: {
          objectId: {
            type: 'string',
            description: 'Part or document OID'
          },
          objectType: {
            type: 'string',
            description: 'Object type',
            enum: ['Part', 'Document']
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['objectId', 'objectType']
      },
      annotations: {
        title: 'Get Variant Expression (EXPERIMENTAL)',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const endpoint = params.objectType === 'Part'
            ? `${apiEndpoints.parts}('${params.objectId}')/VariantExpression`
            : `${apiEndpoints.documents}('${params.objectId}')/VariantExpression`;

          const response = await this.api.get(endpoint);

          return buildSingleItemResponse(response.data, params, {
            title: `Variant Expression: ${params.objectId}`,
            conciseFields: ['Expression', 'IsValid', 'Options', 'Choices']
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get variant expression',
            suggestion: 'Verify the object ID and ensure it has variant configuration. Not all objects support variant expressions.'
          });
        }
      }
    },

    {
      name: 'validate_variant_expression',
      description: `Validate a variant expression against an option pool.

**EXPERIMENTAL:** This feature requires custom API support and may not work in all Windchill versions.

**Parameters:**
- expression (required): Variant expression to validate (e.g., "Color=Red AND Size=Large")
- containerId (required): Container OID (product/library) with option pool
- response_format: 'markdown' (default) or 'json'

**Returns:** Validation result indicating if expression is valid

**Examples:**
- Simple: { "expression": "Color=Red", "containerId": "OR:wt.pdmlink.PDMLinkProduct:12345" }
- Complex: { "expression": "Color=Red AND Size=Large", "containerId": "OR:wt.pdmlink.PDMLinkProduct:12345" }

**Error handling:**
- Invalid expression: Returns validation errors
- Missing options: Returns which options/choices are not found`,
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Variant expression to validate (e.g., "Color=Red AND Size=Large")'
          },
          containerId: {
            type: 'string',
            description: 'Container OID (product/library) with option pool'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['expression', 'containerId']
      },
      annotations: {
        title: 'Validate Variant Expression (EXPERIMENTAL)',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          // Note: This may require a custom POST endpoint for validation
          // Standard OData may not support this operation
          const response = await this.api.post(
            `${apiEndpoints.containers}('${params.containerId}')/ValidateVariantExpression`,
            {
              expression: params.expression
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Validation Result: ${params.expression.substring(0, 30)}...`,
            conciseFields: ['IsValid', 'Errors', 'Warnings', 'MissingOptions']
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'validate variant expression',
            suggestion: 'This endpoint may require custom Windchill configuration. Check if ValidateVariantExpression action is available.'
          });
        }
      }
    }
  ];
}
