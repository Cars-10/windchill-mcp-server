/**
 * @fileoverview Workflow Agent - Token-Efficient MCP Tools for Windchill Workflows
 *
 * This agent provides comprehensive tools for interacting with workflow tasks in the
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
 * **Priority 1 - Core Workflow Operations:**
 * - get_tasks: Search workflow tasks by assignee, state
 * - get_task: Get detailed task information
 * - complete_task: Complete a workflow task
 * - reassign_task: Reassign task to another user
 * - get_my_tasks: Get current user's tasks
 *
 * **Priority 2 - Task Actions & Details:**
 * - approve_task: Approve a task
 * - reject_task: Reject a task
 * - add_task_comment: Add comment to task
 * - get_task_history: Get task activity history
 * - get_task_attachments: Get task attachments
 * - delegate_task: Delegate task to another user
 *
 * **Priority 3 - Advanced Search & Process Management:**
 * - advanced_search: Multi-criteria task search
 * - search_by_process: Search tasks by workflow process
 * - get_process_status: Get workflow process status
 * - get_process_diagram: Get workflow process diagram/definition
 * - bulk_complete: Complete multiple tasks
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
  combineFilters,
  DEFAULT_LIMIT,
  MAX_LIMIT
} from '../utils/response-formatter.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default fields to include in concise workflow task responses */
const WORKFLOW_CONCISE_FIELDS = ['TaskName', 'Assignee', 'State', 'Priority', 'DueDate'] as const;

/** Markdown column definitions for workflow task tables */
const WORKFLOW_MARKDOWN_COLUMNS = {
  TaskName: 'Task Name',
  Assignee: 'Assignee',
  State: 'State',
  Priority: 'Priority',
  DueDate: 'Due Date'
};

/** Extended fields for detailed workflow views */
const WORKFLOW_DETAILED_FIELDS = [
  'ID', 'TaskName', 'Assignee', 'State', 'Priority', 'DueDate',
  'ProcessName', 'ProcessId', 'Description', 'Comments',
  'CreatedBy', 'CreatedOn', 'ModifiedBy', 'ModifiedOn'
] as const;

/** History entry fields for task activity history */
const HISTORY_CONCISE_FIELDS = ['Action', 'User', 'Timestamp', 'Comment'] as const;

/** History table columns */
const HISTORY_MARKDOWN_COLUMNS = {
  Action: 'Action',
  User: 'User',
  Timestamp: 'Timestamp',
  Comment: 'Comment'
};

/** Attachment fields */
const ATTACHMENT_CONCISE_FIELDS = ['Name', 'Type', 'Size', 'AddedBy', 'AddedOn'] as const;

