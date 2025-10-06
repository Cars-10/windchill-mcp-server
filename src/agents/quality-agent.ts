import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * QualityAgent provides tools for managing Windchill quality management data.
 *
 * This agent exposes Quality Management Domain capabilities for inspections,
 * nonconformance reports, and corrective actions.
 *
 * **Module Requirement:** Requires Windchill Quality Management Solutions (QMS) module
 *
 * **Priority 1 - Quality Inspections:**
 * - list_inspections: List quality inspections
 * - get_inspection: Get detailed inspection information
 * - search_inspections: Search inspections by criteria
 *
 * **Priority 2 - Nonconformance Reports:**
 * - list_nonconformances: List nonconformance reports
 * - get_nonconformance: Get detailed NCR information
 * - search_nonconformances: Search NCRs
 *
 * **Priority 3 - Corrective Actions:**
 * - list_corrective_actions: List corrective actions
 * - get_corrective_action: Get detailed corrective action
 *
 * **Note:** This domain requires Windchill QMS module. May not be available in all installations.
 */
export class QualityAgent extends BaseAgent {
  protected agentName = 'quality';

  protected tools = [
    // === PRIORITY 1: QUALITY INSPECTIONS ===
    {
      name: 'list_inspections',
      description: 'List all quality inspections (requires QMS module)',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by inspection status (e.g., "Open", "Closed")'
          },
          inspectionType: {
            type: 'string',
            description: 'Filter by inspection type'
          },
          dateAfter: {
            type: 'string',
            description: 'Filter by inspection date (ISO 8601 format)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: []
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();
        const filters = [];

        if (params.status) {
          filters.push(`Status eq '${params.status}'`);
        }

        if (params.inspectionType) {
          filters.push(`InspectionType eq '${params.inspectionType}'`);
        }

        if (params.dateAfter) {
          filters.push(`InspectionDate ge ${params.dateAfter}`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.quality}/Inspections?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_inspection',
      description: 'Get detailed information for a quality inspection',
      inputSchema: {
        type: 'object',
        properties: {
          inspectionId: {
            type: 'string',
            description: 'Inspection OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand'
          }
        },
        required: ['inspectionId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.quality}/Inspections('${params.inspectionId}')?${queryString}`
          : `${apiEndpoints.quality}/Inspections('${params.inspectionId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'search_inspections',
      description: 'Search quality inspections by criteria',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results'
          }
        },
        required: ['query']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        queryParams.append('$filter', `contains(Name,'${params.query}')`);

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.quality}/Inspections?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 2: NONCONFORMANCE REPORTS ===
    {
      name: 'list_nonconformances',
      description: 'List nonconformance reports (NCRs)',
      inputSchema: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            description: 'Filter by severity level'
          },
          status: {
            type: 'string',
            description: 'Filter by NCR status'
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

        if (params.severity) {
          filters.push(`Severity eq '${params.severity}'`);
        }

        if (params.status) {
          filters.push(`Status eq '${params.status}'`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.quality}/Nonconformances?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_nonconformance',
      description: 'Get detailed nonconformance report information',
      inputSchema: {
        type: 'object',
        properties: {
          ncrId: {
            type: 'string',
            description: 'NCR OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand'
          }
        },
        required: ['ncrId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.quality}/Nonconformances('${params.ncrId}')?${queryString}`
          : `${apiEndpoints.quality}/Nonconformances('${params.ncrId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'search_nonconformances',
      description: 'Search nonconformance reports',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results'
          }
        },
        required: ['query']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        queryParams.append('$filter', `(contains(Number,'${params.query}') or contains(Description,'${params.query}'))`);

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.quality}/Nonconformances?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 3: CORRECTIVE ACTIONS ===
    {
      name: 'list_corrective_actions',
      description: 'List corrective actions',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by status'
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

        if (params.status) {
          queryParams.append('$filter', `Status eq '${params.status}'`);
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.quality}/CorrectiveActions?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_corrective_action',
      description: 'Get detailed corrective action information',
      inputSchema: {
        type: 'object',
        properties: {
          actionId: {
            type: 'string',
            description: 'Corrective action OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand'
          }
        },
        required: ['actionId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.quality}/CorrectiveActions('${params.actionId}')?${queryString}`
          : `${apiEndpoints.quality}/CorrectiveActions('${params.actionId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    }
  ];
}
