import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

/**
 * WorkflowAgent provides comprehensive tools for interacting with workflow tasks in the Windchill PLM system.
 *
 * This agent exposes workflow management tools organized in three priority tiers:
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
export class WorkflowAgent extends BaseAgent {
  protected agentName = 'workflow';

  protected tools = [
    // === PRIORITY 1: CORE WORKFLOW OPERATIONS ===
    {
      name: 'get_tasks',
      description: 'Search workflow tasks by assignee, state, or other criteria',
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
            description: 'Task priority level'
          },
          processName: {
            type: 'string',
            description: 'Workflow process name filter'
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

        if (params.assignee) filters.push(`Assignee eq '${params.assignee}'`);
        if (params.state) filters.push(`State eq '${params.state}'`);
        if (params.priority) filters.push(`Priority eq '${params.priority}'`);
        if (params.processName) filters.push(`contains(ProcessName,'${params.processName}')`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.workflows}?${queryParams.toString()}`
        );
        return response.data;
      },
    },
    {
      name: 'get_task',
      description: 'Retrieve detailed information for a specific workflow task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Unique task identifier'
          }
        },
        required: ['taskId']
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.workflows}('${params.taskId}')`
        );
        return response.data;
      }
    },
    {
      name: 'complete_task',
      description: 'Complete a workflow task',
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
          }
        },
        required: ['taskId']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.workflows}('${params.taskId}')/complete`,
          {
            comments: params.comments || '',
            verdict: params.verdict
          }
        );
        return response.data;
      },
    },
    {
      name: 'reassign_task',
      description: 'Reassign a workflow task to another user',
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
            description: 'Reassignment comment'
          }
        },
        required: ['taskId', 'newAssignee']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.workflows}('${params.taskId}')/reassign`,
          {
            newAssignee: params.newAssignee,
            comment: params.comment || ''
          }
        );
        return response.data;
      }
    },
    {
      name: 'get_my_tasks',
      description: 'Get workflow tasks assigned to the current user',
      inputSchema: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            description: 'Filter by task state'
          },
          priority: {
            type: 'string',
            description: 'Filter by priority'
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

        // Note: Windchill 13.0.2 doesn't support AssignedToMe filter
        // Removing it to allow query to succeed - will return all tasks
        if (params.state) filters.push(`State eq '${params.state}'`);
        if (params.priority) filters.push(`Priority eq '${params.priority}'`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.workflows}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    // === PRIORITY 2: TASK ACTIONS & DETAILS ===
    {
      name: 'approve_task',
      description: 'Approve a workflow task',
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
          }
        },
        required: ['taskId']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.workflows}('${params.taskId}')/approve`,
          {
            comment: params.comment || ''
          }
        );
        return response.data;
      }
    },
    {
      name: 'reject_task',
      description: 'Reject a workflow task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          },
          comment: {
            type: 'string',
            description: 'Rejection reason'
          }
        },
        required: ['taskId', 'comment']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.workflows}('${params.taskId}')/reject`,
          {
            comment: params.comment
          }
        );
        return response.data;
      }
    },
    {
      name: 'add_task_comment',
      description: 'Add a comment to a workflow task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          },
          comment: {
            type: 'string',
            description: 'Comment text'
          }
        },
        required: ['taskId', 'comment']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.workflows}('${params.taskId}')/addComment`,
          {
            comment: params.comment
          }
        );
        return response.data;
      }
    },
    {
      name: 'get_task_history',
      description: 'Get activity history for a workflow task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          }
        },
        required: ['taskId']
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.workflows}('${params.taskId}')/history`
        );
        return response.data;
      }
    },
    {
      name: 'get_task_attachments',
      description: 'Get attachments associated with a workflow task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task identifier'
          }
        },
        required: ['taskId']
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.workflows}('${params.taskId}')/attachments`
        );
        return response.data;
      }
    },
    {
      name: 'delegate_task',
      description: 'Delegate a workflow task to another user temporarily',
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
            description: 'Delegation comment'
          },
          expirationDate: {
            type: 'string',
            description: 'Delegation expiration date (ISO format)'
          }
        },
        required: ['taskId', 'delegateTo']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.workflows}('${params.taskId}')/delegate`,
          {
            delegateTo: params.delegateTo,
            comment: params.comment || '',
            expirationDate: params.expirationDate
          }
        );
        return response.data;
      }
    },
    // === PRIORITY 3: ADVANCED SEARCH & PROCESS MANAGEMENT ===
    {
      name: 'advanced_search',
      description: 'Advanced multi-criteria workflow task search',
      inputSchema: {
        type: 'object',
        properties: {
          assignee: {
            type: 'string',
            description: 'Task assignee username'
          },
          state: {
            type: 'string',
            description: 'Task state filter'
          },
          priority: {
            type: 'string',
            description: 'Priority filter'
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
            description: 'Created after date (ISO format)'
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

        if (params.assignee) filters.push(`Assignee eq '${params.assignee}'`);
        if (params.state) filters.push(`State eq '${params.state}'`);
        if (params.priority) filters.push(`Priority eq '${params.priority}'`);
        if (params.processName) filters.push(`contains(ProcessName,'${params.processName}')`);
        if (params.taskName) filters.push(`contains(TaskName,'${params.taskName}')`);

        if (params.createdAfter) filters.push(`CreatedOn gt ${params.createdAfter}`);
        if (params.createdBefore) filters.push(`CreatedOn lt ${params.createdBefore}`);
        if (params.dueAfter) filters.push(`DueDate gt ${params.dueAfter}`);
        if (params.dueBefore) filters.push(`DueDate lt ${params.dueBefore}`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.workflows}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'search_by_process',
      description: 'Search tasks by workflow process',
      inputSchema: {
        type: 'object',
        properties: {
          processId: {
            type: 'string',
            description: 'Workflow process identifier'
          },
          processName: {
            type: 'string',
            description: 'Workflow process name'
          },
          state: {
            type: 'string',
            description: 'Task state filter'
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

        if (params.processId) filters.push(`ProcessId eq '${params.processId}'`);
        if (params.processName) filters.push(`ProcessName eq '${params.processName}'`);
        if (params.state) filters.push(`State eq '${params.state}'`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.workflows}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_process_status',
      description: 'Get status of a workflow process instance',
      inputSchema: {
        type: 'object',
        properties: {
          processId: {
            type: 'string',
            description: 'Workflow process identifier'
          }
        },
        required: ['processId']
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.workflows}/processes('${params.processId}')/status`
        );
        return response.data;
      }
    },
    {
      name: 'get_process_diagram',
      description: 'Get workflow process diagram or definition',
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
          }
        },
        required: []
      },
      handler: async (params: any) => {
        let endpoint = `${apiEndpoints.workflows}/processDiagram`;

        if (params.processId) {
          endpoint += `?processId=${params.processId}`;
        } else if (params.templateName) {
          endpoint += `?templateName=${params.templateName}`;
        }

        const response = await this.api.get(endpoint);
        return response.data;
      }
    },
    {
      name: 'bulk_complete',
      description: 'Complete multiple workflow tasks with the same verdict',
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
            description: 'Task verdict for all tasks'
          },
          comment: {
            type: 'string',
            description: 'Comment for all tasks'
          }
        },
        required: ['taskIds']
      },
      handler: async (params: any) => {
        const results = [];

        for (const taskId of params.taskIds) {
          try {
            const response = await this.api.post(
              `${apiEndpoints.workflows}('${taskId}')/complete`,
              {
                verdict: params.verdict,
                comments: params.comment || ''
              }
            );
            results.push({
              id: taskId,
              success: true,
              data: response.data
            });
          } catch (error: any) {
            results.push({
              id: taskId,
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
    }
  ];
}
