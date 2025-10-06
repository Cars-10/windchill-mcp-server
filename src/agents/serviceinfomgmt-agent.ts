import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * ServiceInfoMgmtAgent provides tools for service information/technical publications.
 *
 * **Module Requirement:** May require Windchill Service Information Manager
 *
 * **Features:**
 * - list_service_documents: List service information documents
 * - get_service_document: Get service document details
 * - search_service_info: Search service information
 */
export class ServiceInfoMgmtAgent extends BaseAgent {
  protected agentName = 'serviceinfomgmt';

  protected tools = [
    {
      name: 'list_service_documents',
      description: 'List service information documents',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by document name'
          },
          category: {
            type: 'string',
            description: 'Filter by category'
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

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (params.category) {
          filters.push(`Category eq '${params.category}'`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.serviceInfo}/ServiceDocuments?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_service_document',
      description: 'Get detailed service document information',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: {
            type: 'string',
            description: 'Service document OID'
          }
        },
        required: ['documentId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(
          `${apiEndpoints.serviceInfo}/ServiceDocuments('${params.documentId}')`
        );
        return response.data;
      }
    }
  ];
}
