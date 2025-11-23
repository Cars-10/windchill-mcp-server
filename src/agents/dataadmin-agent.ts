/**
 * @fileoverview DataAdmin Agent - Token-Efficient MCP Tools for Windchill Containers
 *
 * This agent provides comprehensive tools for querying Windchill containers and contexts,
 * optimized for LLM token efficiency.
 *
 * Features:
 * - Response format options (markdown/json)
 * - Detail levels (concise/detailed)
 * - Pagination with has_more, next_offset, total_count
 * - Character limit enforcement with truncation
 * - Tool annotations for MCP clients
 * - Comprehensive descriptions with usage examples
 *
 * **Priority 1 - Container Discovery:**
 * - list_containers: List all containers
 * - list_products: List all product containers
 * - list_libraries: List all library containers
 * - list_organizations: List all organization containers
 * - list_projects: List all project containers
 * - get_container: Get specific container details
 *
 * **Priority 2 - Container Content & Structure:**
 * - get_container_folders: Get folders in a container
 * - get_folder_contents: Get contents of a specific folder
 * - search_containers: Advanced container search
 *
 * **Priority 3 - Product/Library Options:**
 * - get_product_options: Get option pool for a product
 * - get_library_options: Get option pool for a library
 * - get_option_sets: Get assigned option sets
 *
 * **Note:** The DataAdmin domain is read-only. No create, update, or delete operations
 * are supported by Windchill REST Services for container management.
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
  buildTextFilter,
  combineFilters,
  DEFAULT_LIMIT,
  MAX_LIMIT
} from '../utils/response-formatter.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Fields for concise container responses */
const CONTAINER_CONCISE_FIELDS = ['ID', 'Name', 'Type', 'Description'] as const;

/** Markdown column definitions for container tables */
const CONTAINER_MARKDOWN_COLUMNS = {
  ID: 'ID',
  Name: 'Name',
  Type: 'Type',
  Description: 'Description'
};

/** Fields for concise folder responses */
const FOLDER_CONCISE_FIELDS = ['ID', 'Name', 'Path', 'Type'] as const;

/** Markdown column definitions for folder tables */
const FOLDER_MARKDOWN_COLUMNS = {
  ID: 'ID',
  Name: 'Name',
  Path: 'Path',
  Type: 'Type'
};

/** Fields for concise option responses */
const OPTION_CONCISE_FIELDS = ['ID', 'Name', 'Type', 'Description'] as const;

/** Markdown column definitions for option tables */
const OPTION_MARKDOWN_COLUMNS = {
  ID: 'ID',
  Name: 'Name',
  Type: 'Type',
  Description: 'Description'
};

// ============================================================================
// TOOL ANNOTATIONS
// ============================================================================

/** Read-only annotations for all DataAdmin tools (this domain is read-only) */
const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

// ============================================================================
// CONTAINER TYPE MAPPING
// ============================================================================

/** Maps container type names to OData type paths */
const CONTAINER_TYPE_MAP: Record<string, string> = {
  Product: 'PTC.DataAdmin.ProductContainer',
  Library: 'PTC.DataAdmin.LibraryContainer',
  Organization: 'PTC.DataAdmin.OrganizationContainer',
  Project: 'PTC.DataAdmin.ProjectContainer',
  Site: 'PTC.DataAdmin.Site'
};

// ============================================================================
// DATAADMIN AGENT
// ============================================================================

/**
 * DataAdminAgent provides comprehensive tools for querying Windchill containers and contexts.
 *
 * All tools support:
 * - `response_format`: 'markdown' (default, token-efficient) or 'json' (complete)
 * - `detail_level`: 'concise' (default, essential fields) or 'detailed' (all fields)
 * - Pagination with `limit` and `offset` parameters
 *
 * **Note:** This domain is read-only. No create, update, or delete operations are supported.
 *
 * @extends BaseAgent
 */
export class DataAdminAgent extends BaseAgent {
  protected agentName = 'dataadmin';

