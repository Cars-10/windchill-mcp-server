/**
 * @fileoverview Service Info Management Agent - Token-Efficient MCP Tools
 *
 * **Module Requirement:** May require Windchill Service Information Manager
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

const SVC_FIELDS = ['ID', 'Name', 'Category', 'State'] as const;
const SVC_COLUMNS = { Name: 'Name', Category: 'Category', State: 'State' };
const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export class ServiceInfoMgmtAgent extends BaseAgent {
  protected agentName = 'serviceinfomgmt';

  protected tools: ToolDefinition[] = [
    {
      name: 'list_service_documents',
      description: `List service information documents (may require Service Info Manager).

**Parameters:** name (wildcards), category, limit/offset, response_format
**Example:** { "category": "Maintenance" }`,
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Document name filter' },
          category: { type: 'string', description: 'Filter by category' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List Service Documents', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.name) filters.push(buildTextFilter('Name', params.name));
          if (params.category) filters.push(`Category eq '${params.category}'`);
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));
          const response = await this.api.get(`${apiEndpoints.serviceInfo}/ServiceDocuments?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'Service Documents', conciseFields: SVC_FIELDS, markdownColumns: SVC_COLUMNS });
        } catch (error) { return buildErrorResponse(error, { operation: 'list service documents', suggestion: 'Ensure Service Info Manager module is licensed.' }); }
      }
    },
    {
      name: 'get_service_document',
      description: `Get service document details.

**Parameters:** documentId (required), response_format
**Example:** { "documentId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Service document OID' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['documentId']
      },
      annotations: { title: 'Get Service Document', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.serviceInfo}/ServiceDocuments('${params.documentId}')`);
          return buildSingleItemResponse(response.data, params, { title: `Service Document: ${params.documentId}`, conciseFields: SVC_FIELDS });
        } catch (error) { return buildErrorResponse(error, { operation: 'get service document' }); }
      }
    }
  ];
}
