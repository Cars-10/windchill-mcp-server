import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

export class WorkflowAgent extends BaseAgent {
  protected agentName = 'workflow';

  protected tools = [
    {
      name: 'get_tasks',
      description: 'Get workflow tasks',
      inputSchema: {
        type: 'object',
        properties: {
          assignee: { type: 'string', description: 'Task assignee' },
          state: { type: 'string', description: 'Task state' },
        },
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        if (params.assignee) queryParams.append('$filter', `Assignee eq '${params.assignee}'`);
        if (params.state) queryParams.append('$filter', `State eq '${params.state}'`);
        
        const response = await this.api.get(
          `${apiEndpoints.workflows}?${queryParams.toString()}`
        );
        return response.data;
      },
    },
    {
      name: 'complete_task',
      description: 'Complete a workflow task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' },
          comments: { type: 'string', description: 'Completion comments' },
        },
        required: ['taskId'],
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.workflows}('${params.taskId}')/Complete`,
          { comments: params.comments }
        );
        return response.data;
      },
    },
  ];
}
