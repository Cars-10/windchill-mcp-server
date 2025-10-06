import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * SavedSearchAgent provides tools for saved search management.
 *
 * **Features:**
 * - list_saved_searches: List saved searches
 * - get_saved_search: Get search details
 * - execute_saved_search: Execute a saved search
 */
export class SavedSearchAgent extends BaseAgent {
  protected agentName = 'savedsearch';

  protected tools = [
    {
      name: 'list_saved_searches',
      description: 'List saved searches',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Filter by owner'
          },
          shared: {
            type: 'boolean',
            description: 'Filter by shared status'
          },
          objectType: {
            type: 'string',
            description: 'Filter by object type searched'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results'
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

        if (params.objectType) {
          filters.push(`ObjectType eq '${params.objectType}'`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.savedSearches}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_saved_search',
      description: 'Get detailed saved search information',
      inputSchema: {
        type: 'object',
        properties: {
          searchId: {
            type: 'string',
            description: 'Saved search OID'
          }
        },
        required: ['searchId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(
          `${apiEndpoints.savedSearches}('${params.searchId}')`
        );
        return response.data;
      }
    },
    {
      name: 'execute_saved_search',
      description: 'Execute a saved search and get results (EXPERIMENTAL)',
      inputSchema: {
        type: 'object',
        properties: {
          searchId: {
            type: 'string',
            description: 'Saved search OID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results'
          }
        },
        required: ['searchId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.post(
          `${apiEndpoints.savedSearches}('${params.searchId}')/Execute?${queryParams.toString()}`,
          {}
        );
        return response.data;
      }
    }
  ];
}
