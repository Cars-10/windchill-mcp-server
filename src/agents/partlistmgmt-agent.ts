/**
 * @fileoverview Part List Management Agent - Token-Efficient MCP Tools for Windchill Part Lists
 *
 * This agent provides comprehensive tools for managing Windchill parts lists and favorites,
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
 * **Priority 1 - Part List Management:**
 * - list_part_lists: List all part lists (user's or all)
 * - get_part_list: Get detailed part list information
 * - search_part_lists: Search part lists by name
 * - get_part_list_items: Get all parts in a list
 *
 * **Priority 2 - List Operations:**
 * - add_part_to_list: Add a part to a list
 * - remove_part_from_list: Remove a part from a list
 * - create_part_list: Create a new part list
 * - delete_part_list: Delete a part list
 * - update_part_list: Update part list properties
 *
 * **Priority 3 - Sharing & Collaboration:**
 * - get_shared_lists: Get lists shared with the current user
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

/** Default fields to include in concise part list responses */
const PARTLIST_CONCISE_FIELDS = ['ID', 'Name', 'Description', 'Owner', 'Shared', 'ItemCount'] as const;

/** Markdown column definitions for part list tables */
const PARTLIST_MARKDOWN_COLUMNS = {
  Name: 'Name',
  Owner: 'Owner',
  Shared: 'Shared',
  ItemCount: 'Items'
};

/** Extended fields for detailed part list views */
const PARTLIST_DETAILED_FIELDS = [
  'ID', 'Name', 'Description', 'Owner', 'Shared', 'ItemCount',
  'CreatedBy', 'CreatedOn', 'ModifiedBy', 'ModifiedOn'
] as const;

/** Markdown columns for part list item tables */
const PARTLIST_ITEM_MARKDOWN_COLUMNS = {
  Number: 'Part Number',
  Name: 'Part Name',
  Type: 'Type',
  State: 'State'
};

/** Concise fields for part list items */
const PARTLIST_ITEM_CONCISE_FIELDS = ['Number', 'Name', 'Type', 'State'] as const;

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

const DESTRUCTIVE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true
};

// ============================================================================
// PART LIST MANAGEMENT AGENT
// ============================================================================

/**
 * PartListMgmtAgent provides comprehensive tools for managing Windchill parts lists.
 *
 * All tools support:
 * - `response_format`: 'markdown' (default, token-efficient) or 'json' (complete)
 * - `detail_level`: 'concise' (default, essential fields) or 'detailed' (all fields)
 * - Pagination with `limit` and `offset` parameters
 *
 * @extends BaseAgent
 */
export class PartListMgmtAgent extends BaseAgent {
  protected agentName = 'partlistmgmt';

