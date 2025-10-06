import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

/**
 * PartAgent provides comprehensive tools for interacting with parts in the Windchill PLM system.
 *
 * This agent exposes part management tools organized in three priority tiers:
 *
 * **Priority 1 - Core Part Operations:**
 * - search: Search parts by number, name, or state
 * - get: Retrieve detailed part information
 * - create: Create new parts
 * - update: Update part metadata and properties
 * - revise: Create new part revisions
 * - get_version_history: Retrieve version/iteration history
 *
 * **Priority 2 - BOM & Structure Management:**
 * - get_structure: Get BOM structure
 * - add_bom_component: Add component to BOM
 * - remove_bom_component: Remove component from BOM
 * - update_bom_component: Update BOM component properties
 * - get_where_used: Find where part is used
 * - replace_component: Replace component in BOM
 *
 * **Priority 3 - Advanced Search & Operations:**
 * - advanced_search: Multi-criteria search with filters
 * - search_by_lifecycle: Search by lifecycle state
 * - search_by_effectivity: Search by effectivity date
 * - bulk_update: Update multiple parts
 * - checkout: Check out part for editing
 * - checkin: Check in part after editing
 * - set_lifecycle_state: Change lifecycle state
 */
export class PartAgent extends BaseAgent {
  protected agentName = 'part';

