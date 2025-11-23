/**
 * @fileoverview NavCriteria Agent - Token-Efficient MCP Tools for Windchill Navigation Criteria
 *
 * This agent provides tools for managing BOM navigation criteria and structure filters
 * in the Windchill PLM system, optimized for LLM token efficiency.
 *
 * Features:
 * - Response format options (markdown/json)
 * - Detail levels (concise/detailed)
 * - Pagination with has_more, next_offset, total_count
 * - Character limit enforcement with truncation
 * - Tool annotations for MCP clients
 * - Comprehensive descriptions with usage examples
 *
 * **Note:** Navigation Criteria are used to filter BOM structures based on various rules
 * such as lifecycle state, effectivity, or custom attributes. This domain is typically
 * read-only in Windchill 13.0.2 OData.
 */

import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolDefinition, ToolAnnotations } from '../types/common.js';
import {
  ResponseFormat,
  STANDARD_LIST_SCHEMA_PROPS,
  FORMAT_SCHEMA_PROPS,
  buildListResponse,
  buildSingleItemResponse,
  buildErrorResponse,
  buildODataPagination,
  combineFilters,
  DEFAULT_LIMIT,
  MAX_LIMIT
} from '../utils/response-formatter.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Concise fields for navigation criteria */
const CRITERIA_CONCISE_FIELDS = ['ID', 'Name', 'FilterType', 'Description', 'Container'] as const;

/** Markdown column definitions for navigation criteria tables */
const CRITERIA_MARKDOWN_COLUMNS = {
  Name: 'Name',
  FilterType: 'Filter Type',
  Description: 'Description',
  Container: 'Container'
};

/** Concise fields for filter expression responses */
const FILTER_EXPRESSION_FIELDS = ['ID', 'Expression', 'Type', 'Name'] as const;

/** Markdown columns for filter expressions */
const FILTER_EXPRESSION_COLUMNS = {
  Name: 'Name',
  Type: 'Type',
  Expression: 'Expression'
};

// ============================================================================
// TOOL ANNOTATIONS
// ============================================================================

/** All navigation criteria tools are read-only */
const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

// ============================================================================
// NAVCRITERIA AGENT
// ============================================================================

/**
 * NavCriteriaAgent provides tools for managing BOM navigation criteria and structure filters.
 *
 * All tools support:
 * - `response_format`: 'markdown' (default, token-efficient) or 'json' (complete)
 * - `detail_level`: 'concise' (default, essential fields) or 'detailed' (all fields)
 * - Pagination with `limit` and `offset` parameters
 *
 * Navigation criteria are used to filter how part structures (BOMs) are viewed and navigated.
 *
 * @extends BaseAgent
 */
export class NavCriteriaAgent extends BaseAgent {
  protected agentName = 'navcriteria';

