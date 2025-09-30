import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

export class ChangeAgent extends BaseAgent {
  protected agentName = 'change';

  protected tools = [
    {
      name: 'search',
      description: 'Search for change requests',
      inputSchema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Change request number' },
          state: { type: 'string', description: 'Change request state' },
          priority: { type: 'string', description: 'Priority level' },
        },
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        if (params.number) queryParams.append('$filter', `Number eq '${params.number}'`);
        if (params.state) queryParams.append('$filter', `State eq '${params.state}'`);
        
        const response = await this.api.get(
          `${apiEndpoints.changes}?${queryParams.toString()}`
        );
        return response.data;
      },
    },
    {
      name: 'create',
      description: 'Create a new change request',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Change request name' },
          description: { type: 'string', description: 'Description' },
          priority: { type: 'string', description: 'Priority' },
        },
        required: ['name', 'description'],
      },
      handler: async (params: any) => {
        const response = await this.api.post(apiEndpoints.changes, params);
        return response.data;
      },
    },
  ];
}