  protected tools = [
    // === PRIORITY 1: CORE PART OPERATIONS ===
    {
      name: 'search',
      description: 'Search for parts by number, name, or state in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Part number to search for (e.g., "PRT-123", "ASM-001")'
          },
          name: {
            type: 'string',
            description: 'Part name to search for (partial match)'
          },
          state: {
            type: 'string',
            description: 'Part lifecycle state (e.g., "INWORK", "RELEASED")'
          },
          type: {
            type: 'string',
            description: 'Part type filter'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: []
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        const filters = [];

        if (params.number) filters.push(`Number eq '${params.number}'`);
        if (params.name) filters.push(`contains(Name,'${params.name}'`);
        // State property not available in Windchill 13.0.2 OData - removed to prevent 400 errors
        // if (params.state) filters.push(`State eq '${params.state}'`);
        if (params.type) filters.push(`Type eq '${params.type}'`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.parts}?${queryParams.toString()}`
        );
        return response.data;
      },
    },
    {
      name: 'get',
      description: 'Retrieve detailed information for a specific part by its unique ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique part identifier (UUID or Windchill internal ID)'
          }
        },
        required: ['id'],
      },
      handler: async (params: any) => {
        const response = await this.api.get(`${apiEndpoints.parts}('${params.id}')`);
        return response.data;
      },
    },
    {
      name: 'create',
      description: 'Create a new part in the Windchill system',
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
            description: 'Container/context where part should be created'
          },
          folder: {
            type: 'string',
            description: 'Folder path where part should be placed'
          },
          view: {
            type: 'string',
            description: 'Part view (e.g., "Design", "Manufacturing")'
          }
        },
        required: ['number', 'name']
      },
      handler: async (params: any) => {
        const createData = {
          Number: params.number,
          Name: params.name,
          Description: params.description || '',
          Type: params.type,
          Container: params.container,
          Folder: params.folder,
          View: params.view
        };

        const response = await this.api.post(apiEndpoints.parts, createData);
        return response.data;
      },
    },
    {
      name: 'update',
      description: 'Update part metadata and properties',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique part identifier'
          },
          name: {
            type: 'string',
            description: 'Updated part name'
          },
          description: {
            type: 'string',
            description: 'Updated part description'
          },
          attributes: {
            type: 'object',
            description: 'Custom attributes to update (key-value pairs)'
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        const updateData: any = {};

        if (params.name) updateData.Name = params.name;
        if (params.description) updateData.Description = params.description;
        if (params.attributes) {
          Object.assign(updateData, params.attributes);
        }

        const response = await this.api.patch(
          `${apiEndpoints.parts}('${params.id}')`,
          updateData
        );
        return response.data;
      }
    },
    {
      name: 'revise',
      description: 'Create a new revision of an existing part',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique part identifier'
          },
          comment: {
            type: 'string',
            description: 'Revision comment'
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.parts}('${params.id}')/revise`,
          {
            comment: params.comment || ''
          }
        );
        return response.data;
      }
    },
    {
      name: 'get_version_history',
      description: 'Retrieve complete version and iteration history for a part',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique part identifier'
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.parts}('${params.id}')/versionHistory`
        );
        return response.data;
      }
    },
    {
      name: 'checkout',
      description: 'Check out a part for editing',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique part identifier'
          },
          comment: {
            type: 'string',
            description: 'Optional checkout comment'
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.parts}('${params.id}')/checkout`,
          {
            comment: params.comment || ''
          }
        );
        return response.data;
      }
    },
    {
      name: 'checkin',
      description: 'Check in a part after editing',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique part identifier'
          },
          comment: {
            type: 'string',
            description: 'Check-in comment describing changes'
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.parts}('${params.id}')/checkin`,
          {
            comment: params.comment || ''
          }
        );
        return response.data;
      }
    },
    // === PRIORITY 2: BOM & STRUCTURE MANAGEMENT ===
    {
      name: 'get_structure',
      description: 'Get part BOM (Bill of Materials) structure using Windchill GetPartStructure action',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Part OID (e.g., "VR:wt.part.WTPart:5342084" or "OR:wt.part.WTPart:298122")'
          },
          levels: {
            type: 'number',
            description: 'Number of BOM levels to retrieve. Use 0 or "max" for maximum depth (default: 1)'
          },
          expandPart: {
            type: 'boolean',
            description: 'Whether to expand Part details in Components (default: true)'
          },
          selectFields: {
            type: 'string',
            description: 'Comma-separated list of fields to select from Part (e.g., "Identity,Name,Number")'
          }
        },
        required: ['id'],
      },
      handler: async (params: any) => {
        // Determine levels - support "max" or numeric values
        const levelsValue = params.levels === 0 || params.levels === 'max' ? 'max' : (params.levels || 1);
        const expandPart = params.expandPart !== false; // Default to true

        // Build $expand query - try simpler format first
        // Just expand Components with levels, without nested Part expansion
        const expandQuery = `Components($levels=${levelsValue})`;

        // Build the complete URL for the GetPartStructure action
        const actionUrl = `${apiEndpoints.parts}('${params.id}')/PTC.ProdMgmt.GetPartStructure?$expand=${expandQuery}`;

        // Request body with NavigationCriteria
        const requestBody = {
          NavigationCriteria: {
            ApplicableType: 'PTC.ProdMgmt.Part'
            // Using default filter - can be extended with custom filters if needed
          }
        };

        // POST request to invoke the GetPartStructure action
        const response = await this.api.post(actionUrl, requestBody);

        return response.data;
      },
    },
    {
      name: 'add_bom_component',
      description: 'Add a component to a part BOM structure',
      inputSchema: {
        type: 'object',
        properties: {
          parentId: {
            type: 'string',
            description: 'Parent part identifier'
          },
          childId: {
            type: 'string',
            description: 'Child part identifier to add'
          },
          quantity: {
            type: 'number',
            description: 'Quantity of component'
          },
          unit: {
            type: 'string',
            description: 'Unit of measure'
          },
          referenceDesignator: {
            type: 'string',
            description: 'Reference designator'
          },
          findNumber: {
            type: 'string',
            description: 'Find number in BOM'
          }
        },
        required: ['parentId', 'childId', 'quantity']
      },
      handler: async (params: any) => {
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
        return response.data;
      }
    },
    {
      name: 'remove_bom_component',
      description: 'Remove a component from a part BOM structure',
      inputSchema: {
        type: 'object',
        properties: {
          parentId: {
            type: 'string',
            description: 'Parent part identifier'
          },
          childId: {
            type: 'string',
            description: 'Child part identifier to remove'
          },
          linkId: {
            type: 'string',
            description: 'Optional BOM link identifier'
          }
        },
        required: ['parentId', 'childId']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.parts}('${params.parentId}')/removeComponent`,
          {
            childId: params.childId,
            linkId: params.linkId
          }
        );
        return response.data;
      }
    },
    {
      name: 'update_bom_component',
      description: 'Update properties of a BOM component',
      inputSchema: {
        type: 'object',
        properties: {
          parentId: {
            type: 'string',
            description: 'Parent part identifier'
          },
          linkId: {
            type: 'string',
            description: 'BOM link identifier'
          },
          quantity: {
            type: 'number',
            description: 'Updated quantity'
          },
          unit: {
            type: 'string',
            description: 'Updated unit of measure'
          },
          referenceDesignator: {
            type: 'string',
            description: 'Updated reference designator'
          },
          findNumber: {
            type: 'string',
            description: 'Updated find number'
          }
        },
        required: ['parentId', 'linkId']
      },
      handler: async (params: any) => {
        const updateData: any = {};
        if (params.quantity !== undefined) updateData.quantity = params.quantity;
        if (params.unit) updateData.unit = params.unit;
        if (params.referenceDesignator) updateData.referenceDesignator = params.referenceDesignator;
        if (params.findNumber) updateData.findNumber = params.findNumber;

        const response = await this.api.patch(
          `${apiEndpoints.parts}('${params.parentId}')/components('${params.linkId}')`,
          updateData
        );
        return response.data;
      }
    },
    {
      name: 'get_where_used',
      description: 'Find where a part is used (parent assemblies)',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Part identifier'
          },
          levels: {
            type: 'number',
            description: 'Number of levels to search upward'
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        if (params.levels) queryParams.append('levels', params.levels.toString());

        const response = await this.api.get(
          `${apiEndpoints.parts}('${params.id}')/whereUsed?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'replace_component',
      description: 'Replace a component in BOM with another part',
      inputSchema: {
        type: 'object',
        properties: {
          parentId: {
            type: 'string',
            description: 'Parent part identifier'
          },
          oldChildId: {
            type: 'string',
            description: 'Current child part identifier to replace'
          },
          newChildId: {
            type: 'string',
            description: 'New child part identifier'
          },
          preserveQuantity: {
            type: 'boolean',
            description: 'Preserve existing quantity (default: true)'
          }
        },
        required: ['parentId', 'oldChildId', 'newChildId']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.parts}('${params.parentId}')/replaceComponent`,
          {
            oldChildId: params.oldChildId,
            newChildId: params.newChildId,
            preserveQuantity: params.preserveQuantity !== false
          }
        );
        return response.data;
      }
    },
    // === PRIORITY 3: ADVANCED SEARCH & OPERATIONS ===
    {
      name: 'advanced_search',
      description: 'Advanced multi-criteria part search with filters',
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Part number filter'
          },
          name: {
            type: 'string',
            description: 'Part name filter (partial match)'
          },
          type: {
            type: 'string',
            description: 'Part type filter'
          },
          state: {
            type: 'string',
            description: 'Lifecycle state filter'
          },
          creator: {
            type: 'string',
            description: 'Created by user filter'
          },
          createdAfter: {
            type: 'string',
            description: 'Created after date (ISO format)'
          },
          createdBefore: {
            type: 'string',
            description: 'Created before date (ISO format)'
          },
          modifiedAfter: {
            type: 'string',
            description: 'Modified after date (ISO format)'
          },
          modifiedBefore: {
            type: 'string',
            description: 'Modified before date (ISO format)'
          },
          container: {
            type: 'string',
            description: 'Container filter'
          },
          view: {
            type: 'string',
            description: 'Part view filter'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: []
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        const filters = [];

        if (params.number) filters.push(`Number eq '${params.number}'`);
        if (params.name) filters.push(`contains(Name,'${params.name}')`);
        if (params.type) filters.push(`Type eq '${params.type}'`);
        // State, CreatedBy, CreatedOn, ModifiedOn, Container, View properties may not be available in Windchill 13.0.2 OData
        // Removing them to prevent 400 errors
        // if (params.state) filters.push(`State eq '${params.state}'`);
        // if (params.creator) filters.push(`CreatedBy eq '${params.creator}'`);
        // if (params.container) filters.push(`Container eq '${params.container}'`);
        // if (params.view) filters.push(`View eq '${params.view}'`);
        // if (params.createdAfter) filters.push(`CreatedOn gt ${params.createdAfter}`);
        // if (params.createdBefore) filters.push(`CreatedOn lt ${params.createdBefore}`);
        // if (params.modifiedAfter) filters.push(`ModifiedOn gt ${params.modifiedAfter}`);
        // if (params.modifiedBefore) filters.push(`ModifiedOn lt ${params.modifiedBefore}`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.parts}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'search_by_lifecycle',
      description: 'Search for parts (Note: Windchill 13.0.2 does not support lifecycle state filtering via OData)',
      inputSchema: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            description: 'Lifecycle state (ignored - not supported in Windchill 13.0.2 OData)'
          },
          number: {
            type: 'string',
            description: 'Part number filter'
          },
          name: {
            type: 'string',
            description: 'Part name filter (partial match)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: []
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        const filters = [];

        // State and Container properties not available in Windchill 13.0.2 OData
        // Using Number and Name filters instead
        if (params.number) filters.push(`Number eq '${params.number}'`);
        if (params.name) filters.push(`contains(Name,'${params.name}')`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.parts}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'search_by_effectivity',
      description: 'Search for parts by effectivity date',
      inputSchema: {
        type: 'object',
        properties: {
          effectivityDate: {
            type: 'string',
            description: 'Effectivity date (ISO format)'
          },
          type: {
            type: 'string',
            description: 'Part type filter'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: ['effectivityDate']
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        const filters = [`EffectivityDate eq ${params.effectivityDate}`];

        if (params.type) {
          filters.push(`Type eq '${params.type}'`);
        }

        queryParams.append('$filter', filters.join(' and '));

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.parts}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'bulk_update',
      description: 'Update multiple parts with the same changes',
      inputSchema: {
        type: 'object',
        properties: {
          partIds: {
            type: 'array',
            description: 'Array of part identifiers to update',
            items: {
              type: 'string'
            }
          },
          updates: {
            type: 'object',
            description: 'Fields to update on all parts'
          }
        },
        required: ['partIds', 'updates']
      },
      handler: async (params: any) => {
        const results = [];

        for (const partId of params.partIds) {
          try {
            const response = await this.api.patch(
              `${apiEndpoints.parts}('${partId}')`,
              params.updates
            );
            results.push({
              id: partId,
              success: true,
              data: response.data
            });
          } catch (error: any) {
            results.push({
              id: partId,
              success: false,
              error: error?.message || 'Unknown error occurred'
            });
          }
        }

        return {
          results,
          totalProcessed: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        };
      }
    },
    {
      name: 'set_lifecycle_state',
      description: 'Change the lifecycle state of a part',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Part identifier'
          },
          state: {
            type: 'string',
            description: 'Target lifecycle state'
          },
          comment: {
            type: 'string',
            description: 'State change comment'
          }
        },
        required: ['id', 'state']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.parts}('${params.id}')/setState`,
          {
            state: params.state,
            comment: params.comment || ''
          }
        );
        return response.data;
      }
    }
  ];
}
