import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * ClfStructureAgent provides tools for classification/taxonomy management.
 *
 * **Features:**
 * - list_classification_nodes: List classification nodes
 * - get_classification_node: Get node details
 * - get_child_nodes: Get child nodes in hierarchy
 */
export class ClfStructureAgent extends BaseAgent {
  protected agentName = 'clfstructure';

  protected tools = [
    {
      name: 'list_classification_nodes',
      description: 'List classification/taxonomy nodes',
      inputSchema: {
        type: 'object',
        properties: {
          parentNode: {
            type: 'string',
            description: 'Filter by parent node OID'
          },
          name: {
            type: 'string',
            description: 'Filter by node name'
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

        if (params.parentNode) {
          filters.push(`ParentNode eq '${params.parentNode}'`);
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

        const response = await this.api.get(
          `${apiEndpoints.classification}/ClassificationNodes?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_classification_node',
      description: 'Get detailed classification node information',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'string',
            description: 'Classification node OID'
          }
        },
        required: ['nodeId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(
          `${apiEndpoints.classification}/ClassificationNodes('${params.nodeId}')`
        );
        return response.data;
      }
    }
  ];
}
