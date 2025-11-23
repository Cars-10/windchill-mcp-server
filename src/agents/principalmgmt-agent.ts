/**
 * @fileoverview Principal Management Agent - Token-Efficient MCP Tools for Windchill Users, Groups, Roles & Teams
 *
 * This agent provides comprehensive tools for managing Windchill principals (users, groups, roles, teams),
 * optimized for LLM token efficiency.
 *
 * Features:
 * - Response format options (markdown/json)
 * - Detail levels (concise/detailed)
 * - Pagination with has_more, next_offset, total_count
 * - Character limit enforcement with truncation
 * - Tool annotations for MCP clients
 * - Comprehensive descriptions with usage examples
 *
 * **Note:** This domain is primarily read-only in Windchill 13.0.2 OData.
 * User/group creation and modification typically require custom APIs or Info*Engine.
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
  buildTextFilter,
  combineFilters,
  DEFAULT_LIMIT,
  MAX_LIMIT
} from '../utils/response-formatter.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default fields for concise user responses */
const USER_CONCISE_FIELDS = ['Name', 'FullName', 'Email', 'Active', 'Organization'] as const;

/** Default fields for concise group responses */
const GROUP_CONCISE_FIELDS = ['Name', 'Description', 'MemberCount'] as const;

/** Default fields for concise team responses */
const TEAM_CONCISE_FIELDS = ['Name', 'Context', 'MemberCount'] as const;

/** Default fields for concise role responses */
const ROLE_CONCISE_FIELDS = ['Name', 'Description', 'Context'] as const;

/** Markdown column definitions for user tables */
const USER_MARKDOWN_COLUMNS = {
  Name: 'Username',
  FullName: 'Full Name',
  Email: 'Email',
  Active: 'Active',
  Organization: 'Organization'
};

/** Markdown column definitions for group tables */
const GROUP_MARKDOWN_COLUMNS = {
  Name: 'Group Name',
  Description: 'Description',
  MemberCount: 'Members'
};

/** Markdown column definitions for team tables */
const TEAM_MARKDOWN_COLUMNS = {
  Name: 'Team Name',
  Context: 'Context',
  MemberCount: 'Members'
};

