/**
 * @fileoverview Part Agent - Token-Efficient MCP Tools for Windchill Parts
 *
 * This agent provides comprehensive tools for interacting with parts in the
 * Windchill PLM system, optimized for LLM token efficiency.
 *
 * Features:
 * - Response format options (markdown/json)
 * - Detail levels (concise/detailed)
 * - Pagination with has_more, next_offset, total_count
 * - Character limit enforcement with truncation
 * - Tool annotations for MCP clients
 * - Comprehensive descriptions with usage examples
 */

import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { logger } from '../config/logger.js';
import { ToolDefinition, ToolAnnotations } from '../types/common.js';
import {
  ResponseFormat,
  DetailLevel,
  StandardToolParams,
  PART_CONCISE_FIELDS,
  STANDARD_LIST_SCHEMA_PROPS,
  FORMAT_SCHEMA_PROPS,
  buildListResponse,
  buildSingleItemResponse,
  buildErrorResponse,
  buildTextFilter,
  combineFilters,
  buildODataPagination,
  normalizePagination,
  DEFAULT_LIMIT,
  MAX_LIMIT
} from '../utils/response-formatter.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Markdown column definitions for part tables */
const PART_MARKDOWN_COLUMNS = {
  Number: 'Number',
  Name: 'Name',
  Type: 'Type',
  State: 'State',
  Version: 'Version'
};

/** Extended fields for detailed part views */
const PART_DETAILED_FIELDS = [
  'ID', 'Number', 'Name', 'Type', 'State', 'Version',
  'View', 'Source', 'DefaultUnit', 'Description',
  'CreatedBy', 'CreatedOn', 'ModifiedBy', 'ModifiedOn'
] as const;

// ============================================================================
// TOOL ANNOTATIONS
// ============================================================================

const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

const WRITE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true
};

const DESTRUCTIVE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true
};

// ============================================================================
// PART AGENT
// ============================================================================

/**
 * PartAgent provides comprehensive tools for interacting with parts in Windchill.
 *
 * All tools support:
 * - `response_format`: 'markdown' (default, token-efficient) or 'json' (complete)
 * - `detail_level`: 'concise' (default, essential fields) or 'detailed' (all fields)
 * - Pagination with `limit` and `offset` parameters
 *
 * @extends BaseAgent
 */
export class PartAgent extends BaseAgent {
  protected agentName = 'part';

  protected tools: ToolDefinition[] = [
    // =========================================================================
    // PRIORITY 1: CORE PART OPERATIONS
    // =========================================================================

    {
      name: 'search',
      description: `Search for parts by number, name, or type with token-efficient responses.

**Supports wildcards:** Use "*" for pattern matching (e.g., "PRT-*", "*BOLT*", "*-001")

**Parameters:**
- number: Part number with optional wildcards
- name: Part name with optional wildcards
- type: Part type filter (exact match)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Number | Name | Type | State | Version |
Pagination info with has_more and next_offset

**Returns (json):**
{ data: [...], pagination: { total, count, offset, limit, has_more, next_offset } }

**Examples:**
- Find all parts starting with "PRT": { "number": "PRT*" }
- Find bolts: { "name": "*BOLT*", "limit": 10 }
- Paginate: { "offset": 20, "limit": 20 }

**Error handling:**
- Empty results: Returns helpful message with search suggestions
- Invalid wildcards: Auto-corrected to contains() search`,
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Part number with optional wildcards (e.g., "PRT-123", "PRT*", "*-001")'
          },
          name: {
            type: 'string',
            description: 'Part name with optional wildcards (e.g., "Axle", "BOLT*", "*PLATE*")'
          },
          type: {
            type: 'string',
            description: 'Part type filter (exact match)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Search Parts',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          // Build filters with wildcard support
          if (params.number) {
            filters.push(buildTextFilter('Number', params.number));
          }
          if (params.name) {
            filters.push(buildTextFilter('Name', params.name));
          }
          if (params.type) {
            filters.push(`Type eq '${params.type}'`);
          }

          // Build query with pagination
          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.parts}?${queryParams.toString()}`
          );

          // Build token-efficient response
          const searchTerm = params.number || params.name || 'all parts';
          return buildListResponse(response.data, params, {
            title: `Parts Search: "${searchTerm}"`,
            conciseFields: PART_CONCISE_FIELDS,
            markdownColumns: PART_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'part search',
            suggestion: 'Check filter syntax. Use wildcards like "PRT*" or "*BOLT*".'
          });
        }
      }
    },

    {
      name: 'get',
      description: `Retrieve detailed information for a specific part by ID.

**Parameters:**
- id (required): Part identifier (UUID or Windchill OID like "VR:wt.part.WTPart:12345")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Part details with Number, Name, Type, State, Version, and more fields based on detail_level.

**Examples:**
- Get part: { "id": "VR:wt.part.WTPart:12345" }
- Get detailed: { "id": "12345", "detail_level": "detailed" }

**Error handling:**
- Not found: Returns error with suggestion to search first`,
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Part identifier (UUID or Windchill OID)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: {
        title: 'Get Part Details',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.parts}('${params.id}')`);