  protected tools: ToolDefinition[] = [
    // =========================================================================
    // PRIORITY 1: CONTAINER DISCOVERY
    // =========================================================================

    {
      name: 'list_containers',
      description: `List all containers (contexts) available in the Windchill system with token-efficient responses.

**Parameters:**
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- select: Comma-separated properties to return (e.g., "Name,ID,Type")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| ID | Name | Type | Description |
Pagination info with has_more and next_offset

**Returns (json):**
{ data: [...], pagination: { total, count, offset, limit, has_more, next_offset } }

**Examples:**
- List all: {}
- First 10: { "limit": 10 }
- Paginate: { "offset": 20, "limit": 20 }
- Specific fields: { "select": "Name,Type" }`,
      inputSchema: {
        type: 'object',
        properties: {
          select: {
            type: 'string',
            description: 'Comma-separated list of properties to return (e.g., "Name,ID,Type")'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List All Containers',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          if (params.select) {
            queryParams.append('$select', params.select);
          }

          const response = await this.api.get(
            `${apiEndpoints.containers}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'All Containers',
            conciseFields: CONTAINER_CONCISE_FIELDS,
            markdownColumns: CONTAINER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list containers',
            suggestion: 'Check Windchill connection and authentication.'
          });
        }
      }
    },

    {
      name: 'list_products',
      description: `List all product containers in the Windchill system with token-efficient responses.

Product containers hold product-related data including parts, documents, and configurations.

**Supports wildcards:** Use "*" for pattern matching in name (e.g., "Engine*", "*Assembly*")

**Parameters:**
- name: Filter by product name (partial match with wildcards)
- expand: Navigation properties to expand (e.g., "OptionPool")
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of product containers with ID, Name, Type, Description

**Examples:**
- List all products: {}
- Filter by name: { "name": "Engine*" }
- Include options: { "expand": "OptionPool" }
- Paginate: { "limit": 10, "offset": 20 }`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by product name (partial match with wildcards, e.g., "Engine*")'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "OptionPool")'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Product Containers',
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

          if (params.expand) {
            queryParams.append('$expand', params.expand);
          }

          const response = await this.api.get(
            `${apiEndpoints.containers}/${CONTAINER_TYPE_MAP.Product}?${queryParams.toString()}`
          );

          const searchTerm = params.name || 'all';
          return buildListResponse(response.data, params, {
            title: `Product Containers: "${searchTerm}"`,
            conciseFields: CONTAINER_CONCISE_FIELDS,
            markdownColumns: CONTAINER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list products',
            suggestion: 'Verify you have access to product containers.'
          });
        }
      }
    },

    {
      name: 'list_libraries',
      description: `List all library containers in the Windchill system with token-efficient responses.

Library containers store reusable components, standard parts, and shared resources.

**Supports wildcards:** Use "*" for pattern matching in name (e.g., "Standard*", "*Parts*")

**Parameters:**
- name: Filter by library name (partial match with wildcards)
- expand: Navigation properties to expand (e.g., "OptionPool")
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of library containers with ID, Name, Type, Description

**Examples:**
- List all libraries: {}
- Filter by name: { "name": "*Standard*" }
- Include options: { "expand": "OptionPool" }`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by library name (partial match with wildcards)'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "OptionPool")'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Library Containers',
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

          if (params.expand) {
            queryParams.append('$expand', params.expand);
          }

          const response = await this.api.get(
            `${apiEndpoints.containers}/${CONTAINER_TYPE_MAP.Library}?${queryParams.toString()}`
          );

          const searchTerm = params.name || 'all';
          return buildListResponse(response.data, params, {
            title: `Library Containers: "${searchTerm}"`,
            conciseFields: CONTAINER_CONCISE_FIELDS,
            markdownColumns: CONTAINER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list libraries',
            suggestion: 'Verify you have access to library containers.'
          });
        }
      }
    },

    {
      name: 'list_organizations',
      description: `List all organization containers in the Windchill system with token-efficient responses.

Organization containers represent organizational units and their associated contexts.

**Supports wildcards:** Use "*" for pattern matching in name (e.g., "Engineering*")

**Parameters:**
- name: Filter by organization name (partial match with wildcards)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of organization containers with ID, Name, Type, Description

**Examples:**
- List all organizations: {}
- Filter by name: { "name": "Engineering*" }`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by organization name (partial match with wildcards)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Organization Containers',
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

          const response = await this.api.get(
            `${apiEndpoints.containers}/${CONTAINER_TYPE_MAP.Organization}?${queryParams.toString()}`
          );

          const searchTerm = params.name || 'all';
          return buildListResponse(response.data, params, {
            title: `Organization Containers: "${searchTerm}"`,
            conciseFields: CONTAINER_CONCISE_FIELDS,
            markdownColumns: CONTAINER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list organizations',
            suggestion: 'Verify you have access to organization containers.'
          });
        }
      }
    },

    {
      name: 'list_projects',
      description: `List all project containers in the Windchill system with token-efficient responses.

Project containers manage project-specific data, deliverables, and team collaboration.

**Supports wildcards:** Use "*" for pattern matching in name (e.g., "2024*", "*Phase1*")

**Parameters:**
- name: Filter by project name (partial match with wildcards)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of project containers with ID, Name, Type, Description

**Examples:**
- List all projects: {}
- Filter by name: { "name": "2024*" }
- Find phase projects: { "name": "*Phase*" }`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by project name (partial match with wildcards)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Project Containers',
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

          const response = await this.api.get(
            `${apiEndpoints.containers}/${CONTAINER_TYPE_MAP.Project}?${queryParams.toString()}`
          );

          const searchTerm = params.name || 'all';
          return buildListResponse(response.data, params, {
            title: `Project Containers: "${searchTerm}"`,
            conciseFields: CONTAINER_CONCISE_FIELDS,
            markdownColumns: CONTAINER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list projects',
            suggestion: 'Verify you have access to project containers.'
          });
        }
      }
    },

    {
      name: 'get_container',
      description: `Get detailed information for a specific container by its OID.

**Parameters:**
- containerId (required): Container OID (e.g., "OR:wt.pdmlink.PDMLinkProduct:12345")
- expand: Navigation properties to expand (e.g., "OptionPool,Folders")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Container details including ID, Name, Type, Description, and expanded properties

**Examples:**
- Get container: { "containerId": "OR:wt.pdmlink.PDMLinkProduct:12345" }
- With folders: { "containerId": "OR:...:12345", "expand": "Folders" }
- With options: { "containerId": "OR:...:12345", "expand": "OptionPool" }

**Error handling:**
- Not found: Returns error with suggestion to list containers first`,
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID (e.g., "OR:wt.pdmlink.PDMLinkProduct:12345")'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "OptionPool,Folders")'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['containerId']
      },
      annotations: {
        title: 'Get Container Details',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();

          if (params.expand) {
            queryParams.append('$expand', params.expand);
          }

          const queryString = queryParams.toString();
          const url = queryString
            ? `${apiEndpoints.containers}('${params.containerId}')?${queryString}`
            : `${apiEndpoints.containers}('${params.containerId}')`;

          const response = await this.api.get(url);

          return buildSingleItemResponse(response.data, params, {
            title: `Container: ${response.data?.Name || params.containerId}`,
            conciseFields: CONTAINER_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get container',
            suggestion: 'Verify the container OID. Use list_containers to find valid OIDs.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 2: CONTAINER CONTENT & STRUCTURE
    // =========================================================================

    {
      name: 'get_container_folders',
      description: `Get folders within a specific container.

Folders organize content within Windchill containers (products, libraries, projects).

**Parameters:**
- containerId (required): Container OID
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of folders with ID, Name, Path, Type

**Examples:**
- Get folders: { "containerId": "OR:wt.pdmlink.PDMLinkProduct:12345" }
- Paginate: { "containerId": "OR:...:12345", "limit": 10, "offset": 20 }

**Error handling:**
- Container not found: Suggests using list_products, list_libraries, etc.`,
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['containerId']
      },
      annotations: {
        title: 'Get Container Folders',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          const response = await this.api.get(
            `${apiEndpoints.containers}('${params.containerId}')/Folders?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Folders in Container: ${params.containerId}`,
            conciseFields: FOLDER_CONCISE_FIELDS,
            markdownColumns: FOLDER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get container folders',
            suggestion: 'Verify the container OID. Use list_products or list_libraries to find valid OIDs.'
          });
        }
      }
    },

    {
      name: 'get_folder_contents',
      description: `Get contents of a specific folder within a container.

Returns the items stored in a folder, which may include parts, documents, and other objects.

**Parameters:**
- containerId (required): Container OID
- folderId (required): Folder OID
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of folder contents with type, name, and properties

**Examples:**
- Get contents: { "containerId": "OR:...:12345", "folderId": "OR:...:67890" }
- Paginate: { "containerId": "OR:...:12345", "folderId": "OR:...:67890", "limit": 50 }

**Error handling:**
- Folder not found: Suggests using get_container_folders first`,
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID'
          },
          folderId: {
            type: 'string',
            description: 'Folder OID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['containerId', 'folderId']
      },
      annotations: {
        title: 'Get Folder Contents',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          const response = await this.api.get(
            `${apiEndpoints.containers}('${params.containerId}')/Folders('${params.folderId}')/FolderContent?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Folder Contents: ${params.folderId}`,
            conciseFields: ['ID', 'Number', 'Name', 'Type'],
            markdownColumns: { ID: 'ID', Number: 'Number', Name: 'Name', Type: 'Type' }
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get folder contents',
            suggestion: 'Verify both container and folder OIDs. Use get_container_folders to find valid folder OIDs.'
          });
        }
      }
    },

    {
      name: 'search_containers',
      description: `Advanced search for containers with multiple criteria.

Search across all container types or filter by specific type with name matching.

**Supports wildcards:** Use "*" for pattern matching in name (e.g., "Project*", "*2024*")

**Parameters:**
- name: Container name filter (partial match with wildcards)
- type: Container type filter (Product, Library, Organization, Project)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of matching containers with ID, Name, Type, Description

**Examples:**
- Search by name: { "name": "*Engine*" }
- Filter by type: { "type": "Product" }
- Combined: { "name": "Phase*", "type": "Project" }
- Paginate: { "type": "Library", "limit": 10, "offset": 20 }

**Note:** When type is specified, search is restricted to that container type.`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Container name filter (partial match with wildcards)'
          },
          type: {
            type: 'string',
            description: 'Container type (Product, Library, Organization, Project)',
            enum: ['Product', 'Library', 'Organization', 'Project']
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Search Containers',
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

          // Build URL based on type filter
          let url = apiEndpoints.containers;
          if (params.type && CONTAINER_TYPE_MAP[params.type]) {
            url += `/${CONTAINER_TYPE_MAP[params.type]}`;
          }

          const response = await this.api.get(`${url}?${queryParams.toString()}`);

          const searchDesc = [
            params.name ? `name="${params.name}"` : null,
            params.type ? `type=${params.type}` : null
          ].filter(Boolean).join(', ') || 'all';

          return buildListResponse(response.data, params, {
            title: `Container Search: ${searchDesc}`,
            conciseFields: CONTAINER_CONCISE_FIELDS,
            markdownColumns: CONTAINER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search containers',
            suggestion: 'Check filter syntax. Valid types: Product, Library, Organization, Project.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 3: PRODUCT/LIBRARY OPTIONS
    // =========================================================================

    {
      name: 'get_product_options',
      description: `Get option pool (configuration options) for a product container.

Options define configurable variants and choices available within a product.
Requires Windchill Options & Variants functionality.

**Parameters:**
- productId (required): Product container OID
- optionType: Type of options to retrieve (OptionGroup, Option)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of options with ID, Name, Type, Description

**Examples:**
- Get all options: { "productId": "OR:wt.pdmlink.PDMLinkProduct:12345" }
- Get option groups: { "productId": "OR:...:12345", "optionType": "OptionGroup" }
- Get specific options: { "productId": "OR:...:12345", "optionType": "Option" }

**Note:** Requires Windchill Options & Variants module.`,
      inputSchema: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'Product container OID'
          },
          optionType: {
            type: 'string',
            description: 'Type of options to retrieve (OptionGroup, Option)',
            enum: ['OptionGroup', 'Option']
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['productId']
      },
      annotations: {
        title: 'Get Product Options',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          let url = `${apiEndpoints.containers}/${CONTAINER_TYPE_MAP.Product}('${params.productId}')/OptionPool`;

          if (params.optionType) {
            url += `/PTC.ProdPlatformMgmt.${params.optionType}`;
          }

          const response = await this.api.get(`${url}?${queryParams.toString()}`);

          const optionDesc = params.optionType || 'all';
          return buildListResponse(response.data, params, {
            title: `Product Options (${optionDesc}): ${params.productId}`,
            conciseFields: OPTION_CONCISE_FIELDS,
            markdownColumns: OPTION_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get product options',
            suggestion: 'Verify the product OID. Options & Variants module may be required.'
          });
        }
      }
    },

    {
      name: 'get_library_options',
      description: `Get option pool (configuration options) for a library container.

Options define configurable variants and choices available within a library.
Requires Windchill Options & Variants functionality.

**Parameters:**
- libraryId (required): Library container OID
- optionType: Type of options to retrieve (OptionGroup, Option)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of options with ID, Name, Type, Description

**Examples:**
- Get all options: { "libraryId": "OR:wt.library.WTLibrary:12345" }
- Get option groups: { "libraryId": "OR:...:12345", "optionType": "OptionGroup" }
- Get specific options: { "libraryId": "OR:...:12345", "optionType": "Option" }

**Note:** Requires Windchill Options & Variants module.`,
      inputSchema: {
        type: 'object',
        properties: {
          libraryId: {
            type: 'string',
            description: 'Library container OID'
          },
          optionType: {
            type: 'string',
            description: 'Type of options to retrieve (OptionGroup, Option)',
            enum: ['OptionGroup', 'Option']
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['libraryId']
      },
      annotations: {
        title: 'Get Library Options',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          let url = `${apiEndpoints.containers}/${CONTAINER_TYPE_MAP.Library}('${params.libraryId}')/OptionPool`;

          if (params.optionType) {
            url += `/PTC.ProdPlatformMgmt.${params.optionType}`;
          }

          const response = await this.api.get(`${url}?${queryParams.toString()}`);

          const optionDesc = params.optionType || 'all';
          return buildListResponse(response.data, params, {
            title: `Library Options (${optionDesc}): ${params.libraryId}`,
            conciseFields: OPTION_CONCISE_FIELDS,
            markdownColumns: OPTION_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get library options',
            suggestion: 'Verify the library OID. Options & Variants module may be required.'
          });
        }
      }
    },

    {
      name: 'get_option_sets',
      description: `Get assigned option sets for a product or library container.

Option sets group related options together for configuration management.
Requires Windchill Options & Variants functionality.

**Parameters:**
- containerId (required): Product or library container OID
- containerType (required): Type of container (Product or Library)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of option sets with ID, Name, Type, Description

**Examples:**
- Product option sets: { "containerId": "OR:...:12345", "containerType": "Product" }
- Library option sets: { "containerId": "OR:...:67890", "containerType": "Library" }

**Note:** Requires Windchill Options & Variants module.`,
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Product or library container OID'
          },
          containerType: {
            type: 'string',
            description: 'Type of container (Product or Library)',
            enum: ['Product', 'Library']
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['containerId', 'containerType']
      },
      annotations: {
        title: 'Get Option Sets',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          const containerType = CONTAINER_TYPE_MAP[params.containerType];
          if (!containerType) {
            return buildErrorResponse('Invalid container type', {
              operation: 'get option sets',
              suggestion: 'containerType must be "Product" or "Library".'
            });
          }

          const url = `${apiEndpoints.containers}/${containerType}('${params.containerId}')/AssignedOptionSet?${queryParams.toString()}`;

          const response = await this.api.get(url);

          return buildListResponse(response.data, params, {
            title: `Option Sets (${params.containerType}): ${params.containerId}`,
            conciseFields: OPTION_CONCISE_FIELDS,
            markdownColumns: OPTION_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get option sets',
            suggestion: 'Verify container OID and type. Options & Variants module may be required.'
          });
        }
      }
    },

    {
      name: 'get_site_container',
      description: `Get the top-level Windchill site container information.

The site container is the root of the Windchill container hierarchy.

**Parameters:**
- expand: Navigation properties to expand
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Site container details

**Examples:**
- Get site info: {}
- With expanded properties: { "expand": "Contexts" }`,
      inputSchema: {
        type: 'object',
        properties: {
          expand: {
            type: 'string',
            description: 'Navigation properties to expand'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Get Site Container',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();

          if (params.expand) {
            queryParams.append('$expand', params.expand);
          }

          const queryString = queryParams.toString();
          const url = queryString
            ? `${apiEndpoints.containers}/${CONTAINER_TYPE_MAP.Site}?${queryString}`
            : `${apiEndpoints.containers}/${CONTAINER_TYPE_MAP.Site}`;

          const response = await this.api.get(url);

          // Site endpoint may return single item or collection
          if (response.data?.value && Array.isArray(response.data.value)) {
            return buildListResponse(response.data, params, {
              title: 'Windchill Site Container',
              conciseFields: CONTAINER_CONCISE_FIELDS,
              markdownColumns: CONTAINER_MARKDOWN_COLUMNS
            });
          }

          return buildSingleItemResponse(response.data, params, {
            title: 'Windchill Site Container',
            conciseFields: CONTAINER_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get site container',
            suggestion: 'Verify Windchill connection and site access permissions.'
          });
        }
      }
    }
  ];
}
