import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * VisualizationAgent provides tools for managing Creo View visualizations.
 *
 * **Module Requirement:** Requires Creo View/Windchill Visualization Services
 *
 * **Features:**
 * - list_visualizations: List visualization representations
 * - get_visualization: Get visualization details
 * - get_thumbnail: Get thumbnail URL for an object
 * - get_3d_view: Get 3D view representation
 */
export class VisualizationAgent extends BaseAgent {
  protected agentName = 'visualization';

  protected tools = [
    {
      name: 'list_visualizations',
      description: 'List visualization representations for objects',
      inputSchema: {
        type: 'object',
        properties: {
          sourceObjectId: {
            type: 'string',
            description: 'Source object OID to get visualizations for'
          },
          viewType: {
            type: 'string',
            description: 'Filter by view type (e.g., "3D", "2D", "Thumbnail")'
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

        if (params.sourceObjectId) {
          filters.push(`SourceObject eq '${params.sourceObjectId}'`);
        }

        if (params.viewType) {
          filters.push(`ViewType eq '${params.viewType}'`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.visualization}/Representations?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_visualization',
      description: 'Get detailed visualization information',
      inputSchema: {
        type: 'object',
        properties: {
          visualizationId: {
            type: 'string',
            description: 'Visualization OID'
          }
        },
        required: ['visualizationId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(
          `${apiEndpoints.visualization}/Representations('${params.visualizationId}')`
        );
        return response.data;
      }
    },
    {
      name: 'get_thumbnail',
      description: 'Get thumbnail URL for an object',
      inputSchema: {
        type: 'object',
        properties: {
          objectId: {
            type: 'string',
            description: 'Object OID (Part/Document)'
          }
        },
        required: ['objectId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(
          `${apiEndpoints.visualization}/Thumbnails('${params.objectId}')`
        );
        return response.data;
      }
    }
  ];
}
