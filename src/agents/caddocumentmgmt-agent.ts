import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * CADDocumentMgmtAgent provides tools for CAD-specific document operations.
 *
 * **Features:**
 * - list_cad_documents: List CAD documents
 * - get_cad_document: Get CAD document details
 * - get_cad_structure: Get CAD assembly structure
 */
export class CADDocumentMgmtAgent extends BaseAgent {
  protected agentName = 'caddocumentmgmt';

  protected tools = [
    {
      name: 'list_cad_documents',
      description: 'List CAD documents (Creo, SOLIDWORKS, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          cadType: {
            type: 'string',
            description: 'Filter by CAD type (e.g., "Creo", "SOLIDWORKS")'
          },
          name: {
            type: 'string',
            description: 'Filter by document name'
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

        if (params.cadType) {
          filters.push(`CADType eq '${params.cadType}'`);
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
          `${apiEndpoints.cadDocuments}/CADDocuments?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_cad_document',
      description: 'Get detailed CAD document information',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: {
            type: 'string',
            description: 'CAD document OID'
          }
        },
        required: ['documentId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(
          `${apiEndpoints.cadDocuments}/CADDocuments('${params.documentId}')`
        );
        return response.data;
      }
    }
  ];
}
