/**
 * @fileoverview CAD Document Management Agent - Token-Efficient MCP Tools
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

const CAD_FIELDS = ['Number', 'Name', 'CADType', 'State'] as const;
const CAD_COLUMNS = { Number: 'Number', Name: 'Name', CADType: 'CAD Type', State: 'State' };
const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export class CADDocumentMgmtAgent extends BaseAgent {
  protected agentName = 'caddocumentmgmt';

  protected tools: ToolDefinition[] = [
    {
      name: 'list_cad_documents',
      description: `List CAD documents (Creo, SOLIDWORKS, etc.).

**Parameters:** cadType, name (wildcards), limit/offset, response_format
**Example:** { "cadType": "Creo", "limit": 20 }`,
      inputSchema: {
        type: 'object',
        properties: {
          cadType: { type: 'string', description: 'CAD type (Creo, SOLIDWORKS)' },
          name: { type: 'string', description: 'Document name filter' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List CAD Documents', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.cadType) filters.push(`CADType eq '${params.cadType}'`);
          if (params.name) filters.push(buildTextFilter('Name', params.name));
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));
          const response = await this.api.get(`${apiEndpoints.cadDocuments}/CADDocuments?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'CAD Documents', conciseFields: CAD_FIELDS, markdownColumns: CAD_COLUMNS });
        } catch (error) { return buildErrorResponse(error, { operation: 'list CAD documents' }); }
      }
    },
    {
      name: 'get_cad_document',
      description: `Get CAD document details.

**Parameters:** documentId (required), response_format
**Example:** { "documentId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'CAD document OID' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['documentId']
      },
      annotations: { title: 'Get CAD Document', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.cadDocuments}/CADDocuments('${params.documentId}')`);
          return buildSingleItemResponse(response.data, params, { title: `CAD Document: ${params.documentId}`, conciseFields: CAD_FIELDS });
        } catch (error) { return buildErrorResponse(error, { operation: 'get CAD document' }); }
      }
    }
  ];
}
