import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * PrincipalMgmtAgent provides comprehensive tools for managing Windchill users, groups, roles, and teams.
 *
 * This agent exposes the PTC Principal Management Domain capabilities for user and group
 * management, team configuration, and role assignments.
 *
 * **Priority 1 - User Management:**
 * - list_users: List all users with optional filtering
 * - get_user: Get detailed user information
 * - search_users: Search users by name or email
 * - get_user_groups: Get groups a user belongs to
 * - get_user_teams: Get teams a user participates in
 *
 * **Priority 2 - Group Management:**
 * - list_groups: List all groups
 * - get_group: Get detailed group information
 * - search_groups: Search groups by name
 * - get_group_members: Get all members of a group
 *
 * **Priority 3 - Team Management:**
 * - list_teams: List all teams in a context
 * - get_team: Get detailed team information
 * - get_team_members: Get team member list with roles
 * - search_teams: Search teams by name
 *
 * **Priority 4 - Role Management:**
 * - list_roles: List available roles
 * - get_user_roles: Get roles assigned to a user
 * - get_role_assignments: Get all assignments for a role
 *
 * **Note:** This domain is primarily read-only in Windchill 13.0.2 OData.
 * User/group creation and modification typically require custom APIs or Info*Engine.
 */
export class PrincipalMgmtAgent extends BaseAgent {
  protected agentName = 'principalmgmt';

  protected tools = [
    // === PRIORITY 1: USER MANAGEMENT ===
    {
      name: 'list_users',
      description: 'List all users in the Windchill system with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by user name (partial match)'
          },
          active: {
            type: 'boolean',
            description: 'Filter by active/inactive status'
          },
          organization: {
            type: 'string',
            description: 'Filter by organization'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          },
          select: {
            type: 'string',
            description: 'Comma-separated list of properties to return'
          }
        },
        required: []
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();
        const filters = [];

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (params.active !== undefined) {
          filters.push(`Active eq ${params.active}`);
        }

        if (params.organization) {
          filters.push(`contains(Organization,'${params.organization}')`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        if (params.select) {
          queryParams.append('$select', String(params.select));
        }

        const response = await this.api.get(
          `${apiEndpoints.users}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_user',
      description: 'Get detailed information for a specific user by OID or username',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User OID (e.g., "OR:wt.org.WTPrincipal:12345") or username'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "Groups,Teams")'
          }
        },
        required: ['userId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.users}('${params.userId}')?${queryString}`
          : `${apiEndpoints.users}('${params.userId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'search_users',
      description: 'Search for users by name or email with advanced filtering',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for name or email'
          },
          fullName: {
            type: 'string',
            description: 'Filter by full name (partial match)'
          },
          email: {
            type: 'string',
            description: 'Filter by email address (partial match)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: []
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();
        const filters = [];

        if (params.query) {
          filters.push(`(contains(Name,'${params.query}') or contains(Email,'${params.query}') or contains(FullName,'${params.query}'))`);
        }

        if (params.fullName) {
          filters.push(`contains(FullName,'${params.fullName}')`);
        }

        if (params.email) {
          filters.push(`contains(Email,'${params.email}')`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.users}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_user_groups',
      description: 'Get all groups that a user belongs to',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User OID or username'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of groups to return'
          }
        },
        required: ['userId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.users}('${params.userId}')/Groups?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_user_teams',
      description: 'Get all teams that a user participates in',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User OID or username'
          },
          context: {
            type: 'string',
            description: 'Filter by context/container'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of teams to return'
          }
        },
        required: ['userId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.context) {
          queryParams.append('$filter', `Context eq '${params.context}'`);
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.users}('${params.userId}')/Teams?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 2: GROUP MANAGEMENT ===
    {
      name: 'list_groups',
      description: 'List all groups in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by group name (partial match)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          },
          select: {
            type: 'string',
            description: 'Comma-separated list of properties to return'
          }
        },
        required: []
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();
        const filters = [];

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        if (params.select) {
          queryParams.append('$select', String(params.select));
        }

        const response = await this.api.get(
          `${apiEndpoints.groups}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_group',
      description: 'Get detailed information for a specific group',
      inputSchema: {
        type: 'object',
        properties: {
          groupId: {
            type: 'string',
            description: 'Group OID or group name'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "Members")'
          }
        },
        required: ['groupId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.groups}('${params.groupId}')?${queryString}`
          : `${apiEndpoints.groups}('${params.groupId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'search_groups',
      description: 'Search for groups by name or description',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for group name or description'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: ['query']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        queryParams.append('$filter', `(contains(Name,'${params.query}') or contains(Description,'${params.query}'))`);

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.groups}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_group_members',
      description: 'Get all members of a specific group',
      inputSchema: {
        type: 'object',
        properties: {
          groupId: {
            type: 'string',
            description: 'Group OID or group name'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of members to return'
          }
        },
        required: ['groupId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.groups}('${params.groupId}')/Members?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 3: TEAM MANAGEMENT ===
    {
      name: 'list_teams',
      description: 'List all teams in a specific context or across all contexts',
      inputSchema: {
        type: 'object',
        properties: {
          context: {
            type: 'string',
            description: 'Filter by context/container OID'
          },
          name: {
            type: 'string',
            description: 'Filter by team name (partial match)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: []
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();
        const filters = [];

        if (params.context) {
          filters.push(`Context eq '${params.context}'`);
        }

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.teams}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_team',
      description: 'Get detailed information for a specific team',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: {
            type: 'string',
            description: 'Team OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "Members,TeamLeader")'
          }
        },
        required: ['teamId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.teams}('${params.teamId}')?${queryString}`
          : `${apiEndpoints.teams}('${params.teamId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'get_team_members',
      description: 'Get all members of a team with their roles',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: {
            type: 'string',
            description: 'Team OID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of members to return'
          }
        },
        required: ['teamId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.teams}('${params.teamId}')/Members?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'search_teams',
      description: 'Search for teams by name or context',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for team name'
          },
          context: {
            type: 'string',
            description: 'Filter by context/container OID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: []
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();
        const filters = [];

        if (params.query) {
          filters.push(`contains(Name,'${params.query}')`);
        }

        if (params.context) {
          filters.push(`Context eq '${params.context}'`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.teams}?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 4: ROLE MANAGEMENT ===
    {
      name: 'list_roles',
      description: 'List all available roles in the Windchill system (EXPERIMENTAL - may require custom configuration)',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by role name (partial match)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: []
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();
        const filters = [];

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        // Note: Role endpoint may not be available in standard Windchill 13.0.2 OData
        const response = await this.api.get(
          `${apiEndpoints.principals}/Roles?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_user_roles',
      description: 'Get all roles assigned to a specific user (EXPERIMENTAL)',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User OID or username'
          },
          context: {
            type: 'string',
            description: 'Filter by context/container'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of roles to return'
          }
        },
        required: ['userId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.context) {
          queryParams.append('$filter', `Context eq '${params.context}'`);
        }

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.users}('${params.userId}')/Roles?${queryParams.toString()}`
        );
        return response.data;
      }
    }
  ];
}