/** Markdown column definitions for role tables */
const ROLE_MARKDOWN_COLUMNS = {
  Name: 'Role Name',
  Description: 'Description',
  Context: 'Context'
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

// ============================================================================
// PRINCIPAL MANAGEMENT AGENT
// ============================================================================

/**
 * PrincipalMgmtAgent provides comprehensive tools for managing Windchill users, groups, roles, and teams.
 *
 * All tools support:
 * - `response_format`: 'markdown' (default, token-efficient) or 'json' (complete)
 * - `detail_level`: 'concise' (default, essential fields) or 'detailed' (all fields)
 * - Pagination with `limit` and `offset` parameters
 *
 * @extends BaseAgent
 */
export class PrincipalMgmtAgent extends BaseAgent {
  protected agentName = 'principalmgmt';

  protected tools: ToolDefinition[] = [
    // =========================================================================
    // PRIORITY 1: USER MANAGEMENT
    // =========================================================================

    {
      name: 'list_users',
      description: `List all users in the Windchill system with optional filtering and token-efficient responses.

**Parameters:**
- name: Filter by username (partial match with wildcard support)
- active: Filter by active/inactive status (true/false)
- organization: Filter by organization (partial match)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Username | Full Name | Email | Active | Organization |
Pagination info with has_more and next_offset

**Returns (json):**
{ data: [...], pagination: { total, count, offset, limit, has_more, next_offset } }

**Examples:**
- List active users: { "active": true }
- Find users in org: { "organization": "Engineering" }
- Paginate: { "offset": 20, "limit": 20 }

**Error handling:**
- Empty results: Returns helpful message with search suggestions`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by username (partial match, wildcards: "john*", "*smith")'
          },
          active: {
            type: 'boolean',
            description: 'Filter by active/inactive status'
          },
          organization: {
            type: 'string',
            description: 'Filter by organization (partial match)'
          },
          select: {
            type: 'string',
            description: 'Comma-separated list of properties to return (OData $select)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Users',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.name) {
            filters.push(buildTextFilter('Name', params.name));
          }

          if (params.active !== undefined) {
            filters.push(`Active eq ${params.active}`);
          }

          if (params.organization) {
            filters.push(buildTextFilter('Organization', params.organization));
          }

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          if (params.select) {
            queryParams.append('$select', String(params.select));
          }

          const response = await this.api.get(
            `${apiEndpoints.users}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Windchill Users',
            conciseFields: USER_CONCISE_FIELDS,
            markdownColumns: USER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list users',
            suggestion: 'Check filter syntax. Use wildcards like "john*" or "*smith".'
          });
        }
      }
    },

    {
      name: 'get_user',
      description: `Get detailed information for a specific user by OID or username.

**Parameters:**
- userId (required): User OID (e.g., "OR:wt.org.WTPrincipal:12345") or username
- expand: Navigation properties to expand (e.g., "Groups,Teams")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** User details with Username, Full Name, Email, Active status, Organization

**Examples:**
- Get by username: { "userId": "jsmith" }
- Get with groups: { "userId": "jsmith", "expand": "Groups" }
- Get detailed: { "userId": "jsmith", "detail_level": "detailed" }

**Error handling:**
- Not found: Returns error with suggestion to search first`,
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
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['userId']
      },
      annotations: {
        title: 'Get User Details',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();

          if (params.expand) {
            queryParams.append('$expand', String(params.expand));
          }

          const queryString = queryParams.toString();
          const url = queryString
            ? `${apiEndpoints.users}('${params.userId}')?${queryString}`
            : `${apiEndpoints.users}('${params.userId}')`;

          const response = await this.api.get(url);

          return buildSingleItemResponse(response.data, params, {
            title: `User: ${response.data?.Name || params.userId}`,
            conciseFields: USER_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get user',
            suggestion: 'Verify the user ID or username. Use list_users to find valid IDs.'
          });
        }
      }
    },

    {
      name: 'search_users',
      description: `Search for users by name or email with advanced filtering.

**Supports wildcards:** Use "*" for pattern matching (e.g., "john*", "*@company.com")

**Parameters:**
- query: Search query for name, email, or full name (searches all fields)
- fullName: Filter by full name specifically (partial match)
- email: Filter by email address specifically (partial match)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Username | Full Name | Email | Active | Organization |

**Examples:**
- Search by name: { "query": "john" }
- Search by email domain: { "email": "*@company.com" }
- Combined search: { "fullName": "John", "email": "*@engineering.com" }

**Error handling:**
- Empty results: Returns helpful message with search suggestions`,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for name, email, or full name (searches all fields)'
          },
          fullName: {
            type: 'string',
            description: 'Filter by full name specifically (partial match)'
          },
          email: {
            type: 'string',
            description: 'Filter by email address specifically (partial match)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Search Users',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.query) {
            // Search across multiple fields
            const searchValue = params.query.replace(/\*/g, '');
            filters.push(`(contains(Name,'${searchValue}') or contains(Email,'${searchValue}') or contains(FullName,'${searchValue}'))`);
          }

          if (params.fullName) {
            filters.push(buildTextFilter('FullName', params.fullName));
          }

          if (params.email) {
            filters.push(buildTextFilter('Email', params.email));
          }

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.users}?${queryParams.toString()}`
          );

          const searchTerm = params.query || params.fullName || params.email || 'all users';
          return buildListResponse(response.data, params, {
            title: `User Search: "${searchTerm}"`,
            conciseFields: USER_CONCISE_FIELDS,
            markdownColumns: USER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search users',
            suggestion: 'Check search syntax. Use wildcards like "john*" or "*@company.com".'
          });
        }
      }
    },

    {
      name: 'get_user_groups',
      description: `Get all groups that a user belongs to.

**Parameters:**
- userId (required): User OID or username
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of groups the user is a member of

**Example:** { "userId": "jsmith" }

**Error handling:**
- User not found: Returns error with suggestion to verify user ID`,
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User OID or username'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['userId']
      },
      annotations: {
        title: 'Get User Groups',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          const response = await this.api.get(
            `${apiEndpoints.users}('${params.userId}')/Groups?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Groups for User: ${params.userId}`,
            conciseFields: GROUP_CONCISE_FIELDS,
            markdownColumns: GROUP_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get user groups',
            suggestion: 'Verify the user ID or username. Use list_users to find valid users.'
          });
        }
      }
    },

    {
      name: 'get_user_teams',
      description: `Get all teams that a user participates in.

**Parameters:**
- userId (required): User OID or username
- context: Filter by context/container OID
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of teams the user participates in

**Examples:**
- All teams: { "userId": "jsmith" }
- Teams in context: { "userId": "jsmith", "context": "OR:wt.pdmlink.PDMLinkProduct:12345" }

**Error handling:**
- User not found: Returns error with suggestion to verify user ID`,
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User OID or username'
          },
          context: {
            type: 'string',
            description: 'Filter by context/container OID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['userId']
      },
      annotations: {
        title: 'Get User Teams',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.context) {
            filters.push(`Context eq '${params.context}'`);
          }

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.users}('${params.userId}')/Teams?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Teams for User: ${params.userId}`,
            conciseFields: TEAM_CONCISE_FIELDS,
            markdownColumns: TEAM_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get user teams',
            suggestion: 'Verify the user ID or username. Use list_users to find valid users.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 2: GROUP MANAGEMENT
    // =========================================================================

    {
      name: 'list_groups',
      description: `List all groups in the Windchill system with token-efficient responses.