  protected tools: ToolDefinition[] = [
    // =========================================================================
    // PRIORITY 1: PART LIST MANAGEMENT
    // =========================================================================

    {
      name: 'list_part_lists',
      description: `List all part lists (favorites/working lists) with filtering options.

**Parameters:**
- owner: Filter by owner user ID
- shared: Filter by shared status (true = shared lists only)
- name: Filter by list name (partial match)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- select: Comma-separated list of properties to return
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Owner | Shared | Items |
Pagination info with has_more and next_offset

**Returns (json):**
{ data: [...], pagination: { total, count, offset, limit, has_more, next_offset } }

**Examples:**
- List all: {}
- My lists: { "owner": "jsmith" }
- Shared only: { "shared": true }
- Search by name: { "name": "Favorites" }

**Error handling:**
- Empty results: Returns helpful message`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Filter by owner user ID'
          },
          shared: {
            type: 'boolean',
            description: 'Filter by shared status (true = shared lists only)'
          },
          name: {
            type: 'string',
            description: 'Filter by list name (partial match)'
          },
          select: {
            type: 'string',
            description: 'Comma-separated list of properties to return'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Part Lists',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);
          const filters: string[] = [];

          if (params.owner) {
            filters.push(`Owner eq '${params.owner}'`);
          }

          if (params.shared !== undefined) {
            filters.push(`Shared eq ${params.shared}`);
          }

          if (params.name) {
            filters.push(`contains(Name,'${params.name}')`);
          }

          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          if (params.select) {
            queryParams.append('$select', String(params.select));
          }

          const response = await this.api.get(
            `${apiEndpoints.partLists}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Part Lists',
            conciseFields: PARTLIST_CONCISE_FIELDS,
            markdownColumns: PARTLIST_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list part lists',
            suggestion: 'Check filter parameters and try again.'
          });
        }
      }
    },

    {
      name: 'get_part_list',
      description: `Get detailed information for a specific part list.

**Parameters:**
- listId (required): Part list OID
- expand: Navigation properties to expand (e.g., "Parts,Owner")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Part list details including name, description, owner, and item count.

**Examples:**
- Get list: { "listId": "OR:wt.doc.WTDocument:12345" }
- With parts: { "listId": "12345", "expand": "Parts" }

**Error handling:**
- Not found: Returns error with suggestion to search first`,
      inputSchema: {
        type: 'object',
        properties: {
          listId: {
            type: 'string',
            description: 'Part list OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "Parts,Owner")'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['listId']
      },
      annotations: {
        title: 'Get Part List Details',
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
            ? `${apiEndpoints.partLists}('${params.listId}')?${queryString}`
            : `${apiEndpoints.partLists}('${params.listId}')`;

          const response = await this.api.get(url);

          return buildSingleItemResponse(response.data, params, {
            title: `Part List: ${response.data?.Name || params.listId}`,
            conciseFields: PARTLIST_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get part list',
            suggestion: 'Verify the list ID. Use list_part_lists to find valid IDs.'
          });
        }
      }
    },

    {
      name: 'search_part_lists',
      description: `Search for part lists by name or description.

**Parameters:**
- query (required): Search query for list name or description
- owner: Filter by owner user ID
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Matching part lists with name, owner, and item count.

**Examples:**
- Search: { "query": "Favorites" }
- My lists: { "query": "project", "owner": "jsmith" }

**Error handling:**
- No matches: Returns helpful suggestions`,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for list name or description'
          },
          owner: {
            type: 'string',
            description: 'Filter by owner user ID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['query']
      },
      annotations: {
        title: 'Search Part Lists',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);
          const filters = [`(contains(Name,'${params.query}') or contains(Description,'${params.query}'))`];

          if (params.owner) {
            filters.push(`Owner eq '${params.owner}'`);
          }

          queryParams.append('$filter', combineFilters(filters));

          const response = await this.api.get(
            `${apiEndpoints.partLists}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Part List Search: "${params.query}"`,
            conciseFields: PARTLIST_CONCISE_FIELDS,
            markdownColumns: PARTLIST_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search part lists',
            suggestion: 'Try a different search term or remove filters.'
          });
        }
      }
    },

    {
      name: 'get_part_list_items',
      description: `Get all parts included in a specific part list.

**Parameters:**
- listId (required): Part list OID
- expand: Expand part properties (e.g., "Number,Name,State")
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Part Number | Part Name | Type | State |
Pagination info with has_more and next_offset

**Returns (json):**
{ data: [...], pagination: { total, count, offset, limit, has_more, next_offset } }

**Examples:**
- Get items: { "listId": "12345" }
- Paginate: { "listId": "12345", "offset": 20, "limit": 20 }

**Error handling:**
- List not found: Suggests verifying list ID`,
      inputSchema: {
        type: 'object',
        properties: {
          listId: {
            type: 'string',
            description: 'Part list OID'
          },
          expand: {
            type: 'string',
            description: 'Expand part properties (e.g., "Number,Name,State")'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['listId']
      },
      annotations: {
        title: 'Get Part List Items',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          if (params.expand) {
            queryParams.append('$expand', String(params.expand));
          }

          const response = await this.api.get(
            `${apiEndpoints.partLists}('${params.listId}')/Parts?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Parts in List: ${params.listId}`,
            conciseFields: PARTLIST_ITEM_CONCISE_FIELDS,
            markdownColumns: PARTLIST_ITEM_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get part list items',
            suggestion: 'Verify the list ID exists using list_part_lists or search_part_lists.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 2: LIST OPERATIONS
    // =========================================================================

    {
      name: 'add_part_to_list',
      description: `Add a part to an existing part list.

**Note:** This operation requires POST support in Windchill OData.

**Parameters:**
- listId (required): Part list OID
- partId (required): Part OID to add
- response_format: 'markdown' (default) or 'json'

**Returns:** Confirmation with updated list info.

**Examples:**
- Add part: { "listId": "12345", "partId": "VR:wt.part.WTPart:67890" }

**Error handling:**
- Part already in list: Returns informative message
- Invalid IDs: Suggests verification`,
      inputSchema: {
        type: 'object',
        properties: {
          listId: {
            type: 'string',
            description: 'Part list OID'
          },
          partId: {
            type: 'string',
            description: 'Part OID to add'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['listId', 'partId']
      },
      annotations: {
        title: 'Add Part to List',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.partLists}('${params.listId}')/Parts`,
            {
              PartID: params.partId
            }
          );

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

          if (responseFormat === ResponseFormat.MARKDOWN) {
            return `**Added part to list**\n\n- **List ID:** ${params.listId}\n- **Part ID:** ${params.partId}`;
          }
          return JSON.stringify({ success: true, listId: params.listId, partId: params.partId, ...response.data }, null, 2);
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'add part to list',
            suggestion: 'Verify both list ID and part ID are valid.'
          });
        }
      }
    },

    {
      name: 'remove_part_from_list',
      description: `Remove a part from a part list.

**Note:** This operation requires DELETE support in Windchill OData.

**Parameters:**
- listId (required): Part list OID
- partId (required): Part OID to remove
- response_format: 'markdown' (default) or 'json'

**Returns:** Confirmation of removal.

**Examples:**
- Remove part: { "listId": "12345", "partId": "VR:wt.part.WTPart:67890" }

**Error handling:**
- Part not in list: Returns informative message
- Invalid IDs: Suggests verification`,
      inputSchema: {
        type: 'object',
        properties: {
          listId: {
            type: 'string',
            description: 'Part list OID'
          },
          partId: {
            type: 'string',
            description: 'Part OID to remove'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['listId', 'partId']
      },
      annotations: {
        title: 'Remove Part from List',
        ...DESTRUCTIVE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.delete(
            `${apiEndpoints.partLists}('${params.listId}')/Parts('${params.partId}')`
          );

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

          if (responseFormat === ResponseFormat.MARKDOWN) {
            return `**Removed part from list**\n\n- **List ID:** ${params.listId}\n- **Part ID:** ${params.partId}`;
          }
          return JSON.stringify({ success: true, listId: params.listId, partId: params.partId, ...response.data }, null, 2);
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'remove part from list',
            suggestion: 'Verify both list ID and part ID are valid, and that the part is in the list.'
          });
        }
      }
    },

    {
      name: 'create_part_list',
      description: `Create a new part list.

**Note:** This operation requires POST support in Windchill OData.

**Parameters:**
- name (required): Name for the new part list
- description: Description for the part list
- shared: Whether the list should be shared (default: false)
- response_format: 'markdown' (default) or 'json'

**Returns:** Created part list details.

**Examples:**
- Simple: { "name": "My Favorites" }
- Full: { "name": "Project Parts", "description": "Parts for Project X", "shared": true }

**Error handling:**
- Duplicate name: Returns informative message
- Missing name: Returns validation error`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name for the new part list'
          },
          description: {
            type: 'string',
            description: 'Description for the part list'
          },
          shared: {
            type: 'boolean',
            description: 'Whether the list should be shared (default: false)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['name']
      },
      annotations: {
        title: 'Create Part List',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            apiEndpoints.partLists,
            {
              Name: params.name,
              Description: params.description,
              Shared: params.shared || false
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Created Part List: ${params.name}`,
            conciseFields: PARTLIST_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'create part list',
            suggestion: 'Check for duplicate names and ensure you have permission to create lists.'
          });
        }
      }
    },

    {
      name: 'delete_part_list',
      description: `Delete a part list.

**Warning:** This action is destructive and cannot be undone.

**Note:** This operation requires DELETE support in Windchill OData.

**Parameters:**
- listId (required): Part list OID to delete
- response_format: 'markdown' (default) or 'json'

**Returns:** Confirmation of deletion.

**Examples:**
- Delete: { "listId": "12345" }

**Error handling:**
- List not found: Returns informative message
- Permission denied: Suggests checking ownership`,
      inputSchema: {
        type: 'object',
        properties: {
          listId: {
            type: 'string',
            description: 'Part list OID to delete'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['listId']
      },
      annotations: {
        title: 'Delete Part List',
        ...DESTRUCTIVE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          await this.api.delete(
            `${apiEndpoints.partLists}('${params.listId}')`
          );

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

          if (responseFormat === ResponseFormat.MARKDOWN) {
            return `**Deleted part list**\n\n- **List ID:** ${params.listId}`;
          }
          return JSON.stringify({ success: true, listId: params.listId, deleted: true }, null, 2);
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'delete part list',
            suggestion: 'Verify the list ID and ensure you own the list or have delete permissions.'
          });
        }
      }
    },

    {
      name: 'update_part_list',
      description: `Update part list properties.

**Note:** This operation requires PATCH/PUT support in Windchill OData.

**Parameters:**
- listId (required): Part list OID
- name: New name for the list
- description: New description
- shared: Update shared status
- response_format: 'markdown' (default) or 'json'

**Returns:** Updated part list details.

**Examples:**
- Rename: { "listId": "12345", "name": "New Name" }
- Share: { "listId": "12345", "shared": true }
- Multiple: { "listId": "12345", "name": "Renamed", "description": "Updated desc", "shared": true }

**Error handling:**
- List not found: Suggests verification
- No changes: Returns validation error`,
      inputSchema: {
        type: 'object',
        properties: {
          listId: {
            type: 'string',
            description: 'Part list OID'
          },
          name: {
            type: 'string',
            description: 'New name for the list'
          },
          description: {
            type: 'string',
            description: 'New description'
          },
          shared: {
            type: 'boolean',
            description: 'Update shared status'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['listId']
      },
      annotations: {
        title: 'Update Part List',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const updateData: Record<string, unknown> = {};
          if (params.name) updateData.Name = params.name;
          if (params.description) updateData.Description = params.description;
          if (params.shared !== undefined) updateData.Shared = params.shared;

          if (Object.keys(updateData).length === 0) {
            return buildErrorResponse('No update fields provided', {
              operation: 'update part list',
              suggestion: 'Provide at least one field to update: name, description, or shared.'
            });
          }

          const response = await this.api.patch(
            `${apiEndpoints.partLists}('${params.listId}')`,
            updateData
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Updated Part List: ${params.listId}`,
            conciseFields: PARTLIST_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'update part list',
            suggestion: 'Verify the list ID and ensure you have permission to modify it.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 3: SHARING & COLLABORATION
    // =========================================================================

    {
      name: 'get_shared_lists',
      description: `Get all part lists that have been shared.

**Parameters:**
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Owner | Shared | Items |
Pagination info with has_more and next_offset

**Returns (json):**
{ data: [...], pagination: { total, count, offset, limit, has_more, next_offset } }

**Examples:**
- Get shared: {}
- Paginate: { "offset": 10, "limit": 10 }

**Error handling:**
- No shared lists: Returns helpful message`,
      inputSchema: {
        type: 'object',
        properties: {
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Get Shared Part Lists',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);
          queryParams.append('$filter', 'Shared eq true');

          const response = await this.api.get(
            `${apiEndpoints.partLists}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Shared Part Lists',
            conciseFields: PARTLIST_CONCISE_FIELDS,
            markdownColumns: PARTLIST_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get shared lists',
            suggestion: 'Check your permissions and try again.'
          });
        }
      }
    }
  ];
}
