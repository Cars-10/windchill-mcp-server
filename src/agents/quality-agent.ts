/**
 * @fileoverview Quality Agent - Token-Efficient MCP Tools for Windchill QMS
 *
 * **Module Requirement:** Requires Windchill Quality Management Solutions (QMS)
 */

import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolDefinition, ToolAnnotations } from '../types/common.js';
import {
  ResponseFormat,
  STANDARD_LIST_SCHEMA_PROPS,
  FORMAT_SCHEMA_PROPS,
  buildListResponse,
  buildSingleItemResponse,
  buildErrorResponse,
  buildODataPagination,
  combineFilters,
  DEFAULT_LIMIT,
  MAX_LIMIT
} from '../utils/response-formatter.js';

const INSPECTION_FIELDS = ['Number', 'Status', 'InspectionType', 'InspectionDate'] as const;
const INSPECTION_COLUMNS = { Number: 'Number', Status: 'Status', InspectionType: 'Type', InspectionDate: 'Date' };
const NCR_FIELDS = ['Number', 'Status', 'Severity', 'CreatedOn'] as const;
const NCR_COLUMNS = { Number: 'Number', Status: 'Status', Severity: 'Severity', CreatedOn: 'Created' };

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export class QualityAgent extends BaseAgent {
  protected agentName = 'quality';

  protected tools: ToolDefinition[] = [
    {
      name: 'list_inspections',
      description: `List quality inspections (requires QMS).

**Parameters:** status, inspectionType, dateAfter, limit/offset, response_format
**Example:** { "status": "Open", "limit": 20 }`,
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Inspection status (Open, Closed)' },
          inspectionType: { type: 'string', description: 'Inspection type' },
          dateAfter: { type: 'string', description: 'Date filter (ISO 8601)' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List Inspections', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.status) filters.push(`Status eq '${params.status}'`);
          if (params.inspectionType) filters.push(`InspectionType eq '${params.inspectionType}'`);
          if (params.dateAfter) filters.push(`InspectionDate ge ${params.dateAfter}`);
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));
          const response = await this.api.get(`${apiEndpoints.quality}/Inspections?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'Inspections', conciseFields: INSPECTION_FIELDS, markdownColumns: INSPECTION_COLUMNS });
        } catch (error) { return buildErrorResponse(error, { operation: 'list inspections', suggestion: 'Ensure QMS module is licensed.' }); }
      }
    },
    {
      name: 'get_inspection',
      description: `Get inspection details.

**Parameters:** inspectionId (required), expand, response_format
**Example:** { "inspectionId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          inspectionId: { type: 'string', description: 'Inspection OID' },
          expand: { type: 'string', description: 'Navigation properties' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['inspectionId']
      },
      annotations: { title: 'Get Inspection', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();
          if (params.expand) queryParams.append('$expand', params.expand);
          const url = queryParams.toString() ? `${apiEndpoints.quality}/Inspections('${params.inspectionId}')?${queryParams}` : `${apiEndpoints.quality}/Inspections('${params.inspectionId}')`;
          const response = await this.api.get(url);
          return buildSingleItemResponse(response.data, params, { title: `Inspection: ${params.inspectionId}`, conciseFields: INSPECTION_FIELDS });
        } catch (error) { return buildErrorResponse(error, { operation: 'get inspection' }); }
      }
    },
    {
      name: 'list_nonconformances',
      description: `List nonconformance reports (NCRs).

**Parameters:** status, severity, dateAfter, limit/offset, response_format
**Example:** { "severity": "Critical" }`,
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'NCR status' },
          severity: { type: 'string', description: 'Severity level' },
          dateAfter: { type: 'string', description: 'Created after (ISO 8601)' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List NCRs', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.status) filters.push(`Status eq '${params.status}'`);
          if (params.severity) filters.push(`Severity eq '${params.severity}'`);
          if (params.dateAfter) filters.push(`CreatedOn ge ${params.dateAfter}`);
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));
          const response = await this.api.get(`${apiEndpoints.quality}/NonconformanceReports?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'Nonconformance Reports', conciseFields: NCR_FIELDS, markdownColumns: NCR_COLUMNS });
        } catch (error) { return buildErrorResponse(error, { operation: 'list NCRs' }); }
      }
    },
    {
      name: 'get_nonconformance',
      description: `Get NCR details.

**Parameters:** ncrId (required), expand, response_format
**Example:** { "ncrId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          ncrId: { type: 'string', description: 'NCR OID' },
          expand: { type: 'string', description: 'Navigation properties' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['ncrId']
      },
      annotations: { title: 'Get NCR', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();
          if (params.expand) queryParams.append('$expand', params.expand);
          const url = queryParams.toString() ? `${apiEndpoints.quality}/NonconformanceReports('${params.ncrId}')?${queryParams}` : `${apiEndpoints.quality}/NonconformanceReports('${params.ncrId}')`;
          const response = await this.api.get(url);
          return buildSingleItemResponse(response.data, params, { title: `NCR: ${params.ncrId}`, conciseFields: NCR_FIELDS });
        } catch (error) { return buildErrorResponse(error, { operation: 'get NCR' }); }
      }
    },
    {
      name: 'list_corrective_actions',
      description: `List corrective actions.

**Parameters:** status, priority, limit/offset, response_format
**Example:** { "status": "Open" }`,
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Action status' },
          priority: { type: 'string', description: 'Priority level' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List Corrective Actions', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.status) filters.push(`Status eq '${params.status}'`);
          if (params.priority) filters.push(`Priority eq '${params.priority}'`);
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));
          const response = await this.api.get(`${apiEndpoints.quality}/CorrectiveActions?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'Corrective Actions', conciseFields: ['Number', 'Status', 'Priority', 'DueDate'], markdownColumns: { Number: 'Number', Status: 'Status', Priority: 'Priority', DueDate: 'Due' } });
        } catch (error) { return buildErrorResponse(error, { operation: 'list corrective actions' }); }
      }
    },
    {
      name: 'get_corrective_action',
      description: `Get corrective action details.

**Parameters:** actionId (required), expand, response_format
**Example:** { "actionId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          actionId: { type: 'string', description: 'Corrective action OID' },
          expand: { type: 'string', description: 'Navigation properties' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['actionId']
      },
      annotations: { title: 'Get Corrective Action', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();
          if (params.expand) queryParams.append('$expand', params.expand);
          const url = queryParams.toString() ? `${apiEndpoints.quality}/CorrectiveActions('${params.actionId}')?${queryParams}` : `${apiEndpoints.quality}/CorrectiveActions('${params.actionId}')`;
          const response = await this.api.get(url);
          return buildSingleItemResponse(response.data, params, { title: `Corrective Action: ${params.actionId}`, conciseFields: ['Number', 'Status', 'Priority', 'Description'] });
        } catch (error) { return buildErrorResponse(error, { operation: 'get corrective action' }); }
      }
    }
  ];
}
