/**
 * @fileoverview Manufacturing Agent - Token-Efficient MCP Tools for Windchill MPMLink
 *
 * **Module Requirement:** Requires Windchill MPMLink (Manufacturing Process Management)
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
  buildTextFilter,
  combineFilters,
  DEFAULT_LIMIT,
  MAX_LIMIT
} from '../utils/response-formatter.js';

const MFG_CONCISE_FIELDS = ['Number', 'Name', 'Type', 'State'] as const;
const MFG_MARKDOWN_COLUMNS = { Number: 'Number', Name: 'Name', Type: 'Type', State: 'State' };

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export class ManufacturingAgent extends BaseAgent {
  protected agentName = 'manufacturing';

  protected tools: ToolDefinition[] = [
    {
      name: 'list_mfg_parts',
      description: `List manufacturing parts (requires MPMLink).

**Parameters:** number, name (wildcards), limit/offset, response_format, detail_level
**Example:** { "number": "MFG*", "limit": 20 }`,
      inputSchema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Part number filter (wildcards)' },
          name: { type: 'string', description: 'Part name filter (wildcards)' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List Manufacturing Parts', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.number) filters.push(buildTextFilter('Number', params.number));
          if (params.name) filters.push(buildTextFilter('Name', params.name));
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));
          const response = await this.api.get(`${apiEndpoints.manufacturing}/ManufacturingParts?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'Manufacturing Parts', conciseFields: MFG_CONCISE_FIELDS, markdownColumns: MFG_MARKDOWN_COLUMNS });
        } catch (error) { return buildErrorResponse(error, { operation: 'list mfg parts', suggestion: 'Ensure MPMLink module is licensed.' }); }
      }
    },
    {
      name: 'get_mfg_part',
      description: `Get manufacturing part details.

**Parameters:** partId (required), expand, response_format, detail_level
**Example:** { "partId": "OR:wt.part.WTPart:12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          partId: { type: 'string', description: 'Manufacturing part OID' },
          expand: { type: 'string', description: 'Navigation properties to expand' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['partId']
      },
      annotations: { title: 'Get Manufacturing Part', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();
          if (params.expand) queryParams.append('$expand', params.expand);
          const url = queryParams.toString() ? `${apiEndpoints.manufacturing}/ManufacturingParts('${params.partId}')?${queryParams}` : `${apiEndpoints.manufacturing}/ManufacturingParts('${params.partId}')`;
          const response = await this.api.get(url);
          return buildSingleItemResponse(response.data, params, { title: `Mfg Part: ${params.partId}`, conciseFields: MFG_CONCISE_FIELDS });
        } catch (error) { return buildErrorResponse(error, { operation: 'get mfg part' }); }
      }
    },
    {
      name: 'list_process_plans',
      description: `List manufacturing process plans.

**Parameters:** name, state, limit/offset, response_format, detail_level
**Example:** { "name": "Assembly*" }`,
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Plan name filter' },
          state: { type: 'string', description: 'State filter' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List Process Plans', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.name) filters.push(buildTextFilter('Name', params.name));
          if (params.state) filters.push(`State eq '${params.state}'`);
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));
          const response = await this.api.get(`${apiEndpoints.manufacturing}/ProcessPlans?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'Process Plans', conciseFields: ['Name', 'State', 'Type'], markdownColumns: { Name: 'Name', State: 'State', Type: 'Type' } });
        } catch (error) { return buildErrorResponse(error, { operation: 'list process plans' }); }
      }
    },
    {
      name: 'get_process_plan',
      description: `Get process plan details.

**Parameters:** planId (required), expand, response_format, detail_level
**Example:** { "planId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'Process plan OID' },
          expand: { type: 'string', description: 'Navigation properties to expand' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['planId']
      },
      annotations: { title: 'Get Process Plan', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();
          if (params.expand) queryParams.append('$expand', params.expand);
          const url = queryParams.toString() ? `${apiEndpoints.manufacturing}/ProcessPlans('${params.planId}')?${queryParams}` : `${apiEndpoints.manufacturing}/ProcessPlans('${params.planId}')`;
          const response = await this.api.get(url);
          return buildSingleItemResponse(response.data, params, { title: `Process Plan: ${params.planId}`, conciseFields: ['Name', 'State', 'Type', 'Description'] });
        } catch (error) { return buildErrorResponse(error, { operation: 'get process plan' }); }
      }
    },
    {
      name: 'list_operations',
      description: `List manufacturing operations.

**Parameters:** planId (filter by plan), name, limit/offset, response_format
**Example:** { "planId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'Filter by process plan OID' },
          name: { type: 'string', description: 'Operation name filter' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'List Operations', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.planId) filters.push(`ProcessPlan eq '${params.planId}'`);
          if (params.name) filters.push(buildTextFilter('Name', params.name));
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));
          const response = await this.api.get(`${apiEndpoints.manufacturing}/Operations?${queryParams.toString()}`);
          return buildListResponse(response.data, params, { title: 'Operations', conciseFields: ['Name', 'Sequence', 'Type'], markdownColumns: { Name: 'Name', Sequence: 'Seq', Type: 'Type' } });
        } catch (error) { return buildErrorResponse(error, { operation: 'list operations' }); }
      }
    },
    {
      name: 'get_operation',
      description: `Get operation details.

**Parameters:** operationId (required), expand, response_format
**Example:** { "operationId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          operationId: { type: 'string', description: 'Operation OID' },
          expand: { type: 'string', description: 'Navigation properties to expand' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['operationId']
      },
      annotations: { title: 'Get Operation', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();
          if (params.expand) queryParams.append('$expand', params.expand);
          const url = queryParams.toString() ? `${apiEndpoints.manufacturing}/Operations('${params.operationId}')?${queryParams}` : `${apiEndpoints.manufacturing}/Operations('${params.operationId}')`;
          const response = await this.api.get(url);
          return buildSingleItemResponse(response.data, params, { title: `Operation: ${params.operationId}`, conciseFields: ['Name', 'Sequence', 'Type', 'Description'] });
        } catch (error) { return buildErrorResponse(error, { operation: 'get operation' }); }
      }
    }
  ];
}