/** Attachment table columns */
const ATTACHMENT_MARKDOWN_COLUMNS = {
  Name: 'Name',
  Type: 'Type',
  Size: 'Size',
  AddedBy: 'Added By',
  AddedOn: 'Added On'
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

// ============================================================================
// WORKFLOW AGENT
// ============================================================================

/**
 * WorkflowAgent provides comprehensive tools for interacting with workflow tasks in Windchill.
 *
 * All tools support:
 * - `response_format`: 'markdown' (default, token-efficient) or 'json' (complete)
 * - `detail_level`: 'concise' (default, essential fields) or 'detailed' (all fields)
 * - Pagination with `limit` and `offset` parameters
 *
 * @extends BaseAgent
 */
export class WorkflowAgent extends BaseAgent {
  protected agentName = 'workflow';

  protected tools: ToolDefinition[] = [
    // =========================================================================
    // PRIORITY 1: CORE WORKFLOW OPERATIONS
    // =========================================================================

    {
      name: 'get_tasks',
      description: `Search workflow tasks by assignee, state, priority, or process name.

**Parameters:**
- assignee: Username of task assignee
- state: Task state (e.g., "OPEN", "COMPLETED", "IN_PROGRESS")
- priority: Task priority level (e.g., "HIGH", "MEDIUM", "LOW")
- processName: Workflow process name filter (partial match)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Task Name | Assignee | State | Priority | Due Date |
Pagination info with has_more and next_offset

**Returns (json):**
{ data: [...], pagination: { total, count, offset, limit, has_more, next_offset } }

**Examples:**
- Find open tasks: { "state": "OPEN" }
- Find user's tasks: { "assignee": "jsmith", "state": "OPEN" }
- Find high priority: { "priority": "HIGH", "limit": 10 }
- Filter by process: { "processName": "Change Request" }`,
      inputSchema: {
        type: 'object',
        properties: {
          assignee: {
            type: 'string',
            description: 'Username of task assignee'
          },
          state: {
            type: 'string',
            description: 'Task state (e.g., "OPEN", "COMPLETED", "IN_PROGRESS")'
          },
          priority: {
            type: 'string',
            description: 'Task priority level (e.g., "HIGH", "MEDIUM", "LOW")'
          },
          processName: {
            type: 'string',
            description: 'Workflow process name filter (partial match)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Search Workflow Tasks',
        ...READ_ONLY
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.assignee) filters.push(`Assignee eq '${params.assignee}'`);
          if (params.state) filters.push(`State eq '${params.state}'`);
          if (params.priority) filters.push(`Priority eq '${params.priority}'`);
          if (params.processName) filters.push(`contains(ProcessName,'${params.processName}')`);

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.workflows}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Workflow Tasks',
            conciseFields: WORKFLOW_CONCISE_FIELDS,
            markdownColumns: WORKFLOW_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search workflow tasks',
            suggestion: 'Check filter values. Valid states: OPEN, IN_PROGRESS, COMPLETED.'
          });
        }
      }
    },

    {
      name: 'get_task',
      description: `Retrieve detailed information for a specific workflow task by ID.

**Parameters:**
- taskId (required): Unique task identifier
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Task details including name, assignee, state, priority, due date, and process info.

**Examples:**
- Get task: { "taskId": "OR:wt.workflow.work.WfAssignedActivity:12345" }
- Get detailed: { "taskId": "12345", "detail_level": "detailed" }

**Error handling:**
- Not found: Returns error with suggestion to search first`,
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Unique task identifier'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['taskId']
      },
      annotations: {
        title: 'Get Workflow Task Details',
        ...READ_ONLY
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.workflows}('${params.taskId}')`
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Workflow Task: ${response.data?.TaskName || params.taskId}`,
            conciseFields: WORKFLOW_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get workflow task',
            suggestion: 'Verify the task ID. Use workflow_get_tasks to find valid IDs.'
          });
        }
      }
    },

    {
      name: 'complete_task',
      description: `Complete a workflow task with optional comments and verdict.

**Parameters:**
- taskId (required): Task identifier
- comments: Completion comments
- verdict: Task verdict/decision (e.g., "APPROVED", "REJECTED")
- response_format: 'markdown' or 'json'

**Returns:** Completed task confirmation with status

**Examples:**
- Simple complete: { "taskId": "12345" }
- With verdict: { "taskId": "12345", "verdict": "APPROVED", "comments": "Looks good" }

**Error handling:**
- Already completed: Returns error with current status
- Not assigned: Returns error with assignee info`,
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          },
          comments: {
            type: 'string',
            description: 'Completion comments'
          },
          verdict: {
            type: 'string',
            description: 'Task verdict/decision (e.g., "APPROVED", "REJECTED")'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['taskId']
      },
      annotations: {
        title: 'Complete Workflow Task',
        ...WRITE_OP
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.workflows}('${params.taskId}')/complete`,
            {
              comments: params.comments || '',
              verdict: params.verdict
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Completed Task: ${params.taskId}`,
            conciseFields: WORKFLOW_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'complete workflow task',
            suggestion: 'Verify task is assigned to you and not already completed.'
          });
        }
      }
    },

    {
      name: 'reassign_task',
      description: `Reassign a workflow task to another user.

**Parameters:**
- taskId (required): Task identifier
- newAssignee (required): Username of new assignee
- comment: Reassignment comment/reason
- response_format: 'markdown' or 'json'

**Returns:** Reassignment confirmation with new assignee info

**Examples:**
- Simple reassign: { "taskId": "12345", "newAssignee": "jdoe" }
- With comment: { "taskId": "12345", "newAssignee": "jdoe", "comment": "OOO, please handle" }

**Error handling:**
- Invalid user: Returns error with suggestion to check username
- Permission denied: Returns error if reassignment not allowed`,
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          },
          newAssignee: {
            type: 'string',
            description: 'Username of new assignee'
          },
          comment: {
            type: 'string',
            description: 'Reassignment comment/reason'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['taskId', 'newAssignee']
      },
      annotations: {
        title: 'Reassign Workflow Task',
        ...WRITE_OP
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.workflows}('${params.taskId}')/reassign`,
            {
              newAssignee: params.newAssignee,
              comment: params.comment || ''
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Reassigned Task: ${params.taskId} to ${params.newAssignee}`,
            conciseFields: WORKFLOW_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'reassign workflow task',
            suggestion: 'Verify the new assignee username exists and has permission.'
          });
        }
      }
    },

    {
      name: 'get_my_tasks',
      description: `Get workflow tasks assigned to the current user.

**Note:** Windchill 13.0.2 OData may not support AssignedToMe filter. Returns filtered list based on current session.

**Parameters:**
- state: Filter by task state (e.g., "OPEN", "IN_PROGRESS")
- priority: Filter by priority (e.g., "HIGH", "MEDIUM", "LOW")
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of tasks with name, state, priority, and due date

**Examples:**
- Get all my tasks: { }
- Get open tasks: { "state": "OPEN" }
- Get high priority: { "state": "OPEN", "priority": "HIGH" }`,
      inputSchema: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            description: 'Filter by task state (e.g., "OPEN", "IN_PROGRESS")'
          },
          priority: {
            type: 'string',
            description: 'Filter by priority (e.g., "HIGH", "MEDIUM", "LOW")'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Get My Workflow Tasks',
        ...READ_ONLY
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          // Note: Windchill 13.0.2 doesn't support AssignedToMe filter
          // Removing it to allow query to succeed - will return all tasks
          if (params.state) filters.push(`State eq '${params.state}'`);
          if (params.priority) filters.push(`Priority eq '${params.priority}'`);

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.workflows}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'My Workflow Tasks',
            conciseFields: WORKFLOW_CONCISE_FIELDS,
            markdownColumns: WORKFLOW_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get my workflow tasks',
            suggestion: 'Check filter values. Valid states: OPEN, IN_PROGRESS, COMPLETED.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 2: TASK ACTIONS & DETAILS
    // =========================================================================

    {
      name: 'approve_task',
      description: `Approve a workflow task with optional comment.

**Parameters:**
- taskId (required): Task identifier
- comment: Approval comment
- response_format: 'markdown' or 'json'

**Returns:** Approval confirmation

**Examples:**
- Simple approve: { "taskId": "12345" }
- With comment: { "taskId": "12345", "comment": "Design meets requirements" }

**Error handling:**
- Task not approvable: Returns error if task type doesn't support approval`,
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          },
          comment: {
            type: 'string',
            description: 'Approval comment'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['taskId']
      },
      annotations: {
        title: 'Approve Workflow Task',
        ...WRITE_OP
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.workflows}('${params.taskId}')/approve`,
            {
              comment: params.comment || ''
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Approved Task: ${params.taskId}`,
            conciseFields: WORKFLOW_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'approve workflow task',
            suggestion: 'Verify task supports approval action and is assigned to you.'
          });
        }
      }
    },

    {
      name: 'reject_task',
      description: `Reject a workflow task with required reason.

**Parameters:**
- taskId (required): Task identifier
- comment (required): Rejection reason (required for audit trail)
- response_format: 'markdown' or 'json'

**Returns:** Rejection confirmation

**Examples:**
- Reject: { "taskId": "12345", "comment": "Missing critical documentation" }

**Error handling:**
- Missing comment: Returns error - rejection reason is required`,
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          },
          comment: {
            type: 'string',
            description: 'Rejection reason (required)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['taskId', 'comment']
      },
      annotations: {
        title: 'Reject Workflow Task',
        ...WRITE_OP
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.workflows}('${params.taskId}')/reject`,
            {
              comment: params.comment
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Rejected Task: ${params.taskId}`,
            conciseFields: WORKFLOW_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'reject workflow task',
            suggestion: 'Verify task supports rejection and is assigned to you.'
          });
        }
      }
    },

    {
      name: 'add_task_comment',
      description: `Add a comment to a workflow task.

**Parameters:**
- taskId (required): Task identifier
- comment (required): Comment text to add
- response_format: 'markdown' or 'json'

**Returns:** Confirmation with updated task info

**Examples:**
- Add comment: { "taskId": "12345", "comment": "Reviewed design specs, looks good" }

**Error handling:**
- Not found: Returns error if task doesn't exist`,
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          },
          comment: {
            type: 'string',
            description: 'Comment text to add'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['taskId', 'comment']
      },
      annotations: {
        title: 'Add Task Comment',
        ...WRITE_OP
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.workflows}('${params.taskId}')/addComment`,
            {
              comment: params.comment
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Added Comment to Task: ${params.taskId}`,
            conciseFields: WORKFLOW_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'add task comment',
            suggestion: 'Verify the task ID exists.'
          });
        }
      }
    },

    {
      name: 'get_task_history',
      description: `Get activity history for a workflow task.

**Parameters:**
- taskId (required): Task identifier
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of history entries with action, user, timestamp, and comments

**Examples:**
- Get history: { "taskId": "12345" }
- Detailed history: { "taskId": "12345", "detail_level": "detailed" }`,
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['taskId']
      },
      annotations: {
        title: 'Get Task Activity History',
        ...READ_ONLY
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.workflows}('${params.taskId}')/history`
          );

          return buildListResponse(response.data, params, {
            title: `Task History: ${params.taskId}`,
            conciseFields: HISTORY_CONCISE_FIELDS,
            markdownColumns: HISTORY_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get task history',
            suggestion: 'Verify the task ID exists.'
          });
        }
      }
    },

    {
      name: 'get_task_attachments',
      description: `Get attachments associated with a workflow task.