**Parameters:**
- name: Filter by group name (partial match with wildcard support)
- select: Comma-separated list of properties to return (OData $select)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Group Name | Description | Members |
Pagination info with has_more and next_offset

**Examples:**
- List all groups: {}
- Find engineering groups: { "name": "*Engineering*" }
- Paginate: { "offset": 20, "limit": 20 }

**Error handling:**
- Empty results: Returns helpful message`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by group name (partial match, wildcards: "Admin*", "*Engineers")'
          },
          select: {
            type: 'string',
            description: 'Comma-separated list of properties to return (OData $select)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Groups',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.name) {
            filters.push(buildTextFilter('Name', params.name));
          }

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          if (params.select) {
            queryParams.append('$select', String(params.select));
          }

          const response = await this.api.get(
            `${apiEndpoints.groups}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Windchill Groups',
            conciseFields: GROUP_CONCISE_FIELDS,
            markdownColumns: GROUP_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list groups',
            suggestion: 'Check filter syntax. Use wildcards like "Admin*" or "*Engineers".'
          });
        }
      }
    },

    {
      name: 'get_group',
      description: `Get detailed information for a specific group.

**Parameters:**
- groupId (required): Group OID or group name
- expand: Navigation properties to expand (e.g., "Members")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Group details with Name, Description, Member count

**Examples:**
- Get by name: { "groupId": "Administrators" }
- Get with members: { "groupId": "Engineers", "expand": "Members" }

**Error handling:**
- Not found: Returns error with suggestion to search first`,
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
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['groupId']
      },
      annotations: {
        title: 'Get Group Details',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();

          if (params.expand) {
            queryParams.append('$expand', String(params.expand));
          }

          const queryString = queryParams.toString();
          const url = queryString
            ? `${apiEndpoints.groups}('${params.groupId}')?${queryString}`
            : `${apiEndpoints.groups}('${params.groupId}')`;

          const response = await this.api.get(url);

          return buildSingleItemResponse(response.data, params, {
            title: `Group: ${response.data?.Name || params.groupId}`,
            conciseFields: GROUP_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get group',
            suggestion: 'Verify the group ID or name. Use list_groups to find valid groups.'
          });
        }
      }
    },

    {
      name: 'search_groups',
      description: `Search for groups by name or description.

**Supports wildcards:** Use "*" for pattern matching (e.g., "*Admin*", "Engineering*")

**Parameters:**
- query (required): Search query for group name or description
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Group Name | Description | Members |

**Examples:**
- Search by name: { "query": "Admin" }
- Search by description: { "query": "engineering team" }

**Error handling:**
- Empty results: Returns helpful message with search suggestions`,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for group name or description'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['query']
      },
      annotations: {
        title: 'Search Groups',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const searchValue = params.query.replace(/\*/g, '');
          const filter = `(contains(Name,'${searchValue}') or contains(Description,'${searchValue}'))`;

          const queryParams = buildODataPagination(params);
          queryParams.append('$filter', filter);

          const response = await this.api.get(
            `${apiEndpoints.groups}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Group Search: "${params.query}"`,
            conciseFields: GROUP_CONCISE_FIELDS,
            markdownColumns: GROUP_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search groups',
            suggestion: 'Check search syntax. Try broader search terms.'
          });
        }
      }
    },

    {
      name: 'get_group_members',
      description: `Get all members of a specific group.

**Parameters:**
- groupId (required): Group OID or group name
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of users who are members of the group

**Example:** { "groupId": "Administrators" }

**Error handling:**
- Group not found: Returns error with suggestion to verify group ID`,
      inputSchema: {
        type: 'object',
        properties: {
          groupId: {
            type: 'string',
            description: 'Group OID or group name'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['groupId']
      },
      annotations: {
        title: 'Get Group Members',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          const response = await this.api.get(
            `${apiEndpoints.groups}('${params.groupId}')/Members?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Members of Group: ${params.groupId}`,
            conciseFields: USER_CONCISE_FIELDS,
            markdownColumns: USER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get group members',
            suggestion: 'Verify the group ID or name. Use list_groups to find valid groups.'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 3: TEAM MANAGEMENT
    // =========================================================================

    {
      name: 'list_teams',
      description: `List all teams in a specific context or across all contexts.

**Parameters:**
- context: Filter by context/container OID
- name: Filter by team name (partial match with wildcard support)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Team Name | Context | Members |
Pagination info with has_more and next_offset

**Examples:**
- List all teams: {}
- Teams in product: { "context": "OR:wt.pdmlink.PDMLinkProduct:12345" }
- Find design teams: { "name": "*Design*" }

**Error handling:**
- Empty results: Returns helpful message`,
      inputSchema: {
        type: 'object',
        properties: {
          context: {
            type: 'string',
            description: 'Filter by context/container OID'
          },
          name: {
            type: 'string',
            description: 'Filter by team name (partial match, wildcards supported)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Teams',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.context) {
            filters.push(`Context eq '${params.context}'`);
          }

          if (params.name) {
            filters.push(buildTextFilter('Name', params.name));
          }

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.teams}?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Windchill Teams',
            conciseFields: TEAM_CONCISE_FIELDS,
            markdownColumns: TEAM_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list teams',
            suggestion: 'Check filter syntax. Use wildcards like "*Design*".'
          });
        }
      }
    },

    {
      name: 'get_team',
      description: `Get detailed information for a specific team.

**Parameters:**
- teamId (required): Team OID
- expand: Navigation properties to expand (e.g., "Members,TeamLeader")
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Team details with Name, Context, Member count

**Examples:**
- Get team: { "teamId": "OR:wt.team.Team:12345" }
- Get with members: { "teamId": "OR:wt.team.Team:12345", "expand": "Members" }

**Error handling:**
- Not found: Returns error with suggestion to search first`,
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
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['teamId']
      },
      annotations: {
        title: 'Get Team Details',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = new URLSearchParams();

          if (params.expand) {
            queryParams.append('$expand', String(params.expand));
          }

          const queryString = queryParams.toString();
          const url = queryString
            ? `${apiEndpoints.teams}('${params.teamId}')?${queryString}`
            : `${apiEndpoints.teams}('${params.teamId}')`;

          const response = await this.api.get(url);

          return buildSingleItemResponse(response.data, params, {
            title: `Team: ${response.data?.Name || params.teamId}`,
            conciseFields: TEAM_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get team',
            suggestion: 'Verify the team OID. Use list_teams to find valid teams.'
          });
        }
      }
    },

    {
      name: 'get_team_members',
      description: `Get all members of a team with their roles.

**Parameters:**
- teamId (required): Team OID
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of team members with their assigned roles

**Example:** { "teamId": "OR:wt.team.Team:12345" }

**Error handling:**
- Team not found: Returns error with suggestion to verify team ID`,
      inputSchema: {
        type: 'object',
        properties: {
          teamId: {
            type: 'string',
            description: 'Team OID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['teamId']
      },
      annotations: {
        title: 'Get Team Members',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const queryParams = buildODataPagination(params);

          const response = await this.api.get(
            `${apiEndpoints.teams}('${params.teamId}')/Members?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Members of Team: ${params.teamId}`,
            conciseFields: USER_CONCISE_FIELDS,
            markdownColumns: USER_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get team members',
            suggestion: 'Verify the team OID. Use list_teams to find valid teams.'
          });
        }
      }
    },

    {
      name: 'search_teams',
      description: `Search for teams by name or context.

**Supports wildcards:** Use "*" for pattern matching (e.g., "*Design*", "Project*")

**Parameters:**
- query: Search query for team name (partial match)
- context: Filter by context/container OID
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Team Name | Context | Members |

**Examples:**
- Search by name: { "query": "Design" }
- Search in context: { "context": "OR:wt.pdmlink.PDMLinkProduct:12345" }
- Combined: { "query": "Review", "context": "OR:wt.pdmlink.PDMLinkProduct:12345" }

**Error handling:**
- Empty results: Returns helpful message with search suggestions`,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for team name (partial match)'
          },
          context: {
            type: 'string',
            description: 'Filter by context/container OID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Search Teams',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.query) {
            filters.push(buildTextFilter('Name', params.query));
          }

          if (params.context) {
            filters.push(`Context eq '${params.context}'`);
          }

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.teams}?${queryParams.toString()}`
          );

          const searchTerm = params.query || 'all teams';
          return buildListResponse(response.data, params, {
            title: `Team Search: "${searchTerm}"`,
            conciseFields: TEAM_CONCISE_FIELDS,
            markdownColumns: TEAM_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'search teams',
            suggestion: 'Check search syntax. Use wildcards like "*Design*".'
          });
        }
      }
    },

    // =========================================================================
    // PRIORITY 4: ROLE MANAGEMENT
    // =========================================================================

    {
      name: 'list_roles',
      description: `List all available roles in the Windchill system.

