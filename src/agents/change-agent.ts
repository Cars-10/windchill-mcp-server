import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

/**
 * ChangeAgent provides comprehensive tools for interacting with change requests in the Windchill PLM system.
 *
 * This agent exposes change management tools organized in three priority tiers:
 *
 * **Priority 1 - Core Change Operations:**
 * - search: Search change requests by number, state, or priority
 * - get: Retrieve detailed change request information
 * - create: Create new change requests
 * - update: Update change request metadata
 * - submit: Submit change request for approval
 * - approve: Approve a change request
 * - reject: Reject a change request
 *
 * **Priority 2 - Change Relationships & Affected Objects:**
 * - add_affected_object: Add part/document to affected objects
 * - remove_affected_object: Remove affected object
 * - get_affected_objects: List all affected objects
 * - add_resulting_object: Add resulting part/document
 * - get_resulting_objects: List resulting objects
 * - get_change_tasks: Get associated workflow tasks
 *
 * **Priority 3 - Advanced Search & Operations:**
 * - advanced_search: Multi-criteria search with filters
 * - search_by_date_range: Search by creation/modification dates
 * - bulk_submit: Submit multiple change requests
 * - get_change_history: Get change request history
 * - add_change_note: Add note to change request
 */
export class ChangeAgent extends BaseAgent {
  protected agentName = 'change';

