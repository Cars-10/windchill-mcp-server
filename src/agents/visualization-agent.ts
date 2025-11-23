/**
 * @fileoverview Visualization Agent - Token-Efficient MCP Tools for Creo View
 *
 * Provides tools for managing Creo View visualizations with token-efficient responses.
 *
 * **Module Requirement:** Requires Creo View/Windchill Visualization Services
 */

import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolDefinition, ToolAnnotations, ToolParams, ToolResult } from '../types/common.js';
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

// ============================================================================
// CONSTANTS
// ============================================================================

const VIZ_CONCISE_FIELDS = ['ID', 'Name', 'ViewType', 'SourceObject', 'CreatedOn'] as const;

const VIZ_MARKDOWN_COLUMNS = {
  ID: 'ID',
  Name: 'Name',
  ViewType: 'Type',
  SourceObject: 'Source',
  CreatedOn: 'Created'
};

// ============================================================================
// TOOL ANNOTATIONS
// ============================================================================

const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

// ============================================================================
// VISUALIZATION AGENT
// ============================================================================

/**
 * VisualizationAgent provides tools for managing Creo View visualizations.
 *
 * All tools support:
 * - `response_format`: 'markdown' (default) or 'json'
 * - `detail_level`: 'concise' (default) or 'detailed'
 */
export class VisualizationAgent extends BaseAgent {
  protected agentName = 'visualization';

  protected tools: ToolDefinition[] = [
    {
      name: 'list_visualizations',
      description: `List visualization representations for objects.

**Module:** Requires Creo View/Windchill Visualization Services

**Parameters:**
- sourceObjectId: Source object OID to filter visualizations
- viewType: Filter by type (e.g., "3D", "2D", "Thumbnail")
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of visualization representations

**Example:** { "sourceObjectId": "VR:wt.part.WTPart:12345" }`,
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
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Visualizations',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        try {
          const filters: string[] = [];

          if (params.sourceObjectId) {
            filters.push(`SourceObject eq '${params.sourceObjectId}'`);
          }

          if (params.viewType) {
            filters.push(`ViewType eq '${params.viewType}'`);
          }

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.visualization}/Representations?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Visualizations',
            conciseFields: VIZ_CONCISE_FIELDS,
            markdownColumns: VIZ_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list visualizations',
            suggestion: 'Verify Creo View is installed and the object OID is valid.'
          });
        }
      }
    },

    {
      name: 'get_visualization',
      description: `Get detailed visualization information.

**Module:** Requires Creo View/Windchill Visualization Services

**Parameters:**
- visualizationId (required): Visualization OID
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Visualization details

**Example:** { "visualizationId": "VR:wt.representation:12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          visualizationId: {
            type: 'string',
            description: 'Visualization OID'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['visualizationId']
      },
      annotations: {
        title: 'Get Visualization Details',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.visualization}/Representations('${params.visualizationId}')`
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Visualization: ${params.visualizationId}`,
            conciseFields: VIZ_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get visualization',
            suggestion: 'Verify the visualization OID exists.'
          });
        }
      }
    },

    {
      name: 'get_thumbnail',
      description: `Get thumbnail URL for an object.

**Module:** Requires Creo View/Windchill Visualization Services

**Parameters:**
- objectId (required): Object OID (Part or Document)
- response_format: 'markdown' (default) or 'json'

**Returns:** Thumbnail URL and metadata

**Example:** { "objectId": "VR:wt.part.WTPart:12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          objectId: {
            type: 'string',
            description: 'Object OID (Part/Document)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['objectId']
      },
      annotations: {
        title: 'Get Thumbnail',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.visualization}/Thumbnails('${params.objectId}')`
          );

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

          if (responseFormat === ResponseFormat.MARKDOWN) {
            const data = response.data;
            const lines: string[] = [];
            lines.push(`## Thumbnail: ${params.objectId}`);
            lines.push('');

            if (data.ThumbnailURL) {
              lines.push(`- **URL:** ${data.ThumbnailURL}`);
            }
            if (data.Width) {
              lines.push(`- **Dimensions:** ${data.Width} x ${data.Height}`);
            }
            if (data.Format) {
              lines.push(`- **Format:** ${data.Format}`);
            }

            return lines.join('\n');
          } else {
            return JSON.stringify(response.data, null, 2);
          }
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get thumbnail',
            suggestion: 'Verify the object has a thumbnail representation.'
          });
        }
      }
    }
  ];
}