**Note:** EXPERIMENTAL - Role endpoint may not be available in standard Windchill 13.0.2 OData. May require custom configuration.

**Parameters:**
- name: Filter by role name (partial match with wildcard support)
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns (markdown):**
| Role Name | Description | Context |

**Examples:**
- List all roles: {}
- Find reviewer roles: { "name": "*Reviewer*" }

**Error handling:**
- Endpoint unavailable: Returns error with suggestion for alternative approaches`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by role name (partial match, wildcards supported)'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Roles (Experimental)',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.name) {
            filters.push(buildTextFilter('Name', params.name));
          }

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          // Note: Role endpoint may not be available in standard Windchill 13.0.2 OData
          const response = await this.api.get(
            `${apiEndpoints.principals}/Roles?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: 'Windchill Roles',
            conciseFields: ROLE_CONCISE_FIELDS,
            markdownColumns: ROLE_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list roles',
            suggestion: 'Role endpoint may not be available. Try get_team to see roles within a specific team context.'
          });
        }
      }
    },

    {
      name: 'get_user_roles',
      description: `Get all roles assigned to a specific user.

**Note:** EXPERIMENTAL - Role assignment retrieval may not be available in all Windchill configurations.

**Parameters:**
- userId (required): User OID or username
- context: Filter by context/container OID
- limit: Max results (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})
- offset: Skip N results for pagination
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** List of roles assigned to the user

**Examples:**
- All roles: { "userId": "jsmith" }
- Roles in context: { "userId": "jsmith", "context": "OR:wt.pdmlink.PDMLinkProduct:12345" }

**Error handling:**
- User not found: Returns error with suggestion to verify user ID
- Endpoint unavailable: Returns error with alternative approaches`,
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User OID or username'
          },
          context: {
            type: 'string',
            description: 'Filter by context/container OID'
          },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['userId']
      },
      annotations: {
        title: 'Get User Roles (Experimental)',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];

          if (params.context) {
            filters.push(`Context eq '${params.context}'`);
          }

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) {
            queryParams.append('$filter', combineFilters(filters));
          }

          const response = await this.api.get(
            `${apiEndpoints.users}('${params.userId}')/Roles?${queryParams.toString()}`
          );

          return buildListResponse(response.data, params, {
            title: `Roles for User: ${params.userId}`,
            conciseFields: ROLE_CONCISE_FIELDS,
            markdownColumns: ROLE_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get user roles',
            suggestion: 'Role retrieval may not be available. Try get_user_teams to see team memberships.'
          });
        }
      }
    }
  ];
}
