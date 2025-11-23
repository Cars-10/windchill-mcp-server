/**
 * @fileoverview PTC Agent - Token-Efficient MCP Tools for PTC Common Utilities
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

const ENTITY_FIELDS = ['ID', 'Name', 'EntityType', 'Description'] as const;
const ENTITY_COLUMNS = { Name: 'Name', EntityType: 'Type', Description: 'Description' };
const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export class PTCAgent extends BaseAgent {
  protected agentName = 'ptc';

  protected tools: ToolDefinition[] = [
    {
      name: 'list_entities',
      description: `List PTC common entities (EXPERIMENTAL).

**Parameters:** entityType, limit/offset, response_format
**Example:** { "entityType": "WTPart" }`,
      inputSchema: {
        type: 'object',
        properties: {
          entityType: { type: 'string', description: 'Filter by entity type' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List PTC Entities', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);
          if (params.entityType) queryParams.append('$filter', `EntityType eq '${params.entityType}'`);
          const response = await this.api.get(`${apiEndpoints.ptc}/Entities?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'PTC Entities', conciseFields: ENTITY_FIELDS, markdownColumns: ENTITY_COLUMNS });
        } catch (error) { return buildErrorResponse(error, { operation: 'list PTC entities' }); }
      }
    },
    {
      name: 'get_entity',
      description: `Get PTC entity details.

**Parameters:** entityId (required), response_format
**Example:** { "entityId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          entityId: { type: 'string', description: 'Entity OID' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['entityId']
      },
      annotations: { title: 'Get PTC Entity', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.ptc}/Entities('${params.entityId}')`);
          return buildSingleItemResponse(response.data, params, { title: `PTC Entity: ${params.entityId}`, conciseFields: ENTITY_FIELDS });
        } catch (error) { return buildErrorResponse(error, { operation: 'get PTC entity' }); }
      }
    }
  ];
}
