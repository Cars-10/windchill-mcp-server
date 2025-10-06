import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * EffectivityMgmtAgent provides tools for managing effectivity (date/unit ranges).
 *
 * **Features:**
 * - list_effectivities: List effectivity definitions
 * - get_effectivity: Get effectivity details
 * - get_effective_items: Get items effective in a date/unit range
 */
export class EffectivityMgmtAgent extends BaseAgent {
  protected agentName = 'effectivitymgmt';

  protected tools = [
    {
      name: 'list_effectivities',
      description: 'List effectivity definitions',
      inputSchema: {
        type: 'object',
        properties: {
          effectivityType: {
            type: 'string',
            description: 'Filter by type (Date or Unit)',
            enum: ['Date', 'Unit']
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

        if (params.effectivityType) {
          queryParams.append('$filter', `EffectivityType eq '${params.effectivityType}'`);
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.effectivity}/Effectivities?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_effectivity',
      description: 'Get detailed effectivity information',
      inputSchema: {
        type: 'object',
        properties: {
          effectivityId: {
            type: 'string',
            description: 'Effectivity OID'
          }
        },
        required: ['effectivityId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(
          `${apiEndpoints.effectivity}/Effectivities('${params.effectivityId}')`
        );
        return response.data;
      }
    }
  ];
}
