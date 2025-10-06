import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * ManufacturingAgent provides tools for managing Windchill manufacturing data.
 *
 * This agent exposes the Factory and MfgProcMgmt Domain capabilities for manufacturing
 * parts, process plans, operations, and work instructions.
 *
 * **Module Requirement:** Requires Windchill MPMLink (Manufacturing Process Management)
 *
 * **Priority 1 - Manufacturing Parts:**
 * - list_mfg_parts: List all manufacturing parts
 * - get_mfg_part: Get detailed manufacturing part information
 * - search_mfg_parts: Search manufacturing parts
 *
 * **Priority 2 - Process Plans:**
 * - list_process_plans: List all process plans
 * - get_process_plan: Get detailed process plan
 * - get_plan_operations: Get operations in a process plan
 *
 * **Priority 3 - Operations:**
 * - list_operations: List manufacturing operations
 * - get_operation: Get detailed operation information
 * - get_operation_resources: Get resources assigned to an operation
 *
 * **Note:** This domain requires Windchill MPMLink module. May not be available
 * in all Windchill installations. Tools marked EXPERIMENTAL may require custom configuration.
 */
export class ManufacturingAgent extends BaseAgent {
  protected agentName = 'manufacturing';

  protected tools = [
    // === PRIORITY 1: MANUFACTURING PARTS ===
    {
      name: 'list_mfg_parts',
      description: 'List all manufacturing parts (requires MPMLink module)',
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Filter by part number (partial match)'
          },
          name: {
            type: 'string',
            description: 'Filter by part name (partial match)'
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

        if (params.number) {
          filters.push(`contains(Number,'${params.number}')`);
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
          `${apiEndpoints.manufacturing}/ManufacturingParts?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_mfg_part',
      description: 'Get detailed information for a manufacturing part',
      inputSchema: {
        type: 'object',
        properties: {
          partId: {
            type: 'string',
            description: 'Manufacturing part OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "ProcessPlan,Operations")'
          }
        },
        required: ['partId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.manufacturing}/ManufacturingParts('${params.partId}')?${queryString}`
          : `${apiEndpoints.manufacturing}/ManufacturingParts('${params.partId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'search_mfg_parts',
      description: 'Search manufacturing parts by various criteria',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for number or name'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: ['query']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        queryParams.append('$filter', `(contains(Number,'${params.query}') or contains(Name,'${params.query}'))`);

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.manufacturing}/ManufacturingParts?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 2: PROCESS PLANS ===
    {
      name: 'list_process_plans',
      description: 'List all manufacturing process plans',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by process plan name (partial match)'
          },
          partId: {
            type: 'string',
            description: 'Filter by associated manufacturing part'
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

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (params.partId) {
          filters.push(`PartID eq '${params.partId}'`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.mfgProcesses}/ProcessPlans?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_process_plan',
      description: 'Get detailed information for a specific process plan',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Process plan OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "Operations,Resources")'
          }
        },
        required: ['planId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.mfgProcesses}/ProcessPlans('${params.planId}')?${queryString}`
          : `${apiEndpoints.mfgProcesses}/ProcessPlans('${params.planId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'get_plan_operations',
      description: 'Get all operations in a process plan',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Process plan OID'
          },
          orderBy: {
            type: 'string',
            description: 'Order by sequence (e.g., "Sequence asc")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of operations to return'
          }
        },
        required: ['planId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.orderBy) {
          queryParams.append('$orderby', String(params.orderBy));
        } else {
          queryParams.append('$orderby', 'Sequence asc');
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.mfgProcesses}/ProcessPlans('${params.planId}')/Operations?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 3: OPERATIONS ===
    {
      name: 'list_operations',
      description: 'List manufacturing operations',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by operation name (partial match)'
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

        if (params.name) {
          queryParams.append('$filter', `contains(Name,'${params.name}')`);
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.mfgProcesses}/Operations?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_operation',
      description: 'Get detailed information for a manufacturing operation',
      inputSchema: {
        type: 'object',
        properties: {
          operationId: {
            type: 'string',
            description: 'Operation OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "Resources,WorkInstructions")'
          }
        },
        required: ['operationId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.mfgProcesses}/Operations('${params.operationId}')?${queryString}`
          : `${apiEndpoints.mfgProcesses}/Operations('${params.operationId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'get_operation_resources',
      description: 'Get resources (tools, equipment) assigned to an operation',
      inputSchema: {
        type: 'object',
        properties: {
          operationId: {
            type: 'string',
            description: 'Operation OID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of resources to return'
          }
        },
        required: ['operationId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.mfgProcesses}/Operations('${params.operationId}')/Resources?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_work_instructions',
      description: 'Get work instructions for a manufacturing operation',
      inputSchema: {
        type: 'object',
        properties: {
          operationId: {
            type: 'string',
            description: 'Operation OID'
          }
        },
        required: ['operationId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(
          `${apiEndpoints.mfgProcesses}/Operations('${params.operationId}')/WorkInstructions`
        );
        return response.data;
      }
    }
  ];
}
