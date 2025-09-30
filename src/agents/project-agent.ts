import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

export class ProjectAgent extends BaseAgent {
  protected agentName = 'project';

  protected tools = [
    {
      name: 'list',
      description: 'List all projects',
      inputSchema: {
        type: 'object',
        properties: {
          state: { type: 'string', description: 'Project state filter' },
        },
      },
      handler: async (params: any) => {
        const queryParams = params.state ? `?$filter=State eq '${params.state}'` : '';
        const response = await this.api.get(`${apiEndpoints.projects}${queryParams}`);
        return response.data;
      },
    },
    {
      name: 'get_team',
      description: 'Get project team members',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
        },
        required: ['projectId'],
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.projects}('${params.projectId}')/Team`
        );
        return response.data;
      },
    },
  ];
}