          return buildSingleItemResponse(response.data, params, {
            title: `Part: ${response.data?.Number || params.id}`,
            conciseFields: PART_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get part',
            suggestion: 'Verify the part ID. Use part_search to find valid IDs.'
          });
        }
      }
    },

    {
      name: 'create',
      description: `Create a new part in Windchill.

**Parameters:**
- number (required): Part number (e.g., "PRT-123")
- name (required): Part name/title
- description: Part description
- type: Part type (e.g., "PART", "ASSEMBLY")
- container: Container/context for the part
- folder: Folder path for placement
- view: Part view (e.g., "Design", "Manufacturing")
- response_format: 'markdown' or 'json'

**Returns:** Created part details

**Examples:**
- Simple: { "number": "PRT-001", "name": "New Part" }
- Full: { "number": "PRT-001", "name": "Bracket", "type": "PART", "description": "Support bracket" }

**Error handling:**
- Duplicate number: Returns error with existing part info
- Missing required: Lists missing fields`,
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Part number (e.g., "PRT-123")'
          },
          name: {
            type: 'string',
            description: 'Part name/title'
          },
          description: {
            type: 'string',
            description: 'Part description'
          },
          type: {
            type: 'string',
            description: 'Part type (e.g., "PART", "ASSEMBLY")'
          },
          container: {
            type: 'string',
            description: 'Container/context for the part'
          },
          folder: {
            type: 'string',
            description: 'Folder path for placement'
          },
          view: {
            type: 'string',
            description: 'Part view (e.g., "Design", "Manufacturing")'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['number', 'name']
      },
      annotations: {
        title: 'Create Part',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const createData: Record<string, unknown> = {
            Number: params.number,
            Name: params.name
          };

          if (params.description) createData.Description = params.description;
          if (params.type) createData.Type = params.type;
          if (params.container) createData.Container = params.container;
          if (params.folder) createData.Folder = params.folder;
          if (params.view) createData.View = params.view;

          const response = await this.api.post(apiEndpoints.parts, createData);

          return buildSingleItemResponse(response.data, params, {
            title: `Created Part: ${params.number}`,
            conciseFields: PART_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'create part',
            suggestion: 'Check for duplicate part numbers. Verify container exists.'
          });
        }
      }
    },

    {
      name: 'update',
      description: `Update part metadata and properties.

**Parameters:**
- id (required): Part identifier
- name: Updated part name
- description: Updated description
- attributes: Custom attributes (key-value object)
- response_format: 'markdown' or 'json'

**Returns:** Updated part details

**Examples:**
- Update name: { "id": "12345", "name": "New Name" }
- Update attrs: { "id": "12345", "attributes": { "Material": "Steel" } }

**Error handling:**
- Not found: Suggests using search first
- Locked: Returns lock owner info`,
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Part identifier'
          },
          name: {
            type: 'string',
            description: 'Updated part name'
          },
          description: {
            type: 'string',
            description: 'Updated description'
          },
          attributes: {
            type: 'object',
            description: 'Custom attributes (key-value pairs)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: {
        title: 'Update Part',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const updateData: Record<string, unknown> = {};

          if (params.name) updateData.Name = params.name;
          if (params.description) updateData.Description = params.description;
          if (params.attributes) {
            Object.assign(updateData, params.attributes);
          }

          if (Object.keys(updateData).length === 0) {
            return buildErrorResponse('No update fields provided', {
              operation: 'update part',
              suggestion: 'Provide at least one field to update: name, description, or attributes.'
            });
          }

          const response = await this.api.patch(
            `${apiEndpoints.parts}('${params.id}')`,
            updateData
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Updated Part: ${params.id}`,
            conciseFields: PART_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'update part',
            suggestion: 'Verify part ID and check if part is checked out by another user.'
          });
        }
      }
    },

    {
      name: 'get_version_history',
      description: `Get complete version and iteration history for a part.

**Parameters:**
- id (required): Part identifier
- response_format: 'markdown' or 'json'
- detail_level: 'concise' or 'detailed'

**Returns:** List of versions with revision info, dates, and authors

**Example:** { "id": "VR:wt.part.WTPart:12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Part identifier'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: {
        title: 'Get Part Version History',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.parts}('${params.id}')/versionHistory`
          );

          return buildListResponse(response.data, params, {
            title: `Version History: ${params.id}`,
            conciseFields: ['Version', 'State', 'ModifiedBy', 'ModifiedOn'],
            markdownColumns: {
              Version: 'Version',
              State: 'State',
              ModifiedBy: 'Modified By',
              ModifiedOn: 'Modified On'
            }
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get version history',
            suggestion: 'Verify the part ID exists.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 2: BOM & STRUCTURE MANAGEMENT
    // =========================================================================

    {
      name: 'get_bom_components',
      description: `Get single-level BOM components using OData navigation (CSRF-free).

This is the recommended method for retrieving immediate children of a part.
For multi-level BOM, use get_structure instead.

**Parameters:**
- id (required): Part OID (e.g., "VR:wt.part.WTPart:12345")
- expandPart: Include child part details (default: true)
- response_format: 'markdown' or 'json'
- detail_level: 'concise' or 'detailed'

**Returns:** BOM components with quantities and child part info

**Example:** { "id": "VR:wt.part.WTPart:12345" }

**Don't use when:** You need multi-level BOM (use get_structure instead)`,
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Part OID (e.g., "VR:wt.part.WTPart:12345")'
          },
          expandPart: {
            type: 'boolean',
            description: 'Include child part details (default: true)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: {
        title: 'Get BOM Components (Single Level)',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const expandPart = params.expandPart !== false;
          const expand = expandPart ? 'Uses($expand=Child)' : 'Uses';

          const response = await this.api.get(`${apiEndpoints.parts}('${params.id}')`, {
            $expand: expand
          });

          const components = response.data?.Uses || [];

          logger.info('Retrieved BOM components via OData navigation', {
            partId: params.id,
            componentCount: components.length
          });

          // Format components for response
          const formattedComponents = components.map((comp: any) => ({
            ChildNumber: comp.Child?.Number || 'N/A',
            ChildName: comp.Child?.Name || 'N/A',
            Quantity: comp.Quantity || 1,
            Unit: comp.Unit || 'EA',
            FindNumber: comp.FindNumber || '-'
          }));

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

          if (responseFormat === ResponseFormat.MARKDOWN) {
            const lines: string[] = [];
            lines.push(`## BOM Components: ${params.id}`);
            lines.push('');
            lines.push(`*${formattedComponents.length} components found*`);
            lines.push('');

            if (formattedComponents.length > 0) {
              lines.push('| Child Number | Child Name | Qty | Unit | Find # |');
              lines.push('| --- | --- | --- | --- | --- |');
              formattedComponents.forEach((c: any) => {
                lines.push(`| ${c.ChildNumber} | ${c.ChildName} | ${c.Quantity} | ${c.Unit} | ${c.FindNumber} |`);
              });
            }

            return lines.join('\n');
          } else {
            return JSON.stringify({
              parentId: params.id,
              componentCount: formattedComponents.length,
              components: formattedComponents
            }, null, 2);
          }
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get BOM components',
            suggestion: 'Verify the part OID format (e.g., "VR:wt.part.WTPart:12345").'
          });
        }
      }
    },

    {
      name: 'get_structure',
      description: `Get multi-level BOM structure using GetPartStructure action.

Supports automatic session management and CSRF token handling.
For simple single-level queries, use get_bom_components instead.

**Parameters:**
- id (required): Part OID (e.g., "VR:wt.part.WTPart:12345")
- levels: BOM depth (1-10, or 0/"max" for full depth, default: 1)
- expandPart: Include part details in components (default: true)
- response_format: 'markdown' or 'json'

**Returns:** Hierarchical BOM structure with component details

**Example:** { "id": "VR:wt.part.WTPart:12345", "levels": 3 }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Part OID (e.g., "VR:wt.part.WTPart:12345")'
          },
          levels: {
            type: ['number', 'string'],
            description: 'BOM depth (1-10, or 0/"max" for full depth, default: 1)'
          },
          expandPart: {
            type: 'boolean',
            description: 'Include part details (default: true)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: {
        title: 'Get Multi-Level BOM Structure',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const levelsValue = params.levels === 0 || params.levels === 'max' ? 'max' : (params.levels || 1);
          const expandQuery = `Components($levels=${levelsValue})`;
          const actionUrl = `${apiEndpoints.parts}('${params.id}')/PTC.ProdMgmt.GetPartStructure?$expand=${expandQuery}`;

          // Try GET first, fall back to POST
          let response;
          try {
            logger.info('Attempting GetPartStructure via GET', { partId: params.id, levels: levelsValue });
            response = await this.api.get(actionUrl);
          } catch (getError: any) {
            logger.warn('GET failed, trying POST', { error: getError.message });
            const requestBody = {
              NavigationCriteria: {
                ApplicableType: 'PTC.ProdMgmt.Part'
              }
            };
            response = await this.api.post(actionUrl, requestBody);
          }

          return buildSingleItemResponse(response.data, params, {
            title: `BOM Structure: ${params.id} (${levelsValue} levels)`,
            conciseFields: ['ID', 'Number', 'Name', 'Components']
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get BOM structure',
            suggestion: 'For single-level BOM, try get_bom_components instead.'
          });
        }
      }
    },

    {
      name: 'get_where_used',
      description: `Find where a part is used (parent assemblies).

**Parameters:**
- id (required): Part identifier
- levels: Search depth upward (default: all)
- response_format: 'markdown' or 'json'
- limit/offset: Pagination

**Returns:** List of parent assemblies that use this part

**Example:** { "id": "VR:wt.part.WTPart:12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Part identifier'
          },
          levels: {
            type: 'number',
            description: 'Search depth upward'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: {
        title: 'Get Where Used',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();
          if (params.levels) queryParams.append('levels', params.levels.toString());

          const response = await this.api.get(
            `${apiEndpoints.parts}('${params.id}')/whereUsed?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Where Used: ${params.id}`,
            conciseFields: PART_CONCISE_FIELDS,
            markdownColumns: PART_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'where used search',
            suggestion: 'Verify the part ID exists.'
          });
        }
      }
    },

    {
      name: 'add_bom_component',
      description: `Add a component to a part's BOM.

**Parameters:**
- parentId (required): Parent part identifier
- childId (required): Child part to add
- quantity (required): Component quantity
- unit: Unit of measure (default: "EA")
- referenceDesignator: Reference designator
- findNumber: Find number in BOM

**Returns:** Updated BOM information

**Example:** { "parentId": "12345", "childId": "67890", "quantity": 2 }`,
      inputSchema: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Parent part identifier' },
          childId: { type: 'string', description: 'Child part to add' },
          quantity: { type: 'number', description: 'Component quantity' },
          unit: { type: 'string', description: 'Unit of measure (default: "EA")' },
          referenceDesignator: { type: 'string', description: 'Reference designator' },
          findNumber: { type: 'string', description: 'Find number in BOM' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['parentId', 'childId', 'quantity']
      },
      annotations: {
        title: 'Add BOM Component',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.parts}('${params.parentId}')/addComponent`,
            {
              childId: params.childId,
              quantity: params.quantity,
              unit: params.unit || 'EA',
              referenceDesignator: params.referenceDesignator,
              findNumber: params.findNumber
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Added Component to ${params.parentId}`,
            conciseFields: ['childId', 'quantity', 'unit']
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'add BOM component',
            suggestion: 'Verify both parent and child parts exist and parent is checked out.'
          });
        }
      }
    },

    {
      name: 'remove_bom_component',
      description: `Remove a component from a part's BOM.

**Parameters:**
- parentId (required): Parent part identifier
- childId (required): Child part to remove
- linkId: BOM link ID (optional, for specific occurrence)

**Returns:** Confirmation of removal

**Example:** { "parentId": "12345", "childId": "67890" }`,
      inputSchema: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Parent part identifier' },
          childId: { type: 'string', description: 'Child part to remove' },
          linkId: { type: 'string', description: 'BOM link ID for specific occurrence' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['parentId', 'childId']
      },
      annotations: {
        title: 'Remove BOM Component',
        ...DESTRUCTIVE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.parts}('${params.parentId}')/removeComponent`,
            {
              childId: params.childId,
              linkId: params.linkId
            }
          );

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;
          if (responseFormat === ResponseFormat.MARKDOWN) {
            return `**Removed component ${params.childId} from ${params.parentId}**`;
          }
          return JSON.stringify({ success: true, ...response.data }, null, 2);
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'remove BOM component',
            suggestion: 'Verify both IDs and that parent is checked out.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 3: LIFECYCLE & CHECKOUT OPERATIONS
    // =========================================================================

    {
      name: 'checkout',
      description: `Check out a part for editing.

**Parameters:**
- id (required): Part identifier
- comment: Checkout comment

**Returns:** Checkout confirmation with working copy info

**Example:** { "id": "12345", "comment": "Updating material specs" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Part identifier' },
          comment: { type: 'string', description: 'Checkout comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: {
        title: 'Checkout Part',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.parts}('${params.id}')/checkout`,
            { comment: params.comment || '' }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Checked Out: ${params.id}`,
            conciseFields: PART_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'checkout',
            suggestion: 'Part may already be checked out. Use search to check status.'
          });
        }
      }
    },

    {
      name: 'checkin',
      description: `Check in a part after editing.

**Parameters:**
- id (required): Part identifier
- comment: Check-in comment describing changes

**Returns:** Check-in confirmation

**Example:** { "id": "12345", "comment": "Updated material to aluminum" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Part identifier' },
          comment: { type: 'string', description: 'Check-in comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: {
        title: 'Checkin Part',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.parts}('${params.id}')/checkin`,
            { comment: params.comment || '' }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Checked In: ${params.id}`,
            conciseFields: PART_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'checkin',
            suggestion: 'Part must be checked out to you before checking in.'
          });
        }
      }
    },

    {
      name: 'revise',
      description: `Create a new revision of a part.

**Parameters:**
- id (required): Part identifier
- comment: Revision comment

**Returns:** New revision details

**Example:** { "id": "12345", "comment": "Rev B - design update" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Part identifier' },
          comment: { type: 'string', description: 'Revision comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: {
        title: 'Revise Part',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.parts}('${params.id}')/revise`,
            { comment: params.comment || '' }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `New Revision Created: ${params.id}`,
            conciseFields: PART_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'revise part',
            suggestion: 'Part must be in a releasable state to create new revision.'
          });
        }
      }
    },

    {
      name: 'set_lifecycle_state',
      description: `Change the lifecycle state of a part.

**Parameters:**
- id (required): Part identifier
- state (required): Target state (e.g., "RELEASED", "INWORK")
- comment: State change comment

**Returns:** Updated part with new state

**Example:** { "id": "12345", "state": "RELEASED", "comment": "Approved for production" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Part identifier' },
          state: { type: 'string', description: 'Target lifecycle state' },
          comment: { type: 'string', description: 'State change comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id', 'state']
      },
      annotations: {
        title: 'Set Lifecycle State',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.parts}('${params.id}')/setState`,
            {
              state: params.state,
              comment: params.comment || ''
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `State Changed: ${params.id} → ${params.state}`,
            conciseFields: PART_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'set lifecycle state',
            suggestion: 'Check valid state transitions for current part state.'
          });
        }
      }
    },

    // =========================================================================
    // BULK OPERATIONS
    // =========================================================================

    {
      name: 'bulk_update',
      description: `Update multiple parts with the same changes.

**Parameters:**
- partIds (required): Array of part IDs to update
- updates (required): Fields to update on all parts

**Returns:** Results summary with success/failure counts

**Example:** { "partIds": ["123", "456"], "updates": { "Description": "Updated" } }`,
      inputSchema: {
        type: 'object',
        properties: {
          partIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of part IDs'
          },
          updates: {
            type: 'object',
            description: 'Fields to update on all parts'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['partIds', 'updates']
      },
      annotations: {
        title: 'Bulk Update Parts',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      },
      handler: async (params: any) => {
        const results: Array<{ id: string; success: boolean; error?: string }> = [];

        for (const partId of params.partIds) {
          try {
            await this.api.patch(`${apiEndpoints.parts}('${partId}')`, params.updates);
            results.push({ id: partId, success: true });
          } catch (error: any) {
            results.push({ id: partId, success: false, error: error?.message || 'Unknown error' });
          }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

        if (responseFormat === ResponseFormat.MARKDOWN) {
          const lines: string[] = [];
          lines.push(`## Bulk Update Results`);
          lines.push('');
          lines.push(`- **Total:** ${results.length}`);
          lines.push(`- **Successful:** ${successful}`);
          lines.push(`- **Failed:** ${failed}`);

          if (failed > 0) {
            lines.push('');
            lines.push('**Failures:**');
            results.filter(r => !r.success).forEach(r => {
              lines.push(`- ${r.id}: ${r.error}`);
            });
          }

          return lines.join('\n');
        } else {
          return JSON.stringify({
            totalProcessed: results.length,
            successful,
            failed,
            results
          }, null, 2);
        }
      }
    }
  ];
}
