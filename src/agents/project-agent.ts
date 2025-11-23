/**
 * @fileoverview Project Agent - Token-Efficient MCP Tools for Windchill Projects
 *
 * This agent provides comprehensive tools for interacting with projects in the
 * Windchill PLM system, optimized for LLM token efficiency.
 *
 * Features:
 * - Response format options (markdown/json)
 * - Detail levels (concise/detailed)
 * - Pagination with has_more, next_offset, total_count
 * - Character limit enforcement with truncation
 * - Tool annotations for MCP clients
 * - Comprehensive descriptions with usage examples
 *
 * Priority Tiers:
 * 1. Core Project Operations: list, get, create, update, get_team, add/remove_team_member
 * 2. Project Content & Relationships: get/add/remove objects, activities, deliverables
 * 3. Advanced Search & Operations: advanced_search, date_range, milestones, metrics
 */

import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolDefinition, ToolAnnotations } from '../types/common.js';
import {
  ResponseFormat,
  DetailLevel,
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

/** Default fields to include in concise project responses */
const PROJECT_CONCISE_FIELDS = ['ID', 'Number', 'Name', 'State', 'Manager', 'StartDate', 'EndDate'] as const;

/** Markdown column definitions for project tables */
const PROJECT_MARKDOWN_COLUMNS = {
  Number: 'Number',
  Name: 'Name',
  State: 'State',
  Manager: 'Manager',
  StartDate: 'Start Date'
};

/** Team member fields for concise responses */
const TEAM_CONCISE_FIELDS = ['Username', 'DisplayName', 'Role', 'Email'] as const;

/** Team markdown columns */
const TEAM_MARKDOWN_COLUMNS = {
  Username: 'Username',
  DisplayName: 'Display Name',
  Role: 'Role',
  Email: 'Email'
};

/** Project object fields for concise responses */
const PROJECT_OBJECT_CONCISE_FIELDS = ['ID', 'Number', 'Name', 'ObjectType', 'State'] as const;

/** Project object markdown columns */
const PROJECT_OBJECT_MARKDOWN_COLUMNS = {
  Number: 'Number',
  Name: 'Name',
  ObjectType: 'Type',
  State: 'State'
};

/** Activity fields for concise responses */
const ACTIVITY_CONCISE_FIELDS = ['ID', 'Name', 'State', 'DueDate', 'AssignedTo'] as const;

/** Activity markdown columns */
const ACTIVITY_MARKDOWN_COLUMNS = {
  Name: 'Name',
  State: 'State',
  DueDate: 'Due Date',
  AssignedTo: 'Assigned To'
};

/** Deliverable fields for concise responses */
const DELIVERABLE_CONCISE_FIELDS = ['ID', 'Name', 'Status', 'DueDate'] as const;

/** Deliverable markdown columns */
const DELIVERABLE_MARKDOWN_COLUMNS = {
  Name: 'Name',
  Status: 'Status',
  DueDate: 'Due Date'
};

/** Milestone fields for concise responses */
const MILESTONE_CONCISE_FIELDS = ['ID', 'Name', 'Status', 'DueDate'] as const;

/** Milestone markdown columns */
const MILESTONE_MARKDOWN_COLUMNS = {
  Name: 'Name',
  Status: 'Status',
  DueDate: 'Due Date'
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
// PROJECT AGENT
// ============================================================================

/**
 * ProjectAgent provides comprehensive tools for interacting with projects in Windchill.
 *
 * All tools support:
 * - `response_format`: 'markdown' (default, token-efficient) or 'json' (complete)
 * - `detail_level`: 'concise' (default, essential fields) or 'detailed' (all fields)
 * - Pagination with `limit` and `offset` parameters
 *
 * @extends BaseAgent
 */
export class ProjectAgent extends BaseAgent {
  protected agentName = 'project';

  protected tools: ToolDefinition[] = [
    // =========================================================================
    // PRIORITY 1: CORE PROJECT OPERATIONS
    // =========================================================================

    {
      name: 'list',
      description: `List or search projects in the Windchill system with token-efficient responses.

**Parameters:**
- name: Project name filter (partial match)
- state: Project state filter (e.g., "ACTIVE", "COMPLETED", "CANCELLED")
- manager: Project manager username filter
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Number | Name | State | Manager | Start Date |
Pagination info with has_more and next_offset

**Returns (json):**
{ data: [...], pagination: { total, count, offset, limit, has_more, next_offset } }

**Examples:**
- List all projects: {}
- Filter by name: { "name": "Phase 2" }
- Paginate: { "offset": 20, "limit": 20 }

**Note:** State and Manager filters may not be available in all Windchill versions.`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project name filter (partial match)'
          },
          state: {
            type: 'string',
            description: 'Project state filter (e.g., "ACTIVE", "COMPLETED", "CANCELLED")'
          },
          manager: {
            type: 'string',
            description: 'Project manager username filter'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Projects',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          // Build filters - Name is most reliable across Windchill versions
          if (params.name) filters.push(`contains(Name,'${params.name}')`);
          // State and Manager may not be supported in all versions
          // if (params.state) filters.push(`State eq '${params.state}'`);
          // if (params.manager) filters.push(`Manager eq '${params.manager}'`);

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.projects}?${queryParams.toString()}`
          );

          const searchTerm = params.name || 'all projects';
          return buildListResponse(response.data, params, {
            title: `Projects: "${searchTerm}"`,
            conciseFields: PROJECT_CONCISE_FIELDS,
            markdownColumns: PROJECT_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list projects',
            suggestion: 'Check filter syntax. Name filter supports partial matching.'
          });
        }
      }
    },

    {
      name: 'get',
      description: `Retrieve detailed information for a specific project by ID.

**Parameters:**
- projectId (required): Project identifier (UUID or Windchill OID)
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Project details including Number, Name, State, Manager, Dates, and Description.

**Examples:**
- Get project: { "projectId": "PRJ-12345" }
- Get detailed: { "projectId": "12345", "detail_level": "detailed" }

**Error handling:**
- Not found: Returns error with suggestion to search first`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier (UUID or Windchill OID)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['projectId']
      },
      annotations: {
        title: 'Get Project Details',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.projects}('${params.projectId}')`
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Project: ${response.data?.Name || params.projectId}`,
            conciseFields: PROJECT_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get project',
            suggestion: 'Verify the project ID. Use project_list to find valid IDs.'
          });
        }
      }
    },

    {
      name: 'create',
      description: `Create a new project in the Windchill system.

**Parameters:**
- name (required): Project name/title
- number: Project number (optional if auto-numbered)
- description: Project description
- manager: Project manager username
- startDate: Project start date (ISO format: YYYY-MM-DD)
- endDate: Project end date (ISO format: YYYY-MM-DD)
- state: Initial project state (default: "ACTIVE")
- container: Container/context where project should be created
- response_format: 'markdown' or 'json'

**Returns:** Created project details

**Examples:**
- Simple: { "name": "New Product Launch" }
- Full: { "name": "Q4 Initiative", "number": "PRJ-2024-001", "manager": "jsmith", "startDate": "2024-01-15", "endDate": "2024-06-30" }

**Error handling:**
- Duplicate number: Returns error with existing project info
- Missing required: Lists missing fields`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project name/title'
          },
          number: {
            type: 'string',
            description: 'Project number (optional if auto-numbered)'
          },
          description: {
            type: 'string',
            description: 'Project description'
          },
          manager: {
            type: 'string',
            description: 'Project manager username'
          },
          startDate: {
            type: 'string',
            description: 'Project start date (ISO format: YYYY-MM-DD)'
          },
          endDate: {
            type: 'string',
            description: 'Project end date (ISO format: YYYY-MM-DD)'
          },
          state: {
            type: 'string',
            description: 'Initial project state (default: "ACTIVE")'
          },
          container: {
            type: 'string',
            description: 'Container/context where project should be created'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['name']
      },
      annotations: {
        title: 'Create Project',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const createData: Record<string, unknown> = {
            Name: params.name,
            State: params.state || 'ACTIVE'
          };

          if (params.number) createData.Number = params.number;
          if (params.description) createData.Description = params.description;
          if (params.manager) createData.Manager = params.manager;
          if (params.startDate) createData.StartDate = params.startDate;
          if (params.endDate) createData.EndDate = params.endDate;
          if (params.container) createData.Container = params.container;

          const response = await this.api.post(apiEndpoints.projects, createData);

          return buildSingleItemResponse(response.data, params, {
            title: `Created Project: ${params.name}`,
            conciseFields: PROJECT_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'create project',
            suggestion: 'Check for duplicate project numbers. Verify container exists.'
          });
        }
      }
    },

    {
      name: 'update',
      description: `Update project metadata and properties.

**Parameters:**
- projectId (required): Project identifier
- name: Updated project name
- description: Updated description
- manager: Updated project manager
- startDate: Updated start date (ISO format)
- endDate: Updated end date (ISO format)
- attributes: Custom attributes to update (key-value object)
- response_format: 'markdown' or 'json'

**Returns:** Updated project details

**Examples:**
- Update name: { "projectId": "12345", "name": "Renamed Project" }
- Update dates: { "projectId": "12345", "endDate": "2024-12-31" }
- Update attrs: { "projectId": "12345", "attributes": { "Priority": "High" } }

**Error handling:**
- Not found: Suggests using search first
- No fields: Returns error listing updatable fields`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          name: {
            type: 'string',
            description: 'Updated project name'
          },
          description: {
            type: 'string',
            description: 'Updated description'
          },
          manager: {
            type: 'string',
            description: 'Updated project manager'
          },
          startDate: {
            type: 'string',
            description: 'Updated start date (ISO format)'
          },
          endDate: {
            type: 'string',
            description: 'Updated end date (ISO format)'
          },
          attributes: {
            type: 'object',
            description: 'Custom attributes to update (key-value pairs)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['projectId']
      },
      annotations: {
        title: 'Update Project',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const updateData: Record<string, unknown> = {};

          if (params.name) updateData.Name = params.name;
          if (params.description) updateData.Description = params.description;
          if (params.manager) updateData.Manager = params.manager;
          if (params.startDate) updateData.StartDate = params.startDate;
          if (params.endDate) updateData.EndDate = params.endDate;
          if (params.attributes) {
            Object.assign(updateData, params.attributes);
          }

          if (Object.keys(updateData).length === 0) {
            return buildErrorResponse('No update fields provided', {
              operation: 'update project',
              suggestion: 'Provide at least one field to update: name, description, manager, startDate, endDate, or attributes.'
            });
          }

          const response = await this.api.patch(
            `${apiEndpoints.projects}('${params.projectId}')`,
            updateData
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Updated Project: ${params.projectId}`,
            conciseFields: PROJECT_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'update project',
            suggestion: 'Verify project ID exists. Check you have permission to update.'
          });
        }
      }
    },

    {
      name: 'get_team',
      description: `Get all team members for a project.

**Parameters:**
- projectId (required): Project identifier
- role: Filter by team role (e.g., "MEMBER", "CONTRIBUTOR", "VIEWER")
- limit/offset: Pagination parameters
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Username | Display Name | Role | Email |
Pagination info

**Returns (json):**
{ data: [...], pagination: {...} }

**Examples:**
- All team members: { "projectId": "12345" }
- Filter by role: { "projectId": "12345", "role": "CONTRIBUTOR" }`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          role: {
            type: 'string',
            description: 'Filter by team role (e.g., "MEMBER", "CONTRIBUTOR", "VIEWER")'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['projectId']
      },
      annotations: {
        title: 'Get Project Team',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          if (params.role) {
            queryParams.append('$filter', `Role eq '${params.role}'`);
          }

          const response = await this.api.get(
            `${apiEndpoints.projects}('${params.projectId}')/Team?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Team: Project ${params.projectId}`,
            conciseFields: TEAM_CONCISE_FIELDS,
            markdownColumns: TEAM_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get project team',
            suggestion: 'Verify the project ID exists.'
          });
        }
      }
    },

    {
      name: 'add_team_member',
      description: `Add a user to the project team.

**Parameters:**
- projectId (required): Project identifier
- username (required): Username to add to team
- role: Team role (default: "MEMBER"). Options: "MEMBER", "CONTRIBUTOR", "VIEWER"
- response_format: 'markdown' or 'json'

**Returns:** Confirmation of team member addition

**Examples:**
- Add as member: { "projectId": "12345", "username": "jsmith" }
- Add as contributor: { "projectId": "12345", "username": "jdoe", "role": "CONTRIBUTOR" }

**Error handling:**
- User not found: Suggests verifying username
- Already member: Returns existing membership info`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          username: {
            type: 'string',
            description: 'Username to add to team'
          },
          role: {
            type: 'string',
            description: 'Team role (default: "MEMBER"). Options: "MEMBER", "CONTRIBUTOR", "VIEWER"'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['projectId', 'username']
      },
      annotations: {
        title: 'Add Team Member',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.projects}('${params.projectId}')/addTeamMember`,
            {
              username: params.username,
              role: params.role || 'MEMBER'
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Added ${params.username} to Project ${params.projectId}`,
            conciseFields: TEAM_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'add team member',
            suggestion: 'Verify the username exists and project ID is valid.'
          });
        }
      }
    },

    {
      name: 'remove_team_member',
      description: `Remove a user from the project team.

**Parameters:**
- projectId (required): Project identifier
- username (required): Username to remove from team
- response_format: 'markdown' or 'json'

**Returns:** Confirmation of team member removal

**Example:** { "projectId": "12345", "username": "jsmith" }

**Error handling:**
- User not in team: Returns informative error`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          username: {
            type: 'string',
            description: 'Username to remove from team'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['projectId', 'username']
      },
      annotations: {
        title: 'Remove Team Member',
        ...DESTRUCTIVE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.projects}('${params.projectId}')/removeTeamMember`,
            {
              username: params.username
            }
          );

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;
          if (responseFormat === ResponseFormat.MARKDOWN) {
            return `**Removed ${params.username} from project ${params.projectId}**`;
          }
          return JSON.stringify({ success: true, ...response.data }, null, 2);
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'remove team member',
            suggestion: 'Verify the username is a current team member.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 2: PROJECT CONTENT & RELATIONSHIPS
    // =========================================================================

    {
      name: 'get_project_objects',
      description: `Get parts and documents associated with a project.

**Parameters:**
- projectId (required): Project identifier
- objectType: Filter by object type ("PART" or "DOCUMENT")
- limit/offset: Pagination parameters
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Number | Name | Type | State |
Pagination info

**Examples:**
- All objects: { "projectId": "12345" }
- Parts only: { "projectId": "12345", "objectType": "PART" }
- Documents only: { "projectId": "12345", "objectType": "DOCUMENT", "limit": 50 }`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          objectType: {
            type: 'string',
            description: 'Filter by object type ("PART" or "DOCUMENT")'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['projectId']
      },
      annotations: {
        title: 'Get Project Objects',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          if (params.objectType) {
            queryParams.append('$filter', `ObjectType eq '${params.objectType}'`);
          }

          const response = await this.api.get(
            `${apiEndpoints.projects}('${params.projectId}')/objects?${queryParams.toString()}`
          );

          const typeLabel = params.objectType || 'Objects';
          return buildListResponse(response.data, params, {
            title: `${typeLabel}: Project ${params.projectId}`,
            conciseFields: PROJECT_OBJECT_CONCISE_FIELDS,
            markdownColumns: PROJECT_OBJECT_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get project objects',
            suggestion: 'Verify the project ID exists.'
          });
        }
      }
    },

    {
      name: 'add_project_object',
      description: `Add a part or document to a project.

**Parameters:**
- projectId (required): Project identifier
- objectId (required): Part or document identifier
- objectType (required): Type of object ("PART" or "DOCUMENT")
- role: Role of object in project (optional)
- response_format: 'markdown' or 'json'

**Returns:** Confirmation of object addition

**Examples:**
- Add part: { "projectId": "PRJ-001", "objectId": "PRT-123", "objectType": "PART" }
- Add document: { "projectId": "PRJ-001", "objectId": "DOC-456", "objectType": "DOCUMENT" }

**Error handling:**
- Object not found: Suggests verifying object ID
- Already in project: Returns existing relationship info`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          objectId: {
            type: 'string',
            description: 'Part or document identifier'
          },
          objectType: {
            type: 'string',
            description: 'Type of object ("PART" or "DOCUMENT")'
          },
          role: {
            type: 'string',
            description: 'Role of object in project (optional)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['projectId', 'objectId', 'objectType']
      },
      annotations: {
        title: 'Add Project Object',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.projects}('${params.projectId}')/addObject`,
            {
              objectId: params.objectId,
              objectType: params.objectType,
              role: params.role
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Added ${params.objectType} ${params.objectId} to Project ${params.projectId}`,
            conciseFields: PROJECT_OBJECT_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'add project object',
            suggestion: 'Verify both project ID and object ID exist. Check object type is correct.'
          });
        }
      }
    },

    {
      name: 'remove_project_object',
      description: `Remove a part or document from a project.

**Parameters:**
- projectId (required): Project identifier
- objectId (required): Part or document identifier to remove
- response_format: 'markdown' or 'json'

**Returns:** Confirmation of object removal

**Example:** { "projectId": "PRJ-001", "objectId": "PRT-123" }

**Error handling:**
- Object not in project: Returns informative error`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          objectId: {
            type: 'string',
            description: 'Part or document identifier to remove'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['projectId', 'objectId']
      },
      annotations: {
        title: 'Remove Project Object',
        ...DESTRUCTIVE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.projects}('${params.projectId}')/removeObject`,
            {
              objectId: params.objectId
            }
          );

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;
          if (responseFormat === ResponseFormat.MARKDOWN) {
            return `**Removed object ${params.objectId} from project ${params.projectId}**`;
          }
          return JSON.stringify({ success: true, ...response.data }, null, 2);
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'remove project object',
            suggestion: 'Verify the object is currently in the project.'
          });
        }
      }
    },

    {
      name: 'get_project_activities',
      description: `Get activities and tasks associated with a project.

**Parameters:**
- projectId (required): Project identifier
- state: Filter by activity state (e.g., "OPEN", "IN_PROGRESS", "COMPLETED")
- limit/offset: Pagination parameters
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | State | Due Date | Assigned To |
Pagination info

**Examples:**
- All activities: { "projectId": "12345" }
- Open activities: { "projectId": "12345", "state": "OPEN" }`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          state: {
            type: 'string',
            description: 'Filter by activity state (e.g., "OPEN", "IN_PROGRESS", "COMPLETED")'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['projectId']
      },
      annotations: {
        title: 'Get Project Activities',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          if (params.state) {
            queryParams.append('$filter', `State eq '${params.state}'`);
          }

          const response = await this.api.get(
            `${apiEndpoints.projects}('${params.projectId}')/activities?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Activities: Project ${params.projectId}`,
            conciseFields: ACTIVITY_CONCISE_FIELDS,
            markdownColumns: ACTIVITY_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get project activities',
            suggestion: 'Verify the project ID exists.'
          });
        }
      }
    },

    {
      name: 'get_project_deliverables',
      description: `Get project deliverables.

**Parameters:**
- projectId (required): Project identifier
- status: Filter by deliverable status (e.g., "PENDING", "APPROVED", "DELIVERED")
- limit/offset: Pagination parameters
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Status | Due Date |
Pagination info

**Examples:**
- All deliverables: { "projectId": "12345" }
- Pending deliverables: { "projectId": "12345", "status": "PENDING" }`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          status: {
            type: 'string',
            description: 'Filter by deliverable status (e.g., "PENDING", "APPROVED", "DELIVERED")'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['projectId']
      },
      annotations: {
        title: 'Get Project Deliverables',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          if (params.status) {
            queryParams.append('$filter', `Status eq '${params.status}'`);
          }

          const response = await this.api.get(
            `${apiEndpoints.projects}('${params.projectId}')/deliverables?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Deliverables: Project ${params.projectId}`,
            conciseFields: DELIVERABLE_CONCISE_FIELDS,
            markdownColumns: DELIVERABLE_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get project deliverables',
            suggestion: 'Verify the project ID exists.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 3: ADVANCED SEARCH & OPERATIONS
    // =========================================================================

    {
      name: 'advanced_search',
      description: `Advanced multi-criteria project search with date filtering.

**Parameters:**
- name: Project name filter (partial match)
- number: Project number filter (exact match)
- state: Project state filter
- manager: Project manager filter
- createdAfter: Created after date (ISO format: YYYY-MM-DD)
- createdBefore: Created before date (ISO format)
- startDateAfter: Start date after (ISO format)
- endDateBefore: End date before (ISO format)
- limit/offset: Pagination parameters
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Number | Name | State | Manager | Start Date |
Pagination info

**Examples:**
- By manager: { "manager": "jsmith" }
- By date range: { "createdAfter": "2024-01-01", "createdBefore": "2024-06-30" }
- Combined: { "name": "Phase", "state": "ACTIVE", "limit": 50 }

**Note:** Date and state filters may not be available in all Windchill versions.`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project name filter (partial match)'
          },
          number: {
            type: 'string',
            description: 'Project number filter (exact match)'
          },
          state: {
            type: 'string',
            description: 'Project state filter'
          },
          manager: {
            type: 'string',
            description: 'Project manager filter'
          },
          createdAfter: {
            type: 'string',
            description: 'Created after date (ISO format: YYYY-MM-DD)'
          },
          createdBefore: {
            type: 'string',
            description: 'Created before date (ISO format)'
          },
          startDateAfter: {
            type: 'string',
            description: 'Start date after (ISO format)'
          },
          endDateBefore: {
            type: 'string',
            description: 'End date before (ISO format)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Advanced Project Search',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.name) filters.push(`contains(Name,'${params.name}')`);
          if (params.number) filters.push(`Number eq '${params.number}'`);
          if (params.state) filters.push(`State eq '${params.state}'`);
          if (params.manager) filters.push(`Manager eq '${params.manager}'`);
          if (params.createdAfter) filters.push(`CreatedOn gt ${params.createdAfter}`);
          if (params.createdBefore) filters.push(`CreatedOn lt ${params.createdBefore}`);
          if (params.startDateAfter) filters.push(`StartDate gt ${params.startDateAfter}`);
          if (params.endDateBefore) filters.push(`EndDate lt ${params.endDateBefore}`);

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.projects}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Advanced Project Search Results',
            conciseFields: PROJECT_CONCISE_FIELDS,
            markdownColumns: PROJECT_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'advanced project search',
            suggestion: 'Some filters may not be supported. Try with fewer criteria.'
          });
        }
      }
    },

    {
      name: 'search_by_date_range',
      description: `Search projects within a specific date range.

**Parameters:**
- startDate (required): Range start date (ISO format: YYYY-MM-DD)
- endDate (required): Range end date (ISO format: YYYY-MM-DD)
- dateField (required): Date field to search by: "CreatedOn", "StartDate", or "EndDate"
- state: Additional project state filter
- limit/offset: Pagination parameters
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Number | Name | State | Manager | Start Date |
Pagination info

**Examples:**
- By creation date: { "startDate": "2024-01-01", "endDate": "2024-12-31", "dateField": "CreatedOn" }
- By project dates: { "startDate": "2024-06-01", "endDate": "2024-12-31", "dateField": "StartDate" }
- With state: { "startDate": "2024-01-01", "endDate": "2024-06-30", "dateField": "EndDate", "state": "COMPLETED" }`,
      inputSchema: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Range start date (ISO format: YYYY-MM-DD)'
          },
          endDate: {
            type: 'string',
            description: 'Range end date (ISO format: YYYY-MM-DD)'
          },
          dateField: {
            type: 'string',
            description: 'Date field to search by: "CreatedOn", "StartDate", or "EndDate"',
            enum: ['CreatedOn', 'StartDate', 'EndDate']
          },
          state: {
            type: 'string',
            description: 'Additional project state filter'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['startDate', 'endDate', 'dateField']
      },
      annotations: {
        title: 'Search Projects by Date Range',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          filters.push(`${params.dateField} ge ${params.startDate}`);
          filters.push(`${params.dateField} le ${params.endDate}`);

          if (params.state) {
            filters.push(`State eq '${params.state}'`);
          }

          const queryParams = buildODataPagination(params);
          queryParams.append('$filter', combineFilters(filters));

          const response = await this.api.get(
            `${apiEndpoints.projects}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Projects by ${params.dateField}: ${params.startDate} to ${params.endDate}`,
            conciseFields: PROJECT_CONCISE_FIELDS,
            markdownColumns: PROJECT_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search projects by date range',
            suggestion: 'Verify date format (YYYY-MM-DD) and dateField value.'
          });
        }
      }
    },

    {
      name: 'get_project_milestones',
      description: `Get milestones for a project.

**Parameters:**
- projectId (required): Project identifier
- status: Filter by milestone status (e.g., "PENDING", "REACHED", "MISSED")
- limit/offset: Pagination parameters
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Name | Status | Due Date |
Pagination info

**Examples:**
- All milestones: { "projectId": "12345" }
- Pending milestones: { "projectId": "12345", "status": "PENDING" }`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          status: {
            type: 'string',
            description: 'Filter by milestone status (e.g., "PENDING", "REACHED", "MISSED")'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['projectId']
      },
      annotations: {
        title: 'Get Project Milestones',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          if (params.status) {
            queryParams.append('$filter', `Status eq '${params.status}'`);
          }

          const response = await this.api.get(
            `${apiEndpoints.projects}('${params.projectId}')/milestones?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Milestones: Project ${params.projectId}`,
            conciseFields: MILESTONE_CONCISE_FIELDS,
            markdownColumns: MILESTONE_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get project milestones',
            suggestion: 'Verify the project ID exists.'
          });
        }
      }
    },

    {
      name: 'update_project_status',
      description: `Update the status/state of a project.

**Parameters:**
- projectId (required): Project identifier
- state (required): New project state (e.g., "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED")
- comment: Status change comment (recommended for audit trail)
- response_format: 'markdown' or 'json'

**Returns:** Updated project with new state

**Examples:**
- Complete project: { "projectId": "12345", "state": "COMPLETED", "comment": "All deliverables approved" }
- Put on hold: { "projectId": "12345", "state": "ON_HOLD", "comment": "Pending budget approval" }

**Error handling:**
- Invalid transition: Returns valid state transitions`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          state: {
            type: 'string',
            description: 'New project state (e.g., "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED")'
          },
          comment: {
            type: 'string',
            description: 'Status change comment (recommended for audit trail)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['projectId', 'state']
      },
      annotations: {
        title: 'Update Project Status',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.projects}('${params.projectId}')/updateStatus`,
            {
              state: params.state,
              comment: params.comment || ''
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Updated Status: Project ${params.projectId} -> ${params.state}`,
            conciseFields: PROJECT_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'update project status',
            suggestion: 'Check valid state transitions for current project state.'
          });
        }
      }
    },

    {
      name: 'get_project_metrics',
      description: `Get metrics and statistics for a project.

**Parameters:**
- projectId (required): Project identifier
- metricType: Type of metrics to retrieve: "PROGRESS", "RESOURCES", "DELIVERABLES", or all if omitted
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Project metrics including progress percentages, resource utilization, deliverable status counts

**Examples:**
- All metrics: { "projectId": "12345" }
- Progress metrics: { "projectId": "12345", "metricType": "PROGRESS" }
- Resource metrics: { "projectId": "12345", "metricType": "RESOURCES" }`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          metricType: {
            type: 'string',
            description: 'Type of metrics to retrieve: "PROGRESS", "RESOURCES", "DELIVERABLES"'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['projectId']
      },
      annotations: {
        title: 'Get Project Metrics',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          let endpoint = `${apiEndpoints.projects}('${params.projectId}')/metrics`;

          if (params.metricType) {
            endpoint += `?type=${params.metricType}`;
          }

          const response = await this.api.get(endpoint);

          const title = params.metricType
            ? `${params.metricType} Metrics: Project ${params.projectId}`
            : `Metrics: Project ${params.projectId}`;

          return buildSingleItemResponse(response.data, params, {
            title,
            conciseFields: ['Progress', 'ResourceUtilization', 'DeliverableStatus', 'TaskCompletion']
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get project metrics',
            suggestion: 'Verify the project ID exists. Some metric types may not be available.'
          });
        }
      }
    }
  ];
}