  protected tools = [
    // === PRIORITY 1: CORE CHANGE OPERATIONS ===
    {
      name: 'search',
      description: 'Search for change requests by number, state, or priority',
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Change request number (e.g., "CR-123", "ECN-001")'
          },
          name: {
            type: 'string',
            description: 'Change request name (partial match)'
          },
          state: {
            type: 'string',
            description: 'Change request lifecycle state'
          },
          priority: {
            type: 'string',
            description: 'Priority level (e.g., "HIGH", "MEDIUM", "LOW")'
          },
          type: {
            type: 'string',
            description: 'Change request type'
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
        // State and Priority properties not available in Windchill 13.0.2 OData - removed to prevent 400 errors
        // if (params.state) filters.push(`State eq '${params.state}'`);
        // if (params.priority) filters.push(`Priority eq '${params.priority}'`);
        if (params.type) filters.push(`Type eq '${params.type}'`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.changes}?${queryParams.toString()}`
        );
        return response.data;
      },
    },
    {
      name: 'get',
      description: 'Retrieve detailed information for a specific change request by its unique ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique change request identifier'
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.changes}('${params.id}')`
        );
        return response.data;
      }
    },
    {
      name: 'create',
      description: 'Create a new change request in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Change request number (optional if auto-numbered)'
          },
          name: {
            type: 'string',
            description: 'Change request name/title'
          },
          description: {
            type: 'string',
            description: 'Detailed description of the change'
          },
          priority: {
            type: 'string',
            description: 'Priority level (e.g., "HIGH", "MEDIUM", "LOW")'
          },
          type: {
            type: 'string',
            description: 'Change request type'
          },
          container: {
            type: 'string',
            description: 'Container/context where change should be created'
          },
          folder: {
            type: 'string',
            description: 'Folder path where change should be placed'
          },
          reason: {
            type: 'string',
            description: 'Reason for the change'
          }
        },
        required: ['name', 'description']
      },
      handler: async (params: any) => {
        const createData = {
          Number: params.number,
          Name: params.name,
          Description: params.description,
          Priority: params.priority || 'MEDIUM',
          Type: params.type,
          Container: params.container,
          Folder: params.folder,
          Reason: params.reason
        };

        const response = await this.api.post(apiEndpoints.changes, createData);
        return response.data;
      },
    },
    {
      name: 'update',
      description: 'Update change request metadata and properties',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique change request identifier'
          },
          name: {
            type: 'string',
            description: 'Updated change request name'
          },
          description: {
            type: 'string',
            description: 'Updated description'
          },
          priority: {
            type: 'string',
            description: 'Updated priority level'
          },
          reason: {
            type: 'string',
            description: 'Updated reason for change'
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
        if (params.priority) updateData.Priority = params.priority;
        if (params.reason) updateData.Reason = params.reason;
        if (params.attributes) {
          Object.assign(updateData, params.attributes);
        }

        const response = await this.api.patch(
          `${apiEndpoints.changes}('${params.id}')`,
          updateData
        );
        return response.data;
      }
    },
    {
      name: 'submit',
      description: 'Submit a change request for approval',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Change request identifier'
          },
          comment: {
            type: 'string',
            description: 'Submission comment'
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.changes}('${params.id}')/submit`,
          {
            comment: params.comment || ''
          }
        );
        return response.data;
      }
    },
    {
      name: 'approve',
      description: 'Approve a change request',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Change request identifier'
          },
          comment: {
            type: 'string',
            description: 'Approval comment'
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.changes}('${params.id}')/approve`,
          {
            comment: params.comment || ''
          }
        );
        return response.data;
      }
    },
    {
      name: 'reject',
      description: 'Reject a change request',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Change request identifier'
          },
          comment: {
            type: 'string',
            description: 'Rejection reason'
          }
        },
        required: ['id', 'comment']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.changes}('${params.id}')/reject`,
          {
            comment: params.comment
          }
        );
        return response.data;
      }
    },
    // === PRIORITY 2: CHANGE RELATIONSHIPS & AFFECTED OBJECTS ===
    {
      name: 'add_affected_object',
      description: 'Add a part or document to the change request affected objects list',
      inputSchema: {
        type: 'object',
        properties: {
          changeId: {
            type: 'string',
            description: 'Change request identifier'
          },
          objectId: {
            type: 'string',
            description: 'Affected object (part/document) identifier'
          },
          objectType: {
            type: 'string',
            description: 'Type of object (PART, DOCUMENT)'
          },
          description: {
            type: 'string',
            description: 'Description of how object is affected'
          }
        },
        required: ['changeId', 'objectId', 'objectType']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.changes}('${params.changeId}')/addAffectedObject`,
          {
            objectId: params.objectId,
            objectType: params.objectType,
            description: params.description || ''
          }
        );
        return response.data;
      }
    },
    {
      name: 'remove_affected_object',
      description: 'Remove an object from the change request affected objects list',
      inputSchema: {
        type: 'object',
        properties: {
          changeId: {
            type: 'string',
            description: 'Change request identifier'
          },
          objectId: {
            type: 'string',
            description: 'Affected object identifier to remove'
          }
        },
        required: ['changeId', 'objectId']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.changes}('${params.changeId}')/removeAffectedObject`,
          {
            objectId: params.objectId
          }
        );
        return response.data;
      }
    },
    {
      name: 'get_affected_objects',
      description: 'List all objects affected by this change request',
      inputSchema: {
        type: 'object',
        properties: {
          changeId: {
            type: 'string',
            description: 'Change request identifier'
          },
          objectType: {
            type: 'string',
            description: 'Filter by object type (PART, DOCUMENT)'
          }
        },
        required: ['changeId']
      },
      handler: async (params: any) => {
        let endpoint = `${apiEndpoints.changes}('${params.changeId}')/affectedObjects`;

        if (params.objectType) {
          endpoint += `?$filter=ObjectType eq '${params.objectType}'`;
        }

        const response = await this.api.get(endpoint);
        return response.data;
      }
    },
    {
      name: 'add_resulting_object',
      description: 'Add a resulting part or document created/modified by this change',
      inputSchema: {
        type: 'object',
        properties: {
          changeId: {
            type: 'string',
            description: 'Change request identifier'
          },
          objectId: {
            type: 'string',
            description: 'Resulting object identifier'
          },
          objectType: {
            type: 'string',
            description: 'Type of object (PART, DOCUMENT)'
          },
          description: {
            type: 'string',
            description: 'Description of the resulting object'
          }
        },
        required: ['changeId', 'objectId', 'objectType']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.changes}('${params.changeId}')/addResultingObject`,
          {
            objectId: params.objectId,
            objectType: params.objectType,
            description: params.description || ''
          }
        );
        return response.data;
      }
    },
    {
      name: 'get_resulting_objects',
      description: 'List all resulting objects created/modified by this change request',
      inputSchema: {
        type: 'object',
        properties: {
          changeId: {
            type: 'string',
            description: 'Change request identifier'
          }
        },
        required: ['changeId']
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.changes}('${params.changeId}')/resultingObjects`
        );
        return response.data;
      }
    },
    {
      name: 'get_change_tasks',
      description: 'Get workflow tasks associated with a change request',
      inputSchema: {
        type: 'object',
        properties: {
          changeId: {
            type: 'string',
            description: 'Change request identifier'
          },
          state: {
            type: 'string',
            description: 'Filter by task state'
          }
        },
        required: ['changeId']
      },
      handler: async (params: any) => {
        let endpoint = `${apiEndpoints.changes}('${params.changeId}')/tasks`;

        if (params.state) {
          endpoint += `?$filter=State eq '${params.state}'`;
        }

        const response = await this.api.get(endpoint);
        return response.data;
      }
    },
    // === PRIORITY 3: ADVANCED SEARCH & OPERATIONS ===
    {
      name: 'advanced_search',
      description: 'Advanced multi-criteria change request search',
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Change request number filter'
          },
          name: {
            type: 'string',
            description: 'Change request name filter (partial match)'
          },
          state: {
            type: 'string',
            description: 'Lifecycle state filter'
          },
          priority: {
            type: 'string',
            description: 'Priority filter'
          },
          type: {
            type: 'string',
            description: 'Change type filter'
          },
          creator: {
            type: 'string',
            description: 'Created by user filter'
          },
          assignee: {
            type: 'string',
            description: 'Assigned to user filter'
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
        if (params.state) filters.push(`State eq '${params.state}'`);
        if (params.priority) filters.push(`Priority eq '${params.priority}'`);
        if (params.type) filters.push(`Type eq '${params.type}'`);
        if (params.creator) filters.push(`CreatedBy eq '${params.creator}'`);
        if (params.assignee) filters.push(`AssignedTo eq '${params.assignee}'`);
        if (params.container) filters.push(`Container eq '${params.container}'`);

        if (params.createdAfter) filters.push(`CreatedOn gt ${params.createdAfter}`);
        if (params.createdBefore) filters.push(`CreatedOn lt ${params.createdBefore}`);
        if (params.modifiedAfter) filters.push(`ModifiedOn gt ${params.modifiedAfter}`);
        if (params.modifiedBefore) filters.push(`ModifiedOn lt ${params.modifiedBefore}`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.changes}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'search_by_date_range',
      description: 'Search for change requests within a specific date range',
      inputSchema: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Start date (ISO format)'
          },
          endDate: {
            type: 'string',
            description: 'End date (ISO format)'
          },
          dateField: {
            type: 'string',
            description: 'Date field to search by (CreatedOn, ModifiedOn)',
            enum: ['CreatedOn', 'ModifiedOn']
          },
          state: {
            type: 'string',
            description: 'State filter'
          },
          priority: {
            type: 'string',
            description: 'Priority filter'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: ['startDate', 'endDate', 'dateField']
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        const filters = [];

        filters.push(`${params.dateField} ge ${params.startDate}`);
        filters.push(`${params.dateField} le ${params.endDate}`);

        if (params.state) filters.push(`State eq '${params.state}'`);
        if (params.priority) filters.push(`Priority eq '${params.priority}'`);

        queryParams.append('$filter', filters.join(' and '));

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.changes}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'bulk_submit',
      description: 'Submit multiple change requests for approval',
      inputSchema: {
        type: 'object',
        properties: {
          changeIds: {
            type: 'array',
            description: 'Array of change request identifiers',
            items: {
              type: 'string'
            }
          },
          comment: {
            type: 'string',
            description: 'Submission comment for all changes'
          }
        },
        required: ['changeIds']
      },
      handler: async (params: any) => {
        const results = [];

        for (const changeId of params.changeIds) {
          try {
            const response = await this.api.post(
              `${apiEndpoints.changes}('${changeId}')/submit`,
              {
                comment: params.comment || ''
              }
            );
            results.push({
              id: changeId,
              success: true,
              data: response.data
            });
          } catch (error: any) {
            results.push({
              id: changeId,
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
      name: 'get_change_history',
      description: 'Get complete history of a change request',
      inputSchema: {
        type: 'object',
        properties: {
          changeId: {
            type: 'string',
            description: 'Change request identifier'
          }
        },
        required: ['changeId']
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.changes}('${params.changeId}')/history`
        );
        return response.data;
      }
    },
    {
      name: 'add_change_note',
      description: 'Add a note or comment to a change request',
      inputSchema: {
        type: 'object',
        properties: {
          changeId: {
            type: 'string',
            description: 'Change request identifier'
          },
          note: {
            type: 'string',
            description: 'Note content'
          },
          noteType: {
            type: 'string',
            description: 'Type of note (e.g., "COMMENT", "RESOLUTION")'
          }
        },
        required: ['changeId', 'note']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.changes}('${params.changeId}')/addNote`,
          {
            note: params.note,
            noteType: params.noteType || 'COMMENT'
          }
        );
        return response.data;
      }
    }
  ];
}