  protected tools: ToolDefinition[] = [
    // =========================================================================
    // PRIORITY 1: NAVIGATION CRITERIA MANAGEMENT
    // =========================================================================

    {
      name: 'list_nav_criteria',
      description: `List all navigation criteria available in the Windchill system.

**Parameters:**
- name: Filter by criteria name (partial match with contains)
- filterType: Filter by type (e.g., "LifecycleState", "Effectivity", "Custom")
- container: Filter by container/context OID
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Filter Type | Description | Container |
Pagination info with has_more and next_offset

**Returns (json):**
{ data: [...], pagination: { total, count, offset, limit, has_more, next_offset } }

**Examples:**
- List all: { }
- Filter by type: { "filterType": "LifecycleState" }
- Filter by name: { "name": "Released", "limit": 10 }
- Paginate: { "offset": 20, "limit": 20 }`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by criteria name (partial match)'
          },
          filterType: {
            type: 'string',
            description: 'Filter by type (e.g., "LifecycleState", "Effectivity", "Custom")'
          },
          container: {
            type: 'string',
            description: 'Filter by container/context OID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Navigation Criteria',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.name) {
            filters.push(`contains(Name,'${params.name}')`);
          }

          if (params.filterType) {
            filters.push(`FilterType eq '${params.filterType}'`);
          }

          if (params.container) {
            filters.push(`Container eq '${params.container}'`);
          }

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.navCriteria}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Navigation Criteria',
            conciseFields: CRITERIA_CONCISE_FIELDS,
            markdownColumns: CRITERIA_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list navigation criteria',
            suggestion: 'Check filter syntax. Valid filterTypes include "LifecycleState", "Effectivity", "Custom".'
          });
        }
      }
    },

    {
      name: 'get_nav_criteria',
      description: `Get detailed information for a specific navigation criteria by ID.

**Parameters:**
- criteriaId (required): Navigation criteria OID
- expand: Navigation properties to expand (e.g., "FilterExpression")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Navigation criteria details including Name, FilterType, Description, and optionally expanded properties.

**Examples:**
- Get criteria: { "criteriaId": "OR:wt.query.nav.NavigationCriteria:12345" }
- With expansion: { "criteriaId": "OR:...:12345", "expand": "FilterExpression" }
- Detailed view: { "criteriaId": "OR:...:12345", "detail_level": "detailed" }

**Error handling:**
- Not found: Returns error with suggestion to search first`,
      inputSchema: {
        type: 'object',
        properties: {
          criteriaId: {
            type: 'string',
            description: 'Navigation criteria OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "FilterExpression")'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['criteriaId']
      },
      annotations: {
        title: 'Get Navigation Criteria Details',
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
            ? `${apiEndpoints.navCriteria}('${params.criteriaId}')?${queryString}`
            : `${apiEndpoints.navCriteria}('${params.criteriaId}')`;

          const response = await this.api.get(url);

          return buildSingleItemResponse(response.data, params, {
            title: `Navigation Criteria: ${response.data?.Name || params.criteriaId}`,
            conciseFields: CRITERIA_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get navigation criteria',
            suggestion: 'Verify the criteria ID. Use list_nav_criteria to find valid IDs.'
          });
        }
      }
    },

    {
      name: 'search_nav_criteria',
      description: `Search for navigation criteria by name or description with token-efficient responses.

**Parameters:**
- query (required): Search query for criteria name or description (matches both)
- filterType: Filter by specific type
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Filter Type | Description | Container |
Pagination info with has_more and next_offset

**Examples:**
- Search by name: { "query": "Released" }
- Search with filter: { "query": "Design", "filterType": "LifecycleState" }
- Paginate results: { "query": "BOM", "limit": 10, "offset": 0 }

**Error handling:**
- Empty results: Returns helpful message with search suggestions`,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for criteria name or description'
          },
          filterType: {
            type: 'string',
            description: 'Filter by specific type'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['query']
      },
      annotations: {
        title: 'Search Navigation Criteria',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [
            `(contains(Name,'${params.query}') or contains(Description,'${params.query}'))`
          ];

          if (params.filterType) {
            filters.push(`FilterType eq '${params.filterType}'`);
          }

          const queryParams = buildODataPagination(params);
          queryParams.append('$filter', combineFilters(filters));

          const response = await this.api.get(
            `${apiEndpoints.navCriteria}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Navigation Criteria Search: "${params.query}"`,
            conciseFields: CRITERIA_CONCISE_FIELDS,
            markdownColumns: CRITERIA_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search navigation criteria',
            suggestion: 'Try a different search term. Use list_nav_criteria to see all available criteria.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 2: FILTER CONFIGURATION
    // =========================================================================

    {
      name: 'get_filter_expression',
      description: `Get the filter expression details for a specific navigation criteria.

Filter expressions define the actual rules that control how BOM structures are filtered
(e.g., lifecycle state filters, effectivity rules, custom attribute filters).

**Parameters:**
- criteriaId (required): Navigation criteria OID
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Filter expression details including the expression logic and type.

**Examples:**
- Get expression: { "criteriaId": "OR:wt.query.nav.NavigationCriteria:12345" }
- JSON format: { "criteriaId": "OR:...:12345", "response_format": "json" }

**Error handling:**
- Not found: Returns error if criteria has no filter expression defined`,
      inputSchema: {
        type: 'object',
        properties: {
          criteriaId: {
            type: 'string',
            description: 'Navigation criteria OID'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['criteriaId']
      },
      annotations: {
        title: 'Get Filter Expression',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.navCriteria}('${params.criteriaId}')/FilterExpression`
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Filter Expression for: ${params.criteriaId}`,
            conciseFields: FILTER_EXPRESSION_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get filter expression',
            suggestion: 'Verify the criteria ID has a filter expression. Not all criteria have expressions defined.'
          });
        }
      }
    },

    {
      name: 'list_filter_types',
      description: `List all available filter types for navigation criteria (EXPERIMENTAL).

Filter types define the categories of filters that can be applied to BOM navigation,
such as LifecycleState, Effectivity, or Custom attribute filters.

**Parameters:**
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of available filter types with descriptions.

**Examples:**
- List all types: { }
- With pagination: { "limit": 10, "offset": 0 }

**Note:** This endpoint may not be available in all Windchill 13.0.2 configurations.

**Error handling:**
- Not available: Returns error if FilterTypes endpoint is not supported`,
      inputSchema: {
        type: 'object',
        properties: {
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Filter Types (Experimental)',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          // Note: This endpoint may not be available in standard Windchill 13.0.2
          const response = await this.api.get(
            `${apiEndpoints.navCriteria}/FilterTypes?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Navigation Criteria Filter Types',
            conciseFields: ['Name', 'Description', 'ID'],
            markdownColumns: {
              Name: 'Name',
              Description: 'Description',
              ID: 'ID'
            }
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list filter types',
            suggestion: 'This experimental endpoint may not be available. Common filter types include: LifecycleState, Effectivity, Custom.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 3: APPLICATION & USAGE
    // =========================================================================

    {
      name: 'get_applied_criteria',
      description: `Get navigation criteria currently applied to a part structure view (EXPERIMENTAL).

This retrieves the criteria that are actively filtering the BOM view for a specific part.

**Parameters:**
- partId (required): Part OID to check applied criteria
- viewName: View name (e.g., "Design", "Manufacturing")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of navigation criteria applied to the part's structure view.

**Examples:**
- Check part criteria: { "partId": "VR:wt.part.WTPart:12345" }
- For specific view: { "partId": "VR:...:12345", "viewName": "Design" }

**Note:** This endpoint may not be available in all Windchill configurations.

**Error handling:**
- Not found: Returns error if part ID is invalid
- Not available: Returns error if AppliedNavigationCriteria endpoint is not supported`,
      inputSchema: {
        type: 'object',
        properties: {
          partId: {
            type: 'string',
            description: 'Part OID to check applied criteria'
          },
          viewName: {
            type: 'string',
            description: 'View name (e.g., "Design", "Manufacturing")'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['partId']
      },
      annotations: {
        title: 'Get Applied Criteria (Experimental)',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();

          if (params.viewName) {
            queryParams.append('$filter', `ViewName eq '${params.viewName}'`);
          }

          const response = await this.api.get(
            `${apiEndpoints.parts}('${params.partId}')/AppliedNavigationCriteria?${queryParams.toString()}`
          );

          const viewInfo = params.viewName ? ` (${params.viewName} view)` : '';

          return buildListResponse(response.data, params, {
            title: `Applied Criteria: ${params.partId}${viewInfo}`,
            conciseFields: CRITERIA_CONCISE_FIELDS,
            markdownColumns: CRITERIA_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get applied criteria',
            suggestion: 'Verify the part ID. This experimental endpoint may not be available in all configurations.'
          });
        }
      }
    },

    {
      name: 'get_default_criteria',
      description: `Get default navigation criteria for a container/context.

Default criteria define the standard filters applied to BOM views within a product or library.

**Parameters:**
- containerId (required): Container OID (product/library) to get default criteria
- viewName: View name to get specific default criteria (e.g., "Design", "Manufacturing")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of default navigation criteria for the container.

**Examples:**
- Get container defaults: { "containerId": "OR:wt.pdmlink.PDMLinkProduct:12345" }
- For specific view: { "containerId": "OR:...:12345", "viewName": "Manufacturing" }

**Error handling:**
- Not found: Returns error if container ID is invalid`,
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID (product/library) to get default criteria'
          },
          viewName: {
            type: 'string',
            description: 'View name to get specific default criteria'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['containerId']
      },
      annotations: {
        title: 'Get Default Criteria',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();

          if (params.viewName) {
            queryParams.append('$filter', `ViewName eq '${params.viewName}'`);
          }

          const response = await this.api.get(
            `${apiEndpoints.containers}('${params.containerId}')/DefaultNavigationCriteria?${queryParams.toString()}`
          );

          const viewInfo = params.viewName ? ` (${params.viewName} view)` : '';

          return buildListResponse(response.data, params, {
            title: `Default Criteria: ${params.containerId}${viewInfo}`,
            conciseFields: CRITERIA_CONCISE_FIELDS,
            markdownColumns: CRITERIA_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get default criteria',
            suggestion: 'Verify the container ID. Use dataadmin_list_products or dataadmin_list_libraries to find valid container IDs.'
          });
        }
      }
    },

    {
      name: 'get_criteria_by_view',
      description: `Get navigation criteria filtered by view type.

Retrieves all navigation criteria applicable to a specific view (e.g., Design, Manufacturing).

**Parameters:**
- viewName (required): View name (e.g., "Design", "Manufacturing")
- container: Filter by container/context OID
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Filter Type | Description | Container |
Pagination info with has_more and next_offset

**Examples:**
- Design view criteria: { "viewName": "Design" }
- Manufacturing with container: { "viewName": "Manufacturing", "container": "OR:...:12345" }
- Paginate: { "viewName": "Design", "limit": 20, "offset": 0 }`,
      inputSchema: {
        type: 'object',
        properties: {
          viewName: {
            type: 'string',
            description: 'View name (e.g., "Design", "Manufacturing")'
          },
          container: {
            type: 'string',
            description: 'Filter by container/context OID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['viewName']
      },
      annotations: {
        title: 'Get Criteria by View',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [`ViewName eq '${params.viewName}'`];

          if (params.container) {
            filters.push(`Container eq '${params.container}'`);
          }

          const queryParams = buildODataPagination(params);
          queryParams.append('$filter', combineFilters(filters));

          const response = await this.api.get(
            `${apiEndpoints.navCriteria}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Navigation Criteria: ${params.viewName} View`,
            conciseFields: CRITERIA_CONCISE_FIELDS,
            markdownColumns: CRITERIA_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get criteria by view',
            suggestion: 'Verify the view name. Common views include: "Design", "Manufacturing", "Planning".'
          });
        }
      }
    }
  ];
}
