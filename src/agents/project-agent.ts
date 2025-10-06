import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

/**
 * ProjectAgent provides comprehensive tools for interacting with projects in the Windchill PLM system.
 *
 * This agent exposes project management tools organized in three priority tiers:
 *
 * **Priority 1 - Core Project Operations:**
 * - list: List/search projects
 * - get: Get detailed project information
 * - create: Create new projects
 * - update: Update project metadata
 * - get_team: Get project team members
 * - add_team_member: Add user to project team
 * - remove_team_member: Remove user from project team
 *
 * **Priority 2 - Project Content & Relationships:**
 * - get_project_objects: Get parts/documents in project
 * - add_project_object: Add part/document to project
 * - remove_project_object: Remove object from project
 * - get_project_activities: Get project activities/tasks
 * - get_project_deliverables: Get project deliverables
 *
 * **Priority 3 - Advanced Search & Operations:**
 * - advanced_search: Multi-criteria project search
 * - search_by_date_range: Search by project dates
 * - get_project_milestones: Get project milestones
 * - update_project_status: Update project status
 * - get_project_metrics: Get project metrics/statistics
 */
export class ProjectAgent extends BaseAgent {
  protected agentName = 'project';

  protected tools = [
    // === PRIORITY 1: CORE PROJECT OPERATIONS ===
    {
      name: 'list',
      description: 'List or search projects in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            description: 'Project state filter (e.g., "ACTIVE", "COMPLETED", "CANCELLED")'
          },
          name: {
            type: 'string',
            description: 'Project name filter (partial match)'
          },
          manager: {
            type: 'string',
            description: 'Project manager username filter'
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

        // Windchill 13.0.2 may not support State, Manager properties on Projects
        // Using only Name filter which is more likely to be supported
        if (params.name) filters.push(`contains(Name,'${params.name}')`);
        // if (params.state) filters.push(`State eq '${params.state}'`);
        // if (params.manager) filters.push(`Manager eq '${params.manager}'`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const queryString = queryParams.toString();
        const response = await this.api.get(
          `${apiEndpoints.projects}${queryString ? '?' + queryString : ''}`
        );
        return response.data;
      },
    },
    {
      name: 'get',
      description: 'Retrieve detailed information for a specific project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Unique project identifier'
          }
        },
        required: ['projectId']
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.projects}('${params.projectId}')`
        );
        return response.data;
      }
    },
    {
      name: 'create',
      description: 'Create a new project in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Project number (optional if auto-numbered)'
          },
          name: {
            type: 'string',
            description: 'Project name/title'
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
            description: 'Project start date (ISO format)'
          },
          endDate: {
            type: 'string',
            description: 'Project end date (ISO format)'
          },
          state: {
            type: 'string',
            description: 'Initial project state'
          },
          container: {
            type: 'string',
            description: 'Container/context where project should be created'
          }
        },
        required: ['name']
      },
      handler: async (params: any) => {
        const createData = {
          Number: params.number,
          Name: params.name,
          Description: params.description,
          Manager: params.manager,
          StartDate: params.startDate,
          EndDate: params.endDate,
          State: params.state || 'ACTIVE',
          Container: params.container
        };

        const response = await this.api.post(apiEndpoints.projects, createData);
        return response.data;
      }
    },
    {
      name: 'update',
      description: 'Update project metadata and properties',
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
            description: 'Updated start date'
          },
          endDate: {
            type: 'string',
            description: 'Updated end date'
          },
          attributes: {
            type: 'object',
            description: 'Custom attributes to update (key-value pairs)'
          }
        },
        required: ['projectId']
      },
      handler: async (params: any) => {
        const updateData: any = {};

        if (params.name) updateData.Name = params.name;
        if (params.description) updateData.Description = params.description;
        if (params.manager) updateData.Manager = params.manager;
        if (params.startDate) updateData.StartDate = params.startDate;
        if (params.endDate) updateData.EndDate = params.endDate;
        if (params.attributes) {
          Object.assign(updateData, params.attributes);
        }

        const response = await this.api.patch(
          `${apiEndpoints.projects}('${params.projectId}')`,
          updateData
        );
        return response.data;
      }
    },
    {
      name: 'get_team',
      description: 'Get all team members for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          role: {
            type: 'string',
            description: 'Filter by team role'
          }
        },
        required: ['projectId']
      },
      handler: async (params: any) => {
        let endpoint = `${apiEndpoints.projects}('${params.projectId}')/Team`;

        if (params.role) {
          endpoint += `?$filter=Role eq '${params.role}'`;
        }

        const response = await this.api.get(endpoint);
        return response.data;
      },
    },
    {
      name: 'add_team_member',
      description: 'Add a user to the project team',
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
            description: 'Team role (e.g., "MEMBER", "CONTRIBUTOR", "VIEWER")'
          }
        },
        required: ['projectId', 'username']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.projects}('${params.projectId}')/addTeamMember`,
          {
            username: params.username,
            role: params.role || 'MEMBER'
          }
        );
        return response.data;
      }
    },
    {
      name: 'remove_team_member',
      description: 'Remove a user from the project team',
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
          }
        },
        required: ['projectId', 'username']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.projects}('${params.projectId}')/removeTeamMember`,
          {
            username: params.username
          }
        );
        return response.data;
      }
    },
    // === PRIORITY 2: PROJECT CONTENT & RELATIONSHIPS ===
    {
      name: 'get_project_objects',
      description: 'Get parts and documents associated with a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          objectType: {
            type: 'string',
            description: 'Filter by object type (PART, DOCUMENT)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: ['projectId']
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();

        if (params.objectType) {
          queryParams.append('$filter', `ObjectType eq '${params.objectType}'`);
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const queryString = queryParams.toString();
        const response = await this.api.get(
          `${apiEndpoints.projects}('${params.projectId}')/objects${queryString ? '?' + queryString : ''}`
        );
        return response.data;
      }
    },
    {
      name: 'add_project_object',
      description: 'Add a part or document to a project',
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
            description: 'Type of object (PART, DOCUMENT)'
          },
          role: {
            type: 'string',
            description: 'Role of object in project'
          }
        },
        required: ['projectId', 'objectId', 'objectType']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.projects}('${params.projectId}')/addObject`,
          {
            objectId: params.objectId,
            objectType: params.objectType,
            role: params.role
          }
        );
        return response.data;
      }
    },
    {
      name: 'remove_project_object',
      description: 'Remove a part or document from a project',
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
          }
        },
        required: ['projectId', 'objectId']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.projects}('${params.projectId}')/removeObject`,
          {
            objectId: params.objectId
          }
        );
        return response.data;
      }
    },
    {
      name: 'get_project_activities',
      description: 'Get activities and tasks associated with a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          state: {
            type: 'string',
            description: 'Filter by activity state'
          }
        },
        required: ['projectId']
      },
      handler: async (params: any) => {
        let endpoint = `${apiEndpoints.projects}('${params.projectId}')/activities`;

        if (params.state) {
          endpoint += `?$filter=State eq '${params.state}'`;
        }

        const response = await this.api.get(endpoint);
        return response.data;
      }
    },
    {
      name: 'get_project_deliverables',
      description: 'Get project deliverables',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          status: {
            type: 'string',
            description: 'Filter by deliverable status'
          }
        },
        required: ['projectId']
      },
      handler: async (params: any) => {
        let endpoint = `${apiEndpoints.projects}('${params.projectId}')/deliverables`;

        if (params.status) {
          endpoint += `?$filter=Status eq '${params.status}'`;
        }

        const response = await this.api.get(endpoint);
        return response.data;
      }
    },
    // === PRIORITY 3: ADVANCED SEARCH & OPERATIONS ===
    {
      name: 'advanced_search',
      description: 'Advanced multi-criteria project search',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project name filter (partial match)'
          },
          number: {
            type: 'string',
            description: 'Project number filter'
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
            description: 'Created after date (ISO format)'
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

        if (params.name) filters.push(`contains(Name,'${params.name}')`);
        if (params.number) filters.push(`Number eq '${params.number}'`);
        if (params.state) filters.push(`State eq '${params.state}'`);
        if (params.manager) filters.push(`Manager eq '${params.manager}'`);

        if (params.createdAfter) filters.push(`CreatedOn gt ${params.createdAfter}`);
        if (params.createdBefore) filters.push(`CreatedOn lt ${params.createdBefore}`);
        if (params.startDateAfter) filters.push(`StartDate gt ${params.startDateAfter}`);
        if (params.endDateBefore) filters.push(`EndDate lt ${params.endDateBefore}`);

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const queryString = queryParams.toString();
        const response = await this.api.get(
          `${apiEndpoints.projects}${queryString ? '?' + queryString : ''}`
        );
        return response.data;
      }
    },
    {
      name: 'search_by_date_range',
      description: 'Search projects within a specific date range',
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
            description: 'Date field to search by',
            enum: ['CreatedOn', 'StartDate', 'EndDate']
          },
          state: {
            type: 'string',
            description: 'Project state filter'
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

        queryParams.append('$filter', filters.join(' and '));

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const queryString = queryParams.toString();
        const response = await this.api.get(
          `${apiEndpoints.projects}${queryString ? '?' + queryString : ''}`
        );
        return response.data;
      }
    },
    {
      name: 'get_project_milestones',
      description: 'Get milestones for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          status: {
            type: 'string',
            description: 'Filter by milestone status'
          }
        },
        required: ['projectId']
      },
      handler: async (params: any) => {
        let endpoint = `${apiEndpoints.projects}('${params.projectId}')/milestones`;

        if (params.status) {
          endpoint += `?$filter=Status eq '${params.status}'`;
        }

        const response = await this.api.get(endpoint);
        return response.data;
      }
    },
    {
      name: 'update_project_status',
      description: 'Update the status/state of a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          state: {
            type: 'string',
            description: 'New project state'
          },
          comment: {
            type: 'string',
            description: 'Status change comment'
          }
        },
        required: ['projectId', 'state']
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.projects}('${params.projectId}')/updateStatus`,
          {
            state: params.state,
            comment: params.comment || ''
          }
        );
        return response.data;
      }
    },
    {
      name: 'get_project_metrics',
      description: 'Get metrics and statistics for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project identifier'
          },
          metricType: {
            type: 'string',
            description: 'Type of metrics to retrieve (e.g., "PROGRESS", "RESOURCES", "DELIVERABLES")'
          }
        },
        required: ['projectId']
      },
      handler: async (params: any) => {
        let endpoint = `${apiEndpoints.projects}('${params.projectId}')/metrics`;

        if (params.metricType) {
          endpoint += `?type=${params.metricType}`;
        }

        const response = await this.api.get(endpoint);
        return response.data;
      }
    }
  ];
}
