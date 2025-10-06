import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * PTCAgent provides tools for PTC common utility entities.
 *
 * **Features:**
 * - list_entities: List common PTC entities
 * - get_entity: Get entity details
 * - get_entity_attributes: Get entity attributes
 */
export class PTCAgent extends BaseAgent {
  protected agentName = 'ptc';

  protected tools = [
    {
      name: 'list_entities',
      description: 'List PTC common entities (EXPERIMENTAL)',
      inputSchema: {
        type: 'object',
        properties: {
          entityType: {
            type: 'string',
            description: 'Filter by entity type'
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

        if (params.entityType) {
          queryParams.append('$filter', `EntityType eq '${params.entityType}'`);
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.ptc}/Entities?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_entity',
      description: 'Get detailed PTC entity information',
      inputSchema: {
        type: 'object',
        properties: {
          entityId: {
            type: 'string',
            description: 'Entity OID'
          }
        },
        required: ['entityId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(
          `${apiEndpoints.ptc}/Entities('${params.entityId}')`
        );
        return response.data;
      }
    }
  ];
}
