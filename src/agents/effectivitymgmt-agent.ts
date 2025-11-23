/**
 * @fileoverview Effectivity Management Agent - Token-Efficient MCP Tools
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
  buildODataPagination
} from '../utils/response-formatter.js';

const EFF_FIELDS = ['ID', 'Name', 'EffectivityType', 'StartDate', 'EndDate'] as const;
const EFF_COLUMNS = { Name: 'Name', EffectivityType: 'Type', StartDate: 'Start', EndDate: 'End' };
const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export class EffectivityMgmtAgent extends BaseAgent {
  protected agentName = 'effectivitymgmt';

  protected tools: ToolDefinition[] = [
    {
      name: 'list_effectivities',
      description: `List effectivity definitions.

**Parameters:** effectivityType (Date/Unit), limit/offset, response_format
**Example:** { "effectivityType": "Date" }`,
      inputSchema: {
        type: 'object',
        properties: {
          effectivityType: { type: 'string', enum: ['Date', 'Unit'], description: 'Filter by type' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List Effectivities', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);
          if (params.effectivityType) queryParams.append('$filter', `EffectivityType eq '${params.effectivityType}'`);
          const response = await this.api.get(`${apiEndpoints.effectivity}/Effectivities?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'Effectivities', conciseFields: EFF_FIELDS, markdownColumns: EFF_COLUMNS });
        } catch (error) { return buildErrorResponse(error, { operation: 'list effectivities' }); }
      }
    },
    {
      name: 'get_effectivity',
      description: `Get effectivity details.

**Parameters:** effectivityId (required), response_format
**Example:** { "effectivityId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          effectivityId: { type: 'string', description: 'Effectivity OID' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['effectivityId']
      },
      annotations: { title: 'Get Effectivity', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.effectivity}/Effectivities('${params.effectivityId}')`);
          return buildSingleItemResponse(response.data, params, { title: `Effectivity: ${params.effectivityId}`, conciseFields: EFF_FIELDS });
        } catch (error) { return buildErrorResponse(error, { operation: 'get effectivity' }); }
      }
    }
  ];
}
