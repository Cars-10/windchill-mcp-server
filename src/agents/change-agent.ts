/**
 * @fileoverview Change Agent - Token-Efficient MCP Tools for Windchill Change Management
 *
 * Comprehensive change request management with token-efficient responses.
 *
 * Features:
 * - Response format options (markdown/json)
 * - Detail levels (concise/detailed)
 * - Pagination with has_more, next_offset, total_count
 * - Tool annotations for MCP clients
 * - Comprehensive descriptions with usage examples
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

// ============================================================================
// CONSTANTS
// ============================================================================

const CHANGE_CONCISE_FIELDS = ['Number', 'Name', 'Type', 'State', 'Priority'] as const;

const CHANGE_MARKDOWN_COLUMNS = {
  Number: 'Number',
  Name: 'Name',
  Type: 'Type',
  State: 'State',
  Priority: 'Priority'
};

// ============================================================================
// TOOL ANNOTATIONS
// ============================================================================

const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

const WRITE_OP: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true
};

const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true
};

// ============================================================================
// CHANGE AGENT
// ============================================================================

/**
 * ChangeAgent provides comprehensive tools for interacting with change requests in Windchill.
 *
 * All tools support:
 * - `response_format`: 'markdown' (default, token-efficient) or 'json' (complete)
 * - `detail_level`: 'concise' (default, essential fields) or 'detailed' (all fields)
 * - Pagination with `limit` and `offset` parameters
 *
 * @extends BaseAgent
 */
export class ChangeAgent extends BaseAgent {
  protected agentName = 'change';

