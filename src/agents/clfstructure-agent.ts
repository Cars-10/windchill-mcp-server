/**
 * @fileoverview Classification Structure Agent - Token-Efficient MCP Tools
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
  buildTextFilter,
  combineFilters
} from '../utils/response-formatter.js';

const CLF_FIELDS = ['ID', 'Name', 'Description', 'ParentNode'] as const;
const CLF_COLUMNS = { Name: 'Name', Description: 'Description', ParentNode: 'Parent' };
const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export class ClfStructureAgent extends BaseAgent {
  protected agentName = 'clfstructure';

  protected tools: ToolDefinition[] = [
    {
      name: 'list_classification_nodes',
      description: `List classification/taxonomy nodes.

**Parameters:** parentNode, name (wildcards), limit/offset, response_format
**Example:** { "parentNode": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          parentNode: { type: 'string', description: 'Filter by parent node OID' },
          name: { type: 'string', description: 'Node name filter' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List Classification Nodes', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.parentNode) filters.push(`ParentNode eq '${params.parentNode}'`);
          if (params.name) filters.push(buildTextFilter('Name', params.name));
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));
          const response = await this.api.get(`${apiEndpoints.classification}/ClassificationNodes?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'Classification Nodes', conciseFields: CLF_FIELDS, markdownColumns: CLF_COLUMNS });
        } catch (error) { return buildErrorResponse(error, { operation: 'list classification nodes' }); }
      }
    },
    {
      name: 'get_classification_node',
      description: `Get classification node details.

**Parameters:** nodeId (required), response_format
**Example:** { "nodeId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Classification node OID' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['nodeId']
      },
      annotations: { title: 'Get Classification Node', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.classification}/ClassificationNodes('${params.nodeId}')`);
          return buildSingleItemResponse(response.data, params, { title: `Classification Node: ${params.nodeId}`, conciseFields: CLF_FIELDS });
        } catch (error) { return buildErrorResponse(error, { operation: 'get classification node' }); }
      }
    }
  ];
}