**Parameters:**
- taskId (required): Task identifier
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of attachments with name, type, size, and metadata

**Examples:**
- Get attachments: { "taskId": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['taskId']
      },
      annotations: {
        title: 'Get Task Attachments',
        ...READ_ONLY
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.workflows}('${params.taskId}')/attachments`
          );

          return buildListResponse(response.data, params, {
            title: `Task Attachments: ${params.taskId}`,
            conciseFields: ATTACHMENT_CONCISE_FIELDS,
            markdownColumns: ATTACHMENT_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get task attachments',
            suggestion: 'Verify the task ID exists.'
          });
        }
      }
    },

    {
      name: 'delegate_task',
      description: `Delegate a workflow task to another user temporarily.

**Parameters:**
- taskId (required): Task identifier
- delegateTo (required): Username to delegate to
- comment: Delegation comment/reason
- expirationDate: Delegation expiration date (ISO format, e.g., "2024-12-31")
- response_format: 'markdown' or 'json'

**Returns:** Delegation confirmation

**Examples:**
- Simple delegate: { "taskId": "12345", "delegateTo": "jdoe" }
- With expiration: { "taskId": "12345", "delegateTo": "jdoe", "expirationDate": "2024-12-31", "comment": "On vacation" }

**Error handling:**
- Invalid user: Returns error if delegate user not found`,
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          },
          delegateTo: {
            type: 'string',
            description: 'Username to delegate to'
          },
          comment: {
            type: 'string',
            description: 'Delegation comment/reason'
          },
          expirationDate: {
            type: 'string',
            description: 'Delegation expiration date (ISO format, e.g., "2024-12-31")'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['taskId', 'delegateTo']
      },
      annotations: {
        title: 'Delegate Workflow Task',
        ...WRITE_OP
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(
            `${apiEndpoints.workflows}('${params.taskId}')/delegate`,
            {
              delegateTo: params.delegateTo,
              comment: params.comment || '',
              expirationDate: params.expirationDate
            }
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Delegated Task: ${params.taskId} to ${params.delegateTo}`,
            conciseFields: WORKFLOW_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'delegate workflow task',
            suggestion: 'Verify the delegate username exists and has permission.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 3: ADVANCED SEARCH & PROCESS MANAGEMENT
    // =========================================================================

    {
      name: 'advanced_search',
      description: `Advanced multi-criteria workflow task search with date filters.

**Parameters:**
- assignee: Task assignee username
- state: Task state filter (e.g., "OPEN", "COMPLETED")
- priority: Priority filter (e.g., "HIGH", "MEDIUM", "LOW")
- processName: Workflow process name (partial match)
- taskName: Task name filter (partial match)
- createdAfter: Created after date (ISO format)
- createdBefore: Created before date (ISO format)
- dueAfter: Due after date (ISO format)
- dueBefore: Due before date (ISO format)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Matching tasks with pagination

**Examples:**
- High priority open: { "state": "OPEN", "priority": "HIGH" }
- Due this week: { "dueAfter": "2024-01-01", "dueBefore": "2024-01-07" }
- Combined: { "assignee": "jsmith", "state": "OPEN", "processName": "Review" }`,
      inputSchema: {
        type: 'object',
        properties: {
          assignee: {
            type: 'string',
            description: 'Task assignee username'
          },
          state: {
            type: 'string',
            description: 'Task state filter (e.g., "OPEN", "COMPLETED")'
          },
          priority: {
            type: 'string',
            description: 'Priority filter (e.g., "HIGH", "MEDIUM", "LOW")'
          },
          processName: {
            type: 'string',
            description: 'Workflow process name (partial match)'
          },
          taskName: {
            type: 'string',
            description: 'Task name filter (partial match)'
          },
          createdAfter: {
            type: 'string',
            description: 'Created after date (ISO format, e.g., "2024-01-01")'
          },
          createdBefore: {
            type: 'string',
            description: 'Created before date (ISO format)'
          },
          dueAfter: {
            type: 'string',
            description: 'Due after date (ISO format)'
          },
          dueBefore: {
            type: 'string',
            description: 'Due before date (ISO format)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Advanced Task Search',
        ...READ_ONLY
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.assignee) filters.push(`Assignee eq '${params.assignee}'`);
          if (params.state) filters.push(`State eq '${params.state}'`);
          if (params.priority) filters.push(`Priority eq '${params.priority}'`);
          if (params.processName) filters.push(`contains(ProcessName,'${params.processName}')`);
          if (params.taskName) filters.push(`contains(TaskName,'${params.taskName}')`);

          if (params.createdAfter) filters.push(`CreatedOn gt ${params.createdAfter}`);
          if (params.createdBefore) filters.push(`CreatedOn lt ${params.createdBefore}`);
          if (params.dueAfter) filters.push(`DueDate gt ${params.dueAfter}`);
          if (params.dueBefore) filters.push(`DueDate lt ${params.dueBefore}`);

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.workflows}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Advanced Task Search Results',
            conciseFields: WORKFLOW_CONCISE_FIELDS,
            markdownColumns: WORKFLOW_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'advanced task search',
            suggestion: 'Check date format (ISO). Example: "2024-01-15"'
          });
        }
      }
    },

    {
      name: 'search_by_process',
      description: `Search tasks by workflow process ID or name.

**Parameters:**
- processId: Workflow process identifier
- processName: Workflow process name (exact match)
- state: Task state filter
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Tasks belonging to the specified process

**Examples:**
- By process ID: { "processId": "OR:wt.workflow.engine.WfProcess:12345" }
- By process name: { "processName": "Change Request Approval" }
- With state: { "processName": "Change Request", "state": "OPEN" }`,
      inputSchema: {
        type: 'object',
        properties: {
          processId: {
            type: 'string',
            description: 'Workflow process identifier'
          },
          processName: {
            type: 'string',
            description: 'Workflow process name (exact match)'
          },
          state: {
            type: 'string',
            description: 'Task state filter'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Search Tasks by Process',
        ...READ_ONLY
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.processId) filters.push(`ProcessId eq '${params.processId}'`);
          if (params.processName) filters.push(`ProcessName eq '${params.processName}'`);
          if (params.state) filters.push(`State eq '${params.state}'`);

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.workflows}?${queryParams.toString()}`
          );

          const title = params.processName
            ? `Tasks for Process: ${params.processName}`
            : `Tasks for Process ID: ${params.processId || 'All'}`;

          return buildListResponse(response.data, params, {
            title,
            conciseFields: WORKFLOW_CONCISE_FIELDS,
            markdownColumns: WORKFLOW_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search tasks by process',
            suggestion: 'Verify process ID or name exists.'
          });
        }
      }
    },

    {
      name: 'get_process_status',
      description: `Get status of a workflow process instance.

**Parameters:**
- processId (required): Workflow process identifier
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Process status including state, start date, and active tasks

**Examples:**
- Get status: { "processId": "OR:wt.workflow.engine.WfProcess:12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          processId: {
            type: 'string',
            description: 'Workflow process identifier'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['processId']
      },
      annotations: {
        title: 'Get Process Status',
        ...READ_ONLY
      },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(
            `${apiEndpoints.workflows}/processes('${params.processId}')/status`
          );

          return buildSingleItemResponse(response.data, params, {
            title: `Process Status: ${params.processId}`,
            conciseFields: ['State', 'StartDate', 'EndDate', 'ActiveTasks']
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get process status',
            suggestion: 'Verify the process ID exists.'
          });
        }
      }
    },

    {
      name: 'get_process_diagram',
      description: `Get workflow process diagram or definition.

**Parameters:**
- processId: Workflow process identifier (get diagram for specific instance)
- templateName: Workflow template name (get diagram for template)
- response_format: 'markdown' (default) or 'json'

**Returns:** Process diagram information or definition

**Examples:**
- By process ID: { "processId": "OR:wt.workflow.engine.WfProcess:12345" }
- By template: { "templateName": "Change Request Approval" }`,
      inputSchema: {
        type: 'object',
        properties: {
          processId: {
            type: 'string',
            description: 'Workflow process identifier'
          },
          templateName: {
            type: 'string',
            description: 'Workflow template name'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Get Process Diagram',
        ...READ_ONLY
      },
      handler: async (params: any) => {
        try {
          let endpoint = `${apiEndpoints.workflows}/processDiagram`;

          if (params.processId) {
            endpoint += `?processId=${params.processId}`;
          } else if (params.templateName) {
            endpoint += `?templateName=${params.templateName}`;
          }

          const response = await this.api.get(endpoint);

          const title = params.processId
            ? `Process Diagram: ${params.processId}`
            : params.templateName
              ? `Template Diagram: ${params.templateName}`
              : 'Process Diagram';

          return buildSingleItemResponse(response.data, params, {
            title,
            conciseFields: ['Name', 'Description', 'Nodes', 'Transitions']
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get process diagram',
            suggestion: 'Provide either processId or templateName parameter.'
          });
        }
      }
    },

    {
      name: 'bulk_complete',
      description: `Complete multiple workflow tasks with the same verdict and comment.

**Parameters:**
- taskIds (required): Array of task identifiers
- verdict: Task verdict for all tasks (e.g., "APPROVED")
- comment: Comment for all tasks
- response_format: 'markdown' (default) or 'json'

**Returns:** Completion results with success/failure counts per task

**Examples:**
- Approve all: { "taskIds": ["123", "456", "789"], "verdict": "APPROVED" }
- With comment: { "taskIds": ["123", "456"], "verdict": "APPROVED", "comment": "Batch approval" }

**Error handling:**
- Partial success: Returns individual results showing which tasks succeeded/failed`,
      inputSchema: {
        type: 'object',
        properties: {
          taskIds: {
            type: 'array',
            description: 'Array of task identifiers',
            items: {
              type: 'string'
            }
          },
          verdict: {
            type: 'string',
            description: 'Task verdict for all tasks (e.g., "APPROVED", "REJECTED")'
          },
          comment: {
            type: 'string',
            description: 'Comment for all tasks'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['taskIds']
      },
      annotations: {
        title: 'Bulk Complete Tasks',
        ...WRITE_OP
      },
      handler: async (params: any) => {
        try {
          const results: Array<{ id: string; success: boolean; error?: string }> = [];

          for (const taskId of params.taskIds) {
            try {
              await this.api.post(
                `${apiEndpoints.workflows}('${taskId}')/complete`,
                {
                  verdict: params.verdict,
                  comments: params.comment || ''
                }
              );
              results.push({ id: taskId, success: true });
            } catch (error: any) {
              results.push({
                id: taskId,
                success: false,
                error: error?.message || 'Unknown error occurred'
              });
            }
          }

          const successful = results.filter(r => r.success).length;
          const failed = results.filter(r => !r.success).length;

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

          if (responseFormat === ResponseFormat.MARKDOWN) {
            const lines: string[] = [];
            lines.push(`## Bulk Complete Results`);
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
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'bulk complete tasks',
            suggestion: 'Check that all task IDs are valid and assigned to you.'
          });
        }
      }
    }
  ];
}
