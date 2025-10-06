import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

/**
 * DataAdminAgent provides comprehensive tools for querying Windchill containers and contexts.
 *
 * This agent exposes the PTC Data Administration Domain capabilities for discovering and
 * accessing Windchill organizational structures including products, libraries, projects,
 * and organizational containers.
 *
 * **Priority 1 - Container Discovery:**
 * - list_containers: List all containers
 * - list_products: List all product containers
 * - list_libraries: List all library containers
 * - list_organizations: List all organization containers
 * - list_projects: List all project containers
 * - get_container: Get specific container details
 *
 * **Priority 2 - Container Content & Structure:**
 * - get_container_folders: Get folders in a container
 * - get_folder_contents: Get contents of a specific folder
 * - search_containers: Advanced container search
 *
 * **Priority 3 - Product/Library Options:**
 * - get_product_options: Get option pool for a product
 * - get_library_options: Get option pool for a library
 * - get_option_sets: Get assigned option sets
 *
 * **Note:** The DataAdmin domain is read-only. No create, update, or delete operations
 * are supported by Windchill REST Services for container management.
 */
export class DataAdminAgent extends BaseAgent {
  protected agentName = 'dataadmin';

  protected tools = [
    // === PRIORITY 1: CONTAINER DISCOVERY ===
    {
      name: 'list_containers',
      description: 'List all containers (contexts) available in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          },
          select: {
            type: 'string',
            description: 'Comma-separated list of properties to return (e.g., "Name,ID,Type")'
          }
        },
        required: []
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        if (params.select) {
          queryParams.append('$select', params.select);
        }

        const response = await this.api.get(
          `${apiEndpoints.containers}?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'list_products',
      description: 'List all product containers in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by product name (partial match)'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "OptionPool")'
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

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.expand) {
          queryParams.append('$expand', params.expand);
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.containers}/PTC.DataAdmin.ProductContainer?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'list_libraries',
      description: 'List all library containers in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by library name (partial match)'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "OptionPool")'
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

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.expand) {
          queryParams.append('$expand', params.expand);
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.containers}/PTC.DataAdmin.LibraryContainer?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'list_organizations',
      description: 'List all organization containers in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by organization name (partial match)'
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

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.containers}/PTC.DataAdmin.OrganizationContainer?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'list_projects',
      description: 'List all project containers in the Windchill system',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by project name (partial match)'
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

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.containers}/PTC.DataAdmin.ProjectContainer?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_container',
      description: 'Get detailed information for a specific container by its OID',
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID (e.g., "OR:wt.pdmlink.PDMLinkProduct:12345")'
          },
          expand: {
            type: 'string',
            description: 'Navigation properties to expand (e.g., "OptionPool,Folders")'
          }
        },
        required: ['containerId']
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', params.expand);
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${apiEndpoints.containers}('${params.containerId}')?${queryString}`
          : `${apiEndpoints.containers}('${params.containerId}')`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    // === PRIORITY 2: CONTAINER CONTENT & STRUCTURE ===
    {
      name: 'get_container_folders',
      description: 'Get folders within a specific container',
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of folders to return'
          }
        },
        required: ['containerId']
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.containers}('${params.containerId}')/Folders?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'get_folder_contents',
      description: 'Get contents of a specific folder within a container',
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Container OID'
          },
          folderId: {
            type: 'string',
            description: 'Folder OID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of items to return'
          }
        },
        required: ['containerId', 'folderId']
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.containers}('${params.containerId}')/Folders('${params.folderId}')/FolderContent?${queryParams.toString()}`
        );
        return response.data;
      }
    },
    {
      name: 'search_containers',
      description: 'Advanced search for containers with multiple criteria',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Container name filter (partial match)'
          },
          type: {
            type: 'string',
            description: 'Container type (Product, Library, Organization, Project)',
            enum: ['Product', 'Library', 'Organization', 'Project']
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

        if (params.name) {
          filters.push(`contains(Name,'${params.name}')`);
        }

        if (filters.length > 0) {
          queryParams.append('$filter', filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        // Build URL based on type filter
        let url = apiEndpoints.containers;
        if (params.type) {
          const typeMap: any = {
            'Product': 'PTC.DataAdmin.ProductContainer',
            'Library': 'PTC.DataAdmin.LibraryContainer',
            'Organization': 'PTC.DataAdmin.OrganizationContainer',
            'Project': 'PTC.DataAdmin.ProjectContainer'
          };
          url += `/${typeMap[params.type]}`;
        }

        const response = await this.api.get(`${url}?${queryParams.toString()}`);
        return response.data;
      }
    },
    // === PRIORITY 3: PRODUCT/LIBRARY OPTIONS ===
    {
      name: 'get_product_options',
      description: 'Get option pool (configuration options) for a product container',
      inputSchema: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'Product container OID'
          },
          optionType: {
            type: 'string',
            description: 'Type of options to retrieve (OptionGroup, Option)',
            enum: ['OptionGroup', 'Option']
          }
        },
        required: ['productId']
      },
      handler: async (params: any) => {
        let url = `${apiEndpoints.containers}/PTC.DataAdmin.ProductContainer('${params.productId}')/OptionPool`;

        if (params.optionType) {
          url += `/PTC.ProdPlatformMgmt.${params.optionType}`;
        }

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'get_library_options',
      description: 'Get option pool (configuration options) for a library container',
      inputSchema: {
        type: 'object',
        properties: {
          libraryId: {
            type: 'string',
            description: 'Library container OID'
          },
          optionType: {
            type: 'string',
            description: 'Type of options to retrieve (OptionGroup, Option)',
            enum: ['OptionGroup', 'Option']
          }
        },
        required: ['libraryId']
      },
      handler: async (params: any) => {
        let url = `${apiEndpoints.containers}/PTC.DataAdmin.LibraryContainer('${params.libraryId}')/OptionPool`;

        if (params.optionType) {
          url += `/PTC.ProdPlatformMgmt.${params.optionType}`;
        }

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'get_option_sets',
      description: 'Get assigned option sets for a product or library container',
      inputSchema: {
        type: 'object',
        properties: {
          containerId: {
            type: 'string',
            description: 'Product or library container OID'
          },
          containerType: {
            type: 'string',
            description: 'Type of container (Product or Library)',
            enum: ['Product', 'Library']
          }
        },
        required: ['containerId', 'containerType']
      },
      handler: async (params: any) => {
        const containerTypeMap: any = {
          'Product': 'PTC.DataAdmin.ProductContainer',
          'Library': 'PTC.DataAdmin.LibraryContainer'
        };

        const containerType = containerTypeMap[params.containerType];
        const url = `${apiEndpoints.containers}/${containerType}('${params.containerId}')/AssignedOptionSet`;

        const response = await this.api.get(url);
        return response.data;
      }
    },
    {
      name: 'get_site_container',
      description: 'Get the top-level Windchill site container information',
      inputSchema: {
        type: 'object',
        properties: {
          expand: {
            type: 'string',
            description: 'Navigation properties to expand'
          }
        },
        required: []
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();

        if (params.expand) {
          queryParams.append('$expand', params.expand);
        }

        const response = await this.api.get(
          `${apiEndpoints.containers}/PTC.DataAdmin.Site?${queryParams.toString()}`
        );
        return response.data;
      }
    }
  ];
}
