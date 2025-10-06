import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';

/**
 * ProdPlatformMgmtAgent provides comprehensive tools for managing Windchill Options & Variants.
 *
 * This agent exposes the PTC Product Platform Management Domain capabilities for configuring
 * product variants using options, choices, and option sets.
 *
 * **Priority 1 - Option Management:**
 * - list_options: List all options in an option pool
 * - get_option: Get detailed option information
 * - search_options: Search options by name
 * - get_option_choices: Get all choices for an option
 *
 * **Priority 2 - Option Set Management:**
 * - list_option_sets: List all option sets
 * - get_option_set: Get detailed option set information
 * - search_option_sets: Search option sets
 * - get_option_set_assignments: Get objects using an option set
 *
 * **Priority 3 - Choice Management:**
 * - list_choices: List all choices for an option group
 * - get_choice: Get detailed choice information
 * - search_choices: Search choices by name
 *
 * **Priority 4 - Variant Configuration:**
 * - get_variant_expression: Get variant expression for a part/document
 * - validate_variant_expression: Validate a variant expression (EXPERIMENTAL)
 *
 * **Note:** This domain requires Windchill Product Platform Management (Options & Variants) module.
 * Many operations are read-only in Windchill 13.0.2 OData.
 */
export class ProdPlatformMgmtAgent extends BaseAgent {
  protected agentName = 'prodplatformmgmt';

  protected tools = [
    // === PRIORITY 1: OPTION MANAGEMENT ===
    {
      name: 'list_options',
      description: 'List all options in the Windchill system or within a specific option pool',
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID (product/library) to get options from'
          },
          name: {
            type: 'string',
            description: 'Filter by option name (partial match)'
          },
          optionGroup: {
            type: 'string',
            description: 'Filter by option group'
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

        if (params.optionGroup) {
          filters.push(`OptionGroup eq '${params.optionGroup}'`);
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

        // If container specified, get options from that container's option pool
        const baseUrl = params.containerId
          ? `${apiEndpoints.containers}('${params.containerId}')/OptionPool/PTC.ProdPlatformMgmt.Option`
          : `${apiEndpoints.options}`;

        const response = await this.api.get(
          `${baseUrl}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_option',
      description: 'Get detailed information for a specific option',
      inputSchema: {
        type: 'object',
        properties: {
          optionId: {
            type: 'string',
            description: 'Option OID (e.g., "OR:wt.option.Option:12345")'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "Choices,OptionGroup")'
          }
        },
        required: ['optionId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.options}('${params.optionId}')?${queryString}`
          : `${apiEndpoints.options}('${params.optionId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'search_options',
      description: 'Search for options by name or description',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for option name or description'
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
          `${apiEndpoints.options}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_option_choices',
      description: 'Get all choices available for a specific option',
      inputSchema: {
        type: 'object',
        properties: {
          optionId: {
            type: 'string',
            description: 'Option OID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of choices to return'
          }
        },
        required: ['optionId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.options}('${params.optionId}')/Choices?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 2: OPTION SET MANAGEMENT ===
    {
      name: 'list_option_sets',
      description: 'List all option sets in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID to filter option sets by container'
          },
          name: {
            type: 'string',
            description: 'Filter by option set name (partial match)'
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

        if (params.containerId) {
          filters.push(`Container eq '${params.containerId}'`);
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
          `${apiEndpoints.optionSets}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_option_set',
      description: 'Get detailed information for a specific option set',
      inputSchema: {
        type: 'object',
        properties: {
          optionSetId: {
            type: 'string',
            description: 'Option set OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "Options,AssignedObjects")'
          }
        },
        required: ['optionSetId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.optionSets}('${params.optionSetId}')?${queryString}`
          : `${apiEndpoints.optionSets}('${params.optionSetId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'search_option_sets',
      description: 'Search for option sets by name or description',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for option set name or description'
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
          `${apiEndpoints.optionSets}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_option_set_assignments',
      description: 'Get all objects (parts/documents) assigned to a specific option set',
      inputSchema: {
        type: 'object',
        properties: {
          optionSetId: {
            type: 'string',
            description: 'Option set OID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of assignments to return'
          }
        },
        required: ['optionSetId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', String(params.limit));
        }

        const response = await this.api.get(
          `${apiEndpoints.optionSets}('${params.optionSetId}')/AssignedObjects?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 3: CHOICE MANAGEMENT ===
    {
      name: 'list_choices',
      description: 'List all choices for options in an option pool or across the system',
      inputSchema: {
        type: 'object',
        properties: {
          optionId: {
            type: 'string',
            description: 'Filter by specific option OID'
          },
          name: {
            type: 'string',
            description: 'Filter by choice name (partial match)'
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

        // If option specified, get choices from that option
        const baseUrl = params.optionId
          ? `${apiEndpoints.options}('${params.optionId}')/Choices`
          : `${apiEndpoints.prodPlatform}/Choices`;

        const response = await this.api.get(
          `${baseUrl}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_choice',
      description: 'Get detailed information for a specific choice',
      inputSchema: {
        type: 'object',
        properties: {
          choiceId: {
            type: 'string',
            description: 'Choice OID'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand'
          }
        },
        required: ['choiceId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', String(params.expand));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.prodPlatform}/Choices('${params.choiceId}')?${queryString}`
          : `${apiEndpoints.prodPlatform}/Choices('${params.choiceId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'search_choices',
      description: 'Search for choices by name or description',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for choice name or description'
          },
          optionId: {
            type: 'string',
            description: 'Filter by specific option OID'
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

        const baseUrl = params.optionId
          ? `${apiEndpoints.options}('${params.optionId}')/Choices`
          : `${apiEndpoints.prodPlatform}/Choices`;

        const response = await this.api.get(
          `${baseUrl}?${queryParams.toString()}`
        );
        return response.data;
      }
    },

    // === PRIORITY 4: VARIANT CONFIGURATION ===
    {
      name: 'get_variant_expression',
      description: 'Get the variant expression for a configurable part or document (EXPERIMENTAL)',
      inputSchema: {
        type: 'object',
        properties: {
          objectId: {
            type: 'string',
            description: 'Part or document OID'
          },
          objectType: {
            type: 'string',
            description: 'Object type (Part or Document)',
            enum: ['Part', 'Document']
          }
        },
        required: ['objectId', 'objectType']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const endpoint = params.objectType === 'Part'
          ? `${apiEndpoints.parts}('${params.objectId}')/VariantExpression`
          : `${apiEndpoints.documents}('${params.objectId}')/VariantExpression`;

        const response = await this.api.get(endpoint);
        return response.data;
      }
    },
    {
      name: 'validate_variant_expression',
      description: 'Validate a variant expression against an option pool (EXPERIMENTAL - requires custom API)',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Variant expression to validate (e.g., "Color=Red AND Size=Large")'
          },
          containerId: {
            type: 'string',
            description: 'Container OID (product/library) with option pool'
          }
        },
        required: ['expression', 'containerId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        // Note: This may require a custom POST endpoint for validation
        // Standard OData may not support this operation
        const response = await this.api.post(
          `${apiEndpoints.containers}('${params.containerId}')/ValidateVariantExpression`,
          {
            expression: params.expression
          }
        );
        return response.data;
      }
    }
  ];
}