  protected tools: ToolDefinition[] = [
    // =========================================================================
    // PRIORITY 1: CORE CHANGE OPERATIONS
    // =========================================================================

    {
      name: 'search',
      description: `Search for change requests by number, name, or type.

**Parameters:**
- number: Change request number (e.g., "CR-123", "ECN-001")
- name: Change request name (partial match, wildcards: *)
- type: Change request type filter
- limit/offset: Pagination (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Change request list with Number, Name, Type, State, Priority

**Examples:**
- { "number": "CR-123" }
- { "name": "*ECN*", "limit": 10 }
- { "type": "ECR", "offset": 20 }

**Note:** State/Priority filters removed - not available in Windchill 13.0.2 OData`,
      inputSchema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Change request number (e.g., "CR-123")' },
          name: { type: 'string', description: 'Change request name (partial match)' },
          type: { type: 'string', description: 'Change request type' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'Search Change Requests', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.number) filters.push(`Number eq '${params.number}'`);
          if (params.name) filters.push(buildTextFilter('Name', params.name));
          if (params.type) filters.push(`Type eq '${params.type}'`);

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.changes}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Change Requests: "${params.number || params.name || 'all'}"`,
            conciseFields: CHANGE_CONCISE_FIELDS,
            markdownColumns: CHANGE_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'change search',
            suggestion: 'Check filter syntax. Use wildcards like "*ECN*" for name searches.'
          });
        }
      }
    },

    {
      name: 'get',
      description: `Get detailed information for a specific change request by ID.

**Parameters:**
- id (required): Change request identifier (UUID or OID)
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Change request details with all available properties

**Example:** { "id": "VR:wt.change2.WTChangeRequest2:12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Change request identifier' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Get Change Request', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.changes}('${params.id}')`
          );
          return buildSingleItemResponse(response.data, params, {
            title: `Change Request: ${response.data?.Number || params.id}`,
            conciseFields: CHANGE_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get change request',
            suggestion: 'Use change_search to find valid IDs.'
          });
        }
      }
    },

    {
      name: 'create',
      description: `Create a new change request in Windchill.

**Parameters:**
- name (required): Change request name/title
- description (required): Detailed description of the change
- number: Change request number (optional if auto-numbered)
- priority: Priority level ("HIGH", "MEDIUM", "LOW")
- type: Change request type
- container: Container/context for the change
- folder: Folder path for placement
- reason: Reason for the change

**Returns:** Created change request details

**Examples:**
- { "name": "Update Material", "description": "Change material to aluminum" }
- { "name": "Design Update", "description": "New design revision", "priority": "HIGH" }`,
      inputSchema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Change request number (optional if auto-numbered)' },
          name: { type: 'string', description: 'Change request name/title' },
          description: { type: 'string', description: 'Detailed description' },
          priority: { type: 'string', description: 'Priority level ("HIGH", "MEDIUM", "LOW")' },
          type: { type: 'string', description: 'Change request type' },
          container: { type: 'string', description: 'Container/context' },
          folder: { type: 'string', description: 'Folder path' },
          reason: { type: 'string', description: 'Reason for the change' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['name', 'description']
      },
      annotations: { title: 'Create Change Request', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const createData: Record<string, unknown> = {
            Name: params.name,
            Description: params.description,
            Priority: params.priority || 'MEDIUM'
          };

          if (params.number) createData.Number = params.number;
          if (params.type) createData.Type = params.type;
          if (params.container) createData.Container = params.container;
          if (params.folder) createData.Folder = params.folder;
          if (params.reason) createData.Reason = params.reason;

          const response = await this.api.post(apiEndpoints.changes, createData);
          return buildSingleItemResponse(response.data, params, {
            title: `Created Change Request: ${params.name}`,
            conciseFields: CHANGE_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'create change request',
            suggestion: 'Check for duplicate numbers. Verify container exists.'
          });
        }
      }
    },

    {
      name: 'update',
      description: `Update change request metadata and properties.

**Parameters:**
- id (required): Change request identifier
- name: Updated name
- description: Updated description
- priority: Updated priority level
- reason: Updated reason
- attributes: Custom attributes object

**Returns:** Updated change request details

**Example:** { "id": "12345", "priority": "HIGH", "reason": "Urgent fix needed" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Change request identifier' },
          name: { type: 'string', description: 'Updated name' },
          description: { type: 'string', description: 'Updated description' },
          priority: { type: 'string', description: 'Updated priority level' },
          reason: { type: 'string', description: 'Updated reason' },
          attributes: { type: 'object', description: 'Custom attributes (key-value pairs)' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Update Change Request', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const updateData: Record<string, unknown> = {};

          if (params.name) updateData.Name = params.name;
          if (params.description) updateData.Description = params.description;
          if (params.priority) updateData.Priority = params.priority;
          if (params.reason) updateData.Reason = params.reason;
          if (params.attributes) Object.assign(updateData, params.attributes);

          if (Object.keys(updateData).length === 0) {
            return buildErrorResponse('No update fields provided', {
              operation: 'update change request',
              suggestion: 'Provide at least one field to update.'
            });
          }

          const response = await this.api.patch(
            `${apiEndpoints.changes}('${params.id}')`,
            updateData
          );
          return buildSingleItemResponse(response.data, params, {
            title: `Updated Change Request: ${params.id}`,
            conciseFields: CHANGE_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'update change request',
            suggestion: 'Verify ID and check if change is editable.'
          });
        }
      }
    },

    {
      name: 'submit',
      description: `Submit a change request for approval workflow.

**Parameters:**
- id (required): Change request identifier
- comment: Submission comment

**Returns:** Submission confirmation

**Example:** { "id": "12345", "comment": "Ready for review" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Change request identifier' },
          comment: { type: 'string', description: 'Submission comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Submit Change Request', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.changes}('${params.id}')/submit`,
            { comment: params.comment || '' }
          );
          return buildSingleItemResponse(response.data, params, {
            title: `Submitted: ${params.id}`,
            conciseFields: CHANGE_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'submit change request',
            suggestion: 'Verify change state allows submission.'
          });
        }
      }
    },

    {
      name: 'approve',
      description: `Approve a change request in the approval workflow.

**Parameters:**
- id (required): Change request identifier
- comment: Approval comment

**Returns:** Approval confirmation

**Example:** { "id": "12345", "comment": "Approved - ready for implementation" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Change request identifier' },
          comment: { type: 'string', description: 'Approval comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Approve Change Request', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.changes}('${params.id}')/approve`,
            { comment: params.comment || '' }
          );
          return buildSingleItemResponse(response.data, params, {
            title: `Approved: ${params.id}`,
            conciseFields: CHANGE_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'approve change request',
            suggestion: 'Verify you have approval authority and change is pending approval.'
          });
        }
      }
    },

    {
      name: 'reject',
      description: `Reject a change request with required reason.

**Parameters:**
- id (required): Change request identifier
- comment (required): Rejection reason

**Returns:** Rejection confirmation

**Example:** { "id": "12345", "comment": "Missing impact analysis documentation" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Change request identifier' },
          comment: { type: 'string', description: 'Rejection reason' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id', 'comment']
      },
      annotations: { title: 'Reject Change Request', ...DESTRUCTIVE },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.changes}('${params.id}')/reject`,
            { comment: params.comment }
          );
          return buildSingleItemResponse(response.data, params, {
            title: `Rejected: ${params.id}`,
            conciseFields: CHANGE_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'reject change request',
            suggestion: 'Verify you have rejection authority and change is pending approval.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 2: CHANGE RELATIONSHIPS & AFFECTED OBJECTS
    // =========================================================================

    {
      name: 'add_affected_object',
      description: `Add a part or document to the change request's affected objects list.

**Parameters:**
- changeId (required): Change request identifier
- objectId (required): Object (part/document) identifier to add
- objectType (required): "PART" or "DOCUMENT"
- description: Description of how object is affected

**Returns:** Confirmation of affected object addition

**Example:** { "changeId": "CR-123", "objectId": "PRT-456", "objectType": "PART" }`,
      inputSchema: {
        type: 'object',
        properties: {
          changeId: { type: 'string', description: 'Change request identifier' },
          objectId: { type: 'string', description: 'Object identifier to add' },
          objectType: { type: 'string', enum: ['PART', 'DOCUMENT'], description: 'Type of object' },
          description: { type: 'string', description: 'How object is affected' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['changeId', 'objectId', 'objectType']
      },
      annotations: { title: 'Add Affected Object', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.changes}('${params.changeId}')/addAffectedObject`,
            {
              objectId: params.objectId,
              objectType: params.objectType,
              description: params.description || ''
            }
          );
          return buildSingleItemResponse(response.data, params, {
            title: `Added Affected Object to ${params.changeId}`,
            conciseFields: ['objectId', 'objectType', 'description']
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'add affected object',
            suggestion: 'Verify both change and object IDs exist.'
          });
        }
      }
    },

    {
      name: 'remove_affected_object',
      description: `Remove an object from the change request's affected objects list.

**Parameters:**
- changeId (required): Change request identifier
- objectId (required): Object identifier to remove

**Returns:** Removal confirmation

**Example:** { "changeId": "CR-123", "objectId": "PRT-456" }`,
      inputSchema: {
        type: 'object',
        properties: {
          changeId: { type: 'string', description: 'Change request identifier' },
          objectId: { type: 'string', description: 'Object identifier to remove' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['changeId', 'objectId']
      },
      annotations: { title: 'Remove Affected Object', ...DESTRUCTIVE },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.changes}('${params.changeId}')/removeAffectedObject`,
            { objectId: params.objectId }
          );

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;
          if (responseFormat === ResponseFormat.MARKDOWN) {
            return `**Removed affected object ${params.objectId} from ${params.changeId}**`;
          }
          return JSON.stringify({ success: true, ...response.data }, null, 2);
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'remove affected object',
            suggestion: 'Verify the object is in the affected objects list.'
          });
        }
      }
    },

    {
      name: 'get_affected_objects',
      description: `List all objects affected by a change request.

**Parameters:**
- changeId (required): Change request identifier
- objectType: Filter by "PART" or "DOCUMENT"
- limit/offset: Pagination
- response_format/detail_level: Output options

**Returns:** List of affected parts and documents

**Example:** { "changeId": "CR-123", "objectType": "PART" }`,
      inputSchema: {
        type: 'object',
        properties: {
          changeId: { type: 'string', description: 'Change request identifier' },
          objectType: { type: 'string', enum: ['PART', 'DOCUMENT'], description: 'Filter by type' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['changeId']
      },
      annotations: { title: 'Get Affected Objects', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          let endpoint = `${apiEndpoints.changes}('${params.changeId}')/affectedObjects`;

          if (params.objectType) {
            endpoint += `?$filter=ObjectType eq '${params.objectType}'`;
          }

          const response = await this.api.get(endpoint);
          return buildListResponse(response.data, params, {
            title: `Affected Objects: ${params.changeId}`,
            conciseFields: ['Number', 'Name', 'ObjectType', 'Description'],
            markdownColumns: {
              Number: 'Number',
              Name: 'Name',
              ObjectType: 'Type',
              Description: 'Description'
            }
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get affected objects',
            suggestion: 'Verify the change request ID exists.'
          });
        }
      }
    },

    {
      name: 'add_resulting_object',
      description: `Add a resulting part or document created/modified by this change.

**Parameters:**
- changeId (required): Change request identifier
- objectId (required): Resulting object identifier
- objectType (required): "PART" or "DOCUMENT"
- description: Description of the resulting object

**Returns:** Confirmation of resulting object addition

**Example:** { "changeId": "CR-123", "objectId": "PRT-789", "objectType": "PART" }`,
      inputSchema: {
        type: 'object',
        properties: {
          changeId: { type: 'string', description: 'Change request identifier' },
          objectId: { type: 'string', description: 'Resulting object identifier' },
          objectType: { type: 'string', enum: ['PART', 'DOCUMENT'], description: 'Type of object' },
          description: { type: 'string', description: 'Description of resulting object' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['changeId', 'objectId', 'objectType']
      },
      annotations: { title: 'Add Resulting Object', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.changes}('${params.changeId}')/addResultingObject`,
            {
              objectId: params.objectId,
              objectType: params.objectType,
              description: params.description || ''
            }
          );
          return buildSingleItemResponse(response.data, params, {
            title: `Added Resulting Object to ${params.changeId}`,
            conciseFields: ['objectId', 'objectType', 'description']
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'add resulting object',
            suggestion: 'Verify both change and object IDs exist.'
          });
        }
      }
    },

    {
      name: 'get_resulting_objects',
      description: `List all resulting objects created/modified by a change request.

**Parameters:**
- changeId (required): Change request identifier
- limit/offset: Pagination
- response_format/detail_level: Output options

**Returns:** List of resulting parts and documents

**Example:** { "changeId": "CR-123" }`,
      inputSchema: {
        type: 'object',
        properties: {
          changeId: { type: 'string', description: 'Change request identifier' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['changeId']
      },
      annotations: { title: 'Get Resulting Objects', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.changes}('${params.changeId}')/resultingObjects`
          );
          return buildListResponse(response.data, params, {
            title: `Resulting Objects: ${params.changeId}`,
            conciseFields: ['Number', 'Name', 'ObjectType', 'Description'],
            markdownColumns: {
              Number: 'Number',
              Name: 'Name',
              ObjectType: 'Type',
              Description: 'Description'
            }
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get resulting objects',
            suggestion: 'Verify the change request ID exists.'
          });
        }
      }
    },

    {
      name: 'get_change_tasks',
      description: `Get workflow tasks associated with a change request.

**Parameters:**
- changeId (required): Change request identifier
- state: Filter by task state
- limit/offset: Pagination
- response_format/detail_level: Output options

**Returns:** List of workflow tasks with state and assignee info

**Example:** { "changeId": "CR-123", "state": "PENDING" }`,
      inputSchema: {
        type: 'object',
        properties: {
          changeId: { type: 'string', description: 'Change request identifier' },
          state: { type: 'string', description: 'Filter by task state' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['changeId']
      },
      annotations: { title: 'Get Change Tasks', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          let endpoint = `${apiEndpoints.changes}('${params.changeId}')/tasks`;

          if (params.state) {
            endpoint += `?$filter=State eq '${params.state}'`;
          }

          const response = await this.api.get(endpoint);
          return buildListResponse(response.data, params, {
            title: `Tasks: ${params.changeId}`,
            conciseFields: ['Name', 'State', 'AssignedTo', 'DueDate'],
            markdownColumns: {
              Name: 'Task',
              State: 'State',
              AssignedTo: 'Assignee',
              DueDate: 'Due Date'
            }
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get change tasks',
            suggestion: 'Verify the change request ID exists.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 3: ADVANCED SEARCH & OPERATIONS
    // =========================================================================

    {
      name: 'advanced_search',
      description: `Advanced multi-criteria change request search.

**Parameters:**
- number: Change request number
- name: Name filter (partial match)
- state: Lifecycle state
- priority: Priority level
- type: Change type
- creator: Created by user
- assignee: Assigned to user
- createdAfter/createdBefore: Creation date range (ISO format)
- modifiedAfter/modifiedBefore: Modification date range
- container: Container filter
- limit/offset: Pagination
- response_format/detail_level: Output options

**Returns:** Filtered change request list

**Example:** { "creator": "jsmith", "state": "INWORK", "priority": "HIGH" }`,
      inputSchema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Change request number' },
          name: { type: 'string', description: 'Name filter (partial match)' },
          state: { type: 'string', description: 'Lifecycle state' },
          priority: { type: 'string', description: 'Priority level' },
          type: { type: 'string', description: 'Change type' },
          creator: { type: 'string', description: 'Created by user' },
          assignee: { type: 'string', description: 'Assigned to user' },
          createdAfter: { type: 'string', description: 'Created after (ISO date)' },
          createdBefore: { type: 'string', description: 'Created before (ISO date)' },
          modifiedAfter: { type: 'string', description: 'Modified after (ISO date)' },
          modifiedBefore: { type: 'string', description: 'Modified before (ISO date)' },
          container: { type: 'string', description: 'Container filter' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'Advanced Change Search', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.number) filters.push(`Number eq '${params.number}'`);
          if (params.name) filters.push(buildTextFilter('Name', params.name));
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

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.changes}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Advanced Change Search',
            conciseFields: CHANGE_CONCISE_FIELDS,
            markdownColumns: CHANGE_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'advanced search',
            suggestion: 'Check filter syntax. Some filters may not be available in Windchill 13.0.2.'
          });
        }
      }
    },

    {
      name: 'search_by_date_range',
      description: `Search change requests within a specific date range.

**Parameters:**
- startDate (required): Start date (ISO format, e.g., "2024-01-01")
- endDate (required): End date (ISO format)
- dateField (required): "CreatedOn" or "ModifiedOn"
- state: Additional state filter
- priority: Additional priority filter
- limit/offset: Pagination
- response_format/detail_level: Output options

**Returns:** Change requests within date range

**Example:** { "startDate": "2024-01-01", "endDate": "2024-03-31", "dateField": "CreatedOn" }`,
      inputSchema: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date (ISO format)' },
          endDate: { type: 'string', description: 'End date (ISO format)' },
          dateField: { type: 'string', enum: ['CreatedOn', 'ModifiedOn'], description: 'Date field to search' },
          state: { type: 'string', description: 'State filter' },
          priority: { type: 'string', description: 'Priority filter' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['startDate', 'endDate', 'dateField']
      },
      annotations: { title: 'Search by Date Range', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          filters.push(`${params.dateField} ge ${params.startDate}`);
          filters.push(`${params.dateField} le ${params.endDate}`);

          if (params.state) filters.push(`State eq '${params.state}'`);
          if (params.priority) filters.push(`Priority eq '${params.priority}'`);

          const queryParams = buildODataPagination(params);
          queryParams.append('$filter', combineFilters(filters));

          const response = await this.api.get(
            `${apiEndpoints.changes}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Changes: ${params.startDate} to ${params.endDate}`,
            conciseFields: CHANGE_CONCISE_FIELDS,
            markdownColumns: CHANGE_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'date range search',
            suggestion: 'Verify date format is ISO (YYYY-MM-DD).'
          });
        }
      }
    },

    {
      name: 'bulk_submit',
      description: `Submit multiple change requests for approval.

**Parameters:**
- changeIds (required): Array of change request identifiers
- comment: Submission comment for all changes

**Returns:** Results summary with success/failure counts

**Example:** { "changeIds": ["CR-001", "CR-002", "CR-003"], "comment": "Batch submission" }`,
      inputSchema: {
        type: 'object',
        properties: {
          changeIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of change request identifiers'
          },
          comment: { type: 'string', description: 'Submission comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['changeIds']
      },
      annotations: { title: 'Bulk Submit Changes', ...WRITE_OP },
      handler: async (params: any) => {
        const results: Array<{ id: string; success: boolean; error?: string }> = [];

        for (const changeId of params.changeIds) {
          try {
            await this.api.post(
              `${apiEndpoints.changes}('${changeId}')/submit`,
              { comment: params.comment || '' }
            );
            results.push({ id: changeId, success: true });
          } catch (error: any) {
            results.push({
              id: changeId,
              success: false,
              error: error?.message || 'Unknown error'
            });
          }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

        if (responseFormat === ResponseFormat.MARKDOWN) {
          const lines: string[] = [];
          lines.push('## Bulk Submit Results');
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
    },

    {
      name: 'get_change_history',
      description: `Get complete history of a change request including state transitions and modifications.

**Parameters:**
- changeId (required): Change request identifier
- limit/offset: Pagination
- response_format/detail_level: Output options

**Returns:** History events with timestamps and users

**Example:** { "changeId": "CR-123" }`,
      inputSchema: {
        type: 'object',
        properties: {
          changeId: { type: 'string', description: 'Change request identifier' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['changeId']
      },
      annotations: { title: 'Get Change History', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.changes}('${params.changeId}')/history`
          );
          return buildListResponse(response.data, params, {
            title: `History: ${params.changeId}`,
            conciseFields: ['EventType', 'User', 'Timestamp', 'Description'],
            markdownColumns: {
              EventType: 'Event',
              User: 'User',
              Timestamp: 'Time',
              Description: 'Description'
            }
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get change history',
            suggestion: 'Verify the change request ID exists.'
          });
        }
      }
    },

    {
      name: 'add_change_note',
      description: `Add a note or comment to a change request.

**Parameters:**
- changeId (required): Change request identifier
- note (required): Note content
- noteType: Type of note ("COMMENT", "RESOLUTION", etc.)

**Returns:** Note creation confirmation

**Example:** { "changeId": "CR-123", "note": "Discussed with engineering team", "noteType": "COMMENT" }`,
      inputSchema: {
        type: 'object',
        properties: {
          changeId: { type: 'string', description: 'Change request identifier' },
          note: { type: 'string', description: 'Note content' },
          noteType: { type: 'string', description: 'Note type (e.g., "COMMENT", "RESOLUTION")' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['changeId', 'note']
      },
      annotations: { title: 'Add Change Note', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.changes}('${params.changeId}')/addNote`,
            {
              note: params.note,
              noteType: params.noteType || 'COMMENT'
            }
          );
          return buildSingleItemResponse(response.data, params, {
            title: `Added Note to ${params.changeId}`,
            conciseFields: ['note', 'noteType', 'createdBy', 'createdOn']
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'add change note',
            suggestion: 'Verify you have permission to add notes to this change.'
          });
        }
      }
    }
  ];
}
