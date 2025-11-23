/**
 * @fileoverview Saved Search Agent - Token-Efficient MCP Tools
 */

import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolDefinition, ToolAnnotations } from '../types/common.js';
import {
  STANDARD_LIST_SCHEMA_PROPS,
  FORMAT_SCHEMA_PROPS,
  buildListResponse,
  buildSingleItemResponse,
  buildErrorResponse,
  buildODataPagination,
  combineFilters
} from '../utils/response-formatter.js';

const SEARCH_FIELDS = ['ID', 'Name', 'Owner', 'Shared', 'ObjectType'] as const;
const SEARCH_COLUMNS = { Name: 'Name', Owner: 'Owner', Shared: 'Shared', ObjectType: 'Type' };
const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export class SavedSearchAgent extends BaseAgent {
  protected agentName = 'savedsearch';

  protected tools: ToolDefinition[] = [
    {
      name: 'list_saved_searches',
      description: `List saved searches.

**Parameters:** owner, shared (bool), objectType, limit/offset, response_format
**Example:** { "shared": true }`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Filter by owner' },
          shared: { type: 'boolean', description: 'Filter by shared status' },
          objectType: { type: 'string', description: 'Filter by object type searched' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List Saved Searches', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.owner) filters.push(`Owner eq '${params.owner}'`);
          if (params.shared !== undefined) filters.push(`Shared eq ${params.shared}`);
          if (params.objectType) filters.push(`ObjectType eq '${params.objectType}'`);
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));
          const response = await this.api.get(`${apiEndpoints.savedSearches}?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'Saved Searches', conciseFields: SEARCH_FIELDS, markdownColumns: SEARCH_COLUMNS });
        } catch (error) { return buildErrorResponse(error, { operation: 'list saved searches' }); }
      }
    },
    {
      name: 'get_saved_search',
      description: `Get saved search details.

**Parameters:** searchId (required), response_format
**Example:** { "searchId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          searchId: { type: 'string', description: 'Saved search OID' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['searchId']
      },
      annotations: { title: 'Get Saved Search', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.savedSearches}('${params.searchId}')`);
          return buildSingleItemResponse(response.data, params, { title: `Saved Search: ${params.searchId}`, conciseFields: SEARCH_FIELDS });
        } catch (error) { return buildErrorResponse(error, { operation: 'get saved search' }); }
      }
    },
    {
      name: 'execute_saved_search',
      description: `Execute a saved search and return results.

**Parameters:** searchId (required), limit/offset, response_format
**Example:** { "searchId": "12345", "limit": 50 }`,
      inputSchema: {
        type: 'object',
        properties: {
          searchId: { type: 'string', description: 'Saved search OID' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['searchId']
      },
      annotations: { title: 'Execute Saved Search', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);
          const response = await this.api.get(`${apiEndpoints.savedSearches}('${params.searchId}')/Execute?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: `Search Results: ${params.searchId}`, conciseFields: ['Number', 'Name', 'Type', 'State'], markdownColumns: { Number: 'Number', Name: 'Name', Type: 'Type', State: 'State' } });
        } catch (error) { return buildErrorResponse(error, { operation: 'execute saved search' }); }
      }
    }
  ];
}
