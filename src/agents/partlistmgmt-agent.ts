import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * PartListMgmtAgent provides tools for managing Windchill parts lists and favorites.
 *
 * This agent exposes the PTC Part List Management Domain capabilities for creating,
 * managing, and sharing collections of parts (favorites, working lists, etc.).
 *
 * **Priority 1 - Part List Management:**
 * - list_part_lists: List all part lists (user's or all)
 * - get_part_list: Get detailed part list information
 * - search_part_lists: Search part lists by name
 * - get_part_list_items: Get all parts in a list
 *
 * **Priority 2 - List Operations:**
 * - add_part_to_list: Add a part to a list (EXPERIMENTAL - may require POST)
 * - remove_part_from_list: Remove a part from a list (EXPERIMENTAL - may require DELETE)
 * - create_part_list: Create a new part list (EXPERIMENTAL - may require POST)
 * - delete_part_list: Delete a part list (EXPERIMENTAL - may require DELETE)
 *
 * **Priority 3 - Sharing & Collaboration:**
 * - get_shared_lists: Get lists shared with the current user
 * - share_part_list: Share a list with other users (EXPERIMENTAL)
 *
 * **Note:** Many write operations in this domain require POST/PUT/DELETE methods
 * which may not be fully supported in Windchill 13.0.2 OData. Read operations should work reliably.
 */
export class PartListMgmtAgent extends BaseAgent {
  protected agentName = 'partlistmgmt';

  protected tools = [
    // === PRIORITY 1: PART LIST MANAGEMENT ===
    {
      name: 'list_part_lists',
      description: 'List all part lists (favorites/working lists) owned by user or across system',
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
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          },
          select: {
            type: 'string',
            description: 'Comma-separated list of properties to return'
          }
        },
        required: []
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();
        const filters = [];

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
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        if (params.select) {
          queryParams.append('$select', String(params.select));
        }

        const response = await this.api.get(
          `${apiEndpoints.partLists}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_part_list',
      description: 'Get detailed information for a specific part list',
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
          }
        },
        required: ['listId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.partLists}('${params.listId}')?${queryString}`
          : `${apiEndpoints.partLists}('${params.listId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'search_part_lists',
      description: 'Search for part lists by name or description',
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
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: ['query']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();
        const filters = [`(contains(Name,'${params.query}') or contains(Description,'${params.query}'))`];

        if (params.owner) {
          filters.push(`Owner eq '${params.owner}'`);
        }

        queryParams.append('$filter', filters.join(' and '));

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.partLists}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_part_list_items',
      description: 'Get all parts included in a specific part list',
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
          limit: {
            type: 'number',
            description: 'Maximum number of parts to return'
          }
        },
        required: ['listId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.partLists}('${params.listId}')/Parts?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 2: LIST OPERATIONS ===
    {
      name: 'add_part_to_list',
      description: 'Add a part to an existing part list (EXPERIMENTAL - requires POST support)',
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
          }
        },
        required: ['listId', 'partId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.post(
          `${apiEndpoints.partLists}('${params.listId}')/Parts`,
          {
            PartID: params.partId
          }
        );
        return response.data;
      }
    },
    {
      name: 'remove_part_from_list',
      description: 'Remove a part from a part list (EXPERIMENTAL - requires DELETE support)',
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
          }
        },
        required: ['listId', 'partId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.delete(
          `${apiEndpoints.partLists}('${params.listId}')/Parts('${params.partId}')`
        );
        return response.data;
      }
    },
    {
      name: 'create_part_list',
      description: 'Create a new part list (EXPERIMENTAL - requires POST support)',
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
            description: 'Whether the list should be shared'
          }
        },
        required: ['name']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.post(
          apiEndpoints.partLists,
          {
            Name: params.name,
            Description: params.description,
            Shared: params.shared || false
          }
        );
        return response.data;
      }
    },
    {
      name: 'delete_part_list',
      description: 'Delete a part list (EXPERIMENTAL - requires DELETE support)',
      inputSchema: {
        type: 'object',
        properties: {
          listId: {
            type: 'string',
            description: 'Part list OID to delete'
          }
        },
        required: ['listId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.delete(
          `${apiEndpoints.partLists}('${params.listId}')`
        );
        return response.data;
      }
    },
    {
      name: 'update_part_list',
      description: 'Update part list properties (EXPERIMENTAL - requires PATCH/PUT support)',
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
          }
        },
        required: ['listId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const updateData: any = {};
        if (params.name) updateData.Name = params.name;
        if (params.description) updateData.Description = params.description;
        if (params.shared !== undefined) updateData.Shared = params.shared;

        const response = await this.api.patch(
          `${apiEndpoints.partLists}('${params.listId}')`,
          updateData
        );
        return response.data;
      }
    },

    // === PRIORITY 3: SHARING & COLLABORATION ===
    {
      name: 'get_shared_lists',
      description: 'Get all part lists that have been shared with the current user',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: []
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        queryParams.append('$filter', 'Shared eq true');

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.partLists}?${queryParams.toString()}`
        );
        return response.data;
      }
    }
  ];
}
