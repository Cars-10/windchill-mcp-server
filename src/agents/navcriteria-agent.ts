import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * NavCriteriaAgent provides tools for managing BOM navigation criteria and structure filters.
 *
 * This agent exposes the PTC Navigation Criteria Domain capabilities for filtering and
 * configuring how part structures (BOMs) are viewed and navigated.
 *
 * **Priority 1 - Navigation Criteria Management:**
 * - list_nav_criteria: List all navigation criteria
 * - get_nav_criteria: Get detailed navigation criteria information
 * - search_nav_criteria: Search navigation criteria by name
 *
 * **Priority 2 - Filter Configuration:**
 * - get_filter_expression: Get the filter expression for a navigation criteria
 * - list_filter_types: List available filter types
 *
 * **Priority 3 - Application & Usage:**
 * - get_applied_criteria: Get navigation criteria applied to a part structure
 * - get_default_criteria: Get default navigation criteria for a container
 *
 * **Note:** Navigation Criteria are used to filter BOM structures based on various rules
 * such as lifecycle state, effectivity, or custom attributes. This domain is typically
 * read-only in Windchill 13.0.2 OData. Creation/modification requires admin tools.
 */
export class NavCriteriaAgent extends BaseAgent {
  protected agentName = 'navcriteria';

  protected tools = [
    // === PRIORITY 1: NAVIGATION CRITERIA MANAGEMENT ===
    {
      name: 'list_nav_criteria',
      description: 'List all navigation criteria available in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by criteria name (partial match)'
          },
          filterType: {
            type: 'string',
            description: 'Filter by type (e.g., "LifecycleState", "Effectivity", "Custom")'
          },
          container: {
            type: 'string',
            description: 'Filter by container/context OID'
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

        if (params.filterType) {
          filters.push(`FilterType eq '${params.filterType}'`);
        }

        if (params.container) {
          filters.push(`Container eq '${params.container}'`);
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
          `${apiEndpoints.navCriteria}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_nav_criteria',
      description: 'Get detailed information for a specific navigation criteria',
      inputSchema: {
        type: 'object',
        properties: {
          criteriaId: {
            type: 'string',
            description: 'Navigation criteria OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "FilterExpression")'
          }
        },
        required: ['criteriaId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.navCriteria}('${params.criteriaId}')?${queryString}`
          : `${apiEndpoints.navCriteria}('${params.criteriaId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'search_nav_criteria',
      description: 'Search for navigation criteria by name or description',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for criteria name or description'
          },
          filterType: {
            type: 'string',
            description: 'Filter by specific type'
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
        const filters = [`(contains(Name,'${params.query}') or contains(Description,'${params.query}'))`];

        if (params.filterType) {
          filters.push(`FilterType eq '${params.filterType}'`);
        }

        queryParams.append('$filter', filters.join(' and '));

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.navCriteria}?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 2: FILTER CONFIGURATION ===
    {
      name: 'get_filter_expression',
      description: 'Get the filter expression for a specific navigation criteria',
      inputSchema: {
        type: 'object',
        properties: {
          criteriaId: {
            type: 'string',
            description: 'Navigation criteria OID'
          }
        },
        required: ['criteriaId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(
          `${apiEndpoints.navCriteria}('${params.criteriaId}')/FilterExpression`
        );
        return response.data;
      }
    },
    {
      name: 'list_filter_types',
      description: 'List all available filter types for navigation criteria (EXPERIMENTAL)',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of filter types to return'
          }
        },
        required: []
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        // Note: This endpoint may not be available in standard Windchill 13.0.2
        const response = await this.api.get(
          `${apiEndpoints.navCriteria}/FilterTypes?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 3: APPLICATION & USAGE ===
    {
      name: 'get_applied_criteria',
      description: 'Get navigation criteria currently applied to a part structure view (EXPERIMENTAL)',
      inputSchema: {
        type: 'object',
        properties: {
          partId: {
            type: 'string',
            description: 'Part OID to check applied criteria'
          },
          viewName: {
            type: 'string',
            description: 'View name (e.g., "Design", "Manufacturing")'
          }
        },
        required: ['partId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.viewName) {
          queryParams.append('$filter', `ViewName eq '${params.viewName}'`);
        }

        const response = await this.api.get(
          `${apiEndpoints.parts}('${params.partId}')/AppliedNavigationCriteria?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_default_criteria',
      description: 'Get default navigation criteria for a container/context',
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID (product/library) to get default criteria'
          },
          viewName: {
            type: 'string',
            description: 'View name to get specific default criteria'
          }
        },
        required: ['containerId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.viewName) {
          queryParams.append('$filter', `ViewName eq '${params.viewName}'`);
        }

        const response = await this.api.get(
          `${apiEndpoints.containers}('${params.containerId}')/DefaultNavigationCriteria?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_criteria_by_view',
      description: 'Get navigation criteria filtered by view type',
      inputSchema: {
        type: 'object',
        properties: {
          viewName: {
            type: 'string',
            description: 'View name (e.g., "Design", "Manufacturing")'
          },
          container: {
            type: 'string',
            description: 'Filter by container/context OID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: ['viewName']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();
        const filters = [`ViewName eq '${params.viewName}'`];

        if (params.container) {
          filters.push(`Container eq '${params.container}'`);
        }

        queryParams.append('$filter', filters.join(' and '));

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.navCriteria}?${queryParams.toString()}`
        );
        return response.data;
      }
    }
  ];
}
