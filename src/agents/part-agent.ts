import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

export class PartAgent extends BaseAgent {
  protected agentName = 'part';

  protected tools = [
    {
      name: 'search',
      description: 'Search for parts in Windchill',
      inputSchema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Part number' },
          name: { type: 'string', description: 'Part name' },
          state: { type: 'string', description: 'Part state' },
        },
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        if (params.number) queryParams.append('$filter', `Number eq '${params.number}'`);
        if (params.name) queryParams.append('$filter', `Name eq '${params.name}'`);
        if (params.state) queryParams.append('$filter', `State eq '${params.state}'`);
        
        const response = await this.api.get(
          `${apiEndpoints.parts}?${queryParams.toString()}`
        );
        return response.data;
      },
    },
    {
      name: 'get',
      description: 'Get part details by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Part ID' },
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
      description: 'Create a new part',
      inputSchema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Part number' },
          name: { type: 'string', description: 'Part name' },
          description: { type: 'string', description: 'Part description' },
        },
        required: ['number', 'name'],
      },
      handler: async (params: any) => {
        const response = await this.api.post(apiEndpoints.parts, params);
        return response.data;
      },
    },
    {
      name: 'get_structure',
      description: 'Get part BOM structure',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Part ID' },
          levels: { type: 'number', description: 'Number of BOM levels to retrieve' },
        },
        required: ['id'],
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.parts}('${params.id}')/Structure?levels=${params.levels || 1}`
        );
        return response.data;
      },
    },
  ];
}
