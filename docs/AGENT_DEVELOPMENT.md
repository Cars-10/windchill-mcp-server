# Agent Development Guide

## Overview

This guide provides detailed instructions for developing new agents and extending existing ones in the Windchill MCP Server. Agents are specialized components that handle specific Windchill domains and expose tools through the Model Context Protocol.

## Agent Architecture

### Base Agent Structure

All agents inherit from the `BaseAgent` abstract class:

```typescript
// src/agents/base-agent.ts
export abstract class BaseAgent {
  protected api = windchillAPI;
  protected abstract agentName: string;
  protected abstract tools: Array<{
    name: string;
    description: string;
    inputSchema: any;
    handler: (params: any) => Promise<any>;
  }>;
}
```

### Agent Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Lifecycle                             │
├─────────────────────────────────────────────────────────────────┤
│ 1. Agent Instantiation                                         │
│    └── new MyAgent() creates instance                          │
│                                                                 │
│ 2. Tool Registration                                            │
│    └── MCP Server registers all agent tools                    │
│                                                                 │
│ 3. Tool Execution                                               │
│    ├── Client sends tool request                               │
│    ├── MCP Server routes to agent handler                      │
│    ├── Agent validates input via JSON Schema                   │
│    ├── Agent executes business logic                           │
│    ├── Agent makes Windchill API calls                         │
│    └── Agent returns formatted response                        │
└─────────────────────────────────────────────────────────────────┘
```

## Creating a New Agent

### Step 1: Define Agent Class

Create a new file `src/agents/my-domain-agent.ts`:

```typescript
import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

/**
 * Agent for managing [Domain] objects in Windchill.
 *
 * This agent provides tools for:
 * - Searching [domain] items
 * - Creating new [domain] items
 * - Updating [domain] properties
 * - Managing [domain] relationships
 */
export class MyDomainAgent extends BaseAgent {
  /**
   * Unique identifier for this agent.
   * Used for tool naming: {agentName}_{toolName}
   */
  protected agentName = 'mydomain';

  /**
   * Array of tools provided by this agent.
   * Each tool defines its interface and implementation.
   */
  protected tools = [
    {
      name: 'search',
      description: 'Search for items in my domain by various criteria',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Item name to search for (supports partial matching)'
          },
          number: {
            type: 'string',
            description: 'Item number for exact match'
          },
          state: {
            type: 'string',
            description: 'Lifecycle state filter',
            enum: ['DRAFT', 'REVIEW', 'APPROVED', 'RELEASED']
          },
          createdAfter: {
            type: 'string',
            description: 'Find items created after this date (ISO format)',
            format: 'date-time'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            minimum: 1,
            maximum: 1000,
            default: 50
          }
        },
        required: [] // All parameters are optional
      },
      handler: async (params: any) => {
        return await this.searchItems(params);
      }
    },
    {
      name: 'get',
      description: 'Retrieve detailed information for a specific item',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique item identifier'
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        return await this.getItem(params.id);
      }
    },
    {
      name: 'create',
      description: 'Create a new item in the domain',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Item name',
            minLength: 1,
            maxLength: 255
          },
          number: {
            type: 'string',
            description: 'Item number (must be unique)',
            pattern: '^[A-Z]{2,}-[0-9]{3,}$'
          },
          description: {
            type: 'string',
            description: 'Item description'
          },
          type: {
            type: 'string',
            description: 'Item type/category',
            enum: ['TYPE_A', 'TYPE_B', 'TYPE_C']
          },
          container: {
            type: 'string',
            description: 'Container/context for the item'
          },
          attributes: {
            type: 'object',
            description: 'Custom attributes (key-value pairs)',
            additionalProperties: {
              type: 'string'
            }
          }
        },
        required: ['name', 'number', 'type']
      },
      handler: async (params: any) => {
        return await this.createItem(params);
      }
    },
    {
      name: 'update',
      description: 'Update an existing item',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Item identifier to update'
          },
          name: {
            type: 'string',
            description: 'Updated item name'
          },
          description: {
            type: 'string',
            description: 'Updated description'
          },
          attributes: {
            type: 'object',
            description: 'Attributes to update',
            additionalProperties: {
              type: 'string'
            }
          }
        },
        required: ['id']
      },
      handler: async (params: any) => {
        return await this.updateItem(params);
      }
    }
  ];

  /**
   * Search for items using OData filtering.
   * Demonstrates proper query parameter construction and error handling.
   */
  private async searchItems(params: any) {
    try {
      const queryParams = new URLSearchParams();

      // Build filter conditions
      const filters: string[] = [];

      if (params.name) {
        filters.push(`contains(Name,'${params.name}')`);
      }

      if (params.number) {
        filters.push(`Number eq '${params.number}'`);
      }

      if (params.state) {
        filters.push(`State eq '${params.state}'`);
      }

      if (params.createdAfter) {
        filters.push(`CreatedOn gt ${params.createdAfter}`);
      }

      // Combine filters with AND logic
      if (filters.length > 0) {
        queryParams.append('$filter', filters.join(' and '));
      }

      // Add pagination
      const limit = params.limit || 50;
      queryParams.append('$top', limit.toString());

      // Add ordering for consistent results
      queryParams.append('$orderby', 'CreatedOn desc');

      // Execute search
      const response = await this.api.get(
        `${apiEndpoints.mydomain}?${queryParams.toString()}`
      );

      return {
        items: response.data.value || [],
        totalCount: response.data.value?.length || 0,
        hasMore: response.data.value?.length === limit,
        query: params
      };

    } catch (error: any) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Retrieve a single item by ID.
   * Demonstrates proper error handling and response transformation.
   */
  private async getItem(id: string) {
    try {
      const response = await this.api.get(
        `${apiEndpoints.mydomain}('${id}')`
      );

      if (!response.data) {
        throw new Error(`Item not found: ${id}`);
      }

      // Transform response to include computed fields
      return {
        ...response.data,
        displayName: `${response.data.Number} - ${response.data.Name}`,
        lastModified: response.data.ModifiedOn,
        url: `${apiEndpoints.mydomain}('${id}')`
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Item not found: ${id}`);
      }
      throw new Error(`Failed to retrieve item: ${error.message}`);
    }
  }

  /**
   * Create a new item with validation and error handling.
   * Demonstrates proper data transformation and API usage.
   */
  private async createItem(params: any) {
    try {
      // Validate business rules
      await this.validateItemCreation(params);

      // Prepare data for Windchill API
      const createData = {
        Name: params.name,
        Number: params.number,
        Description: params.description || '',
        Type: params.type,
        Container: params.container,
        // Transform custom attributes
        ...this.transformAttributes(params.attributes)
      };

      // Create item
      const response = await this.api.post(
        apiEndpoints.mydomain,
        createData
      );

      // Return enhanced response
      return {
        ...response.data,
        message: `Item created successfully: ${params.number}`,
        operations: ['create'],
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error(`Validation failed: ${error.response.data.message || error.message}`);
      }
      if (error.response?.status === 409) {
        throw new Error(`Item number already exists: ${params.number}`);
      }
      throw new Error(`Creation failed: ${error.message}`);
    }
  }

  /**
   * Update an existing item.
   * Demonstrates PATCH usage and partial updates.
   */
  private async updateItem(params: any) {
    try {
      const { id, ...updateFields } = params;

      // Prepare update data
      const updateData: any = {};

      if (updateFields.name) {
        updateData.Name = updateFields.name;
      }

      if (updateFields.description) {
        updateData.Description = updateFields.description;
      }

      if (updateFields.attributes) {
        Object.assign(updateData, this.transformAttributes(updateFields.attributes));
      }

      // Perform update
      const response = await this.api.patch(
        `${apiEndpoints.mydomain}('${id}')`,
        updateData
      );

      return {
        ...response.data,
        message: `Item updated successfully`,
        updatedFields: Object.keys(updateData),
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Item not found: ${params.id}`);
      }
      throw new Error(`Update failed: ${error.message}`);
    }
  }

  /**
   * Business rule validation for item creation.
   * Demonstrates custom validation logic.
   */
  private async validateItemCreation(params: any): Promise<void> {
    // Check for duplicate numbers
    const existingItems = await this.searchItems({ number: params.number });
    if (existingItems.totalCount > 0) {
      throw new Error(`Item number already exists: ${params.number}`);
    }

    // Validate naming conventions
    if (!params.number.match(/^[A-Z]{2,}-[0-9]{3,}$/)) {
      throw new Error(`Invalid number format: ${params.number}. Expected format: XX-000`);
    }

    // Additional business rules...
  }

  /**
   * Transform custom attributes for Windchill API.
   * Demonstrates data transformation patterns.
   */
  private transformAttributes(attributes: any): any {
    if (!attributes) return {};

    const transformed: any = {};

    Object.entries(attributes).forEach(([key, value]) => {
      // Transform key to Windchill format
      const windchillKey = `Custom_${key}`;
      transformed[windchillKey] = value;
    });

    return transformed;
  }
}
```

### Step 2: Add API Endpoints

Update `src/config/windchill.ts`:

```typescript
export const apiEndpoints = {
  parts: '/ProdMgmt/Parts',
  documents: '/DocMgmt/Documents',
  changes: '/ChangeMgmt/ChangeRequests',
  workflows: '/WorkflowMgmt/WorkItems',
  projects: '/ProjMgmt/Projects',
  // Add your new endpoint
  mydomain: '/MyDomain/MyEntities',
};
```

### Step 3: Register Agent

Update `src/index.ts`:

```typescript
// Import your new agent
import { MyDomainAgent } from './agents/my-domain-agent.js';

// Add to agents object
const agents = {
  part: new PartAgent(),
  change: new ChangeAgent(),
  document: new DocumentAgent(),
  workflow: new WorkflowAgent(),
  project: new ProjectAgent(),
  // Register your new agent
  mydomain: new MyDomainAgent(),
};
```

## Advanced Agent Features

### 1. Complex Search Tools

```typescript
{
  name: 'advanced_search',
  description: 'Advanced search with multiple criteria and pagination',
  inputSchema: {
    type: 'object',
    properties: {
      criteria: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          state: { type: 'string' },
          type: { type: 'string' },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          pageSize: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      },
      sorting: {
        type: 'object',
        properties: {
          field: { type: 'string', enum: ['name', 'number', 'created', 'modified'] },
          direction: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    }
  },
  handler: async (params: any) => {
    const { criteria = {}, pagination = {}, sorting = {} } = params;

    // Build complex OData query
    const queryParams = new URLSearchParams();

    // Filters
    const filters = [];
    if (criteria.name) filters.push(`contains(Name,'${criteria.name}')`);
    if (criteria.state) filters.push(`State eq '${criteria.state}'`);
    if (criteria.type) filters.push(`Type eq '${criteria.type}'`);

    if (criteria.dateRange) {
      if (criteria.dateRange.start) {
        filters.push(`CreatedOn ge ${criteria.dateRange.start}`);
      }
      if (criteria.dateRange.end) {
        filters.push(`CreatedOn le ${criteria.dateRange.end}`);
      }
    }

    if (filters.length > 0) {
      queryParams.append('$filter', filters.join(' and '));
    }

    // Pagination
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 20;
    const skip = (page - 1) * pageSize;

    queryParams.append('$top', pageSize.toString());
    if (skip > 0) {
      queryParams.append('$skip', skip.toString());
    }

    // Sorting
    const sortField = this.mapSortField(sorting.field || 'created');
    const sortDir = sorting.direction || 'desc';
    queryParams.append('$orderby', `${sortField} ${sortDir}`);

    // Execute search with count
    queryParams.append('$count', 'true');

    const response = await this.api.get(
      `${apiEndpoints.mydomain}?${queryParams.toString()}`
    );

    return {
      items: response.data.value,
      pagination: {
        page,
        pageSize,
        totalItems: response.data['@odata.count'],
        totalPages: Math.ceil(response.data['@odata.count'] / pageSize),
        hasNext: skip + pageSize < response.data['@odata.count'],
        hasPrev: page > 1
      },
      criteria,
      sorting
    };
  }
}
```

### 2. Bulk Operations

```typescript
{
  name: 'bulk_update',
  description: 'Update multiple items with the same changes',
  inputSchema: {
    type: 'object',
    properties: {
      itemIds: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 100,
        description: 'Array of item IDs to update'
      },
      updates: {
        type: 'object',
        description: 'Fields to update on all items',
        properties: {
          description: { type: 'string' },
          attributes: { type: 'object' }
        }
      },
      options: {
        type: 'object',
        properties: {
          continueOnError: {
            type: 'boolean',
            default: true,
            description: 'Continue processing if individual updates fail'
          },
          batchSize: {
            type: 'number',
            minimum: 1,
            maximum: 10,
            default: 5,
            description: 'Number of concurrent updates'
          }
        }
      }
    },
    required: ['itemIds', 'updates']
  },
  handler: async (params: any) => {
    const { itemIds, updates, options = {} } = params;
    const { continueOnError = true, batchSize = 5 } = options;

    const results = [];
    const batches = this.createBatches(itemIds, batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async (itemId) => {
        try {
          const response = await this.api.patch(
            `${apiEndpoints.mydomain}('${itemId}')`,
            updates
          );

          return {
            id: itemId,
            success: true,
            data: response.data,
            message: 'Updated successfully'
          };

        } catch (error: any) {
          const result = {
            id: itemId,
            success: false,
            error: error.message,
            message: `Update failed: ${error.message}`
          };

          if (!continueOnError) {
            throw new Error(`Bulk update failed at item ${itemId}: ${error.message}`);
          }

          return result;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      results,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        successRate: `${Math.round((successful.length / results.length) * 100)}%`
      },
      updates,
      timestamp: new Date().toISOString()
    };
  }
}
```

### 3. File Upload Tools

```typescript
{
  name: 'upload_file',
  description: 'Upload a file to an item',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Item ID to attach file to'
      },
      filePath: {
        type: 'string',
        description: 'Local file path to upload'
      },
      fileName: {
        type: 'string',
        description: 'Name for the uploaded file'
      },
      description: {
        type: 'string',
        description: 'File description'
      },
      category: {
        type: 'string',
        description: 'File category',
        enum: ['PRIMARY', 'ATTACHMENT', 'REFERENCE']
      }
    },
    required: ['id', 'filePath', 'fileName']
  },
  handler: async (params: any) => {
    try {
      // Validate file exists and size
      const fileStats = await this.validateFile(params.filePath);

      // Create form data
      const formData = new FormData();
      formData.append('file', fs.createReadStream(params.filePath));
      formData.append('fileName', params.fileName);
      formData.append('description', params.description || '');
      formData.append('category', params.category || 'ATTACHMENT');

      // Upload with progress tracking
      const response = await this.api.post(
        `${apiEndpoints.mydomain}('${params.id}')/uploadFile`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          maxContentLength: 100 * 1024 * 1024, // 100MB limit
          timeout: 300000 // 5 minute timeout for large files
        }
      );

      return {
        ...response.data,
        fileInfo: {
          originalName: params.fileName,
          size: fileStats.size,
          uploadedAt: new Date().toISOString()
        }
      };

    } catch (error: any) {
      throw new Error(`File upload failed: ${error.message}`);
    }
  }
}
```

### 4. Relationship Management

```typescript
{
  name: 'add_relationship',
  description: 'Create a relationship between two items',
  inputSchema: {
    type: 'object',
    properties: {
      sourceId: {
        type: 'string',
        description: 'Source item ID'
      },
      targetId: {
        type: 'string',
        description: 'Target item ID'
      },
      relationshipType: {
        type: 'string',
        description: 'Type of relationship',
        enum: ['DEPENDS_ON', 'REFERENCES', 'CONTAINS', 'RELATED_TO']
      },
      description: {
        type: 'string',
        description: 'Relationship description'
      },
      attributes: {
        type: 'object',
        description: 'Additional relationship attributes'
      }
    },
    required: ['sourceId', 'targetId', 'relationshipType']
  },
  handler: async (params: any) => {
    try {
      // Validate both items exist
      await Promise.all([
        this.validateItemExists(params.sourceId),
        this.validateItemExists(params.targetId)
      ]);

      // Check for circular dependencies
      if (params.relationshipType === 'DEPENDS_ON') {
        await this.checkCircularDependency(params.sourceId, params.targetId);
      }

      // Create relationship
      const relationshipData = {
        SourceId: params.sourceId,
        TargetId: params.targetId,
        Type: params.relationshipType,
        Description: params.description || '',
        ...params.attributes
      };

      const response = await this.api.post(
        `${apiEndpoints.mydomain}/relationships`,
        relationshipData
      );

      return {
        ...response.data,
        message: `Relationship created: ${params.relationshipType}`,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      throw new Error(`Failed to create relationship: ${error.message}`);
    }
  }
}
```

## Testing and Validation

### Unit Testing Pattern

```typescript
// tests/agents/my-domain-agent.test.ts
import { MyDomainAgent } from '../../src/agents/my-domain-agent.js';

describe('MyDomainAgent', () => {
  let agent: MyDomainAgent;

  beforeEach(() => {
    agent = new MyDomainAgent();
    // Mock API service
    jest.spyOn(agent['api'], 'get').mockImplementation();
    jest.spyOn(agent['api'], 'post').mockImplementation();
  });

  describe('search tool', () => {
    it('should build correct OData query for name search', async () => {
      const searchTool = agent['tools'].find(t => t.name === 'search');

      await searchTool?.handler({ name: 'test item' });

      expect(agent['api'].get).toHaveBeenCalledWith(
        expect.stringContaining("contains(Name,'test item')")
      );
    });

    it('should handle empty search results', async () => {
      (agent['api'].get as jest.Mock).mockResolvedValue({
        data: { value: [] }
      });

      const searchTool = agent['tools'].find(t => t.name === 'search');
      const result = await searchTool?.handler({});

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('create tool', () => {
    it('should validate required fields', async () => {
      const createTool = agent['tools'].find(t => t.name === 'create');

      await expect(
        createTool?.handler({ name: 'test' }) // missing required fields
      ).rejects.toThrow();
    });

    it('should handle duplicate number error', async () => {
      (agent['api'].get as jest.Mock).mockResolvedValue({
        data: { value: [{ Number: 'TEST-001' }] }
      });

      const createTool = agent['tools'].find(t => t.name === 'create');

      await expect(
        createTool?.handler({
          name: 'test',
          number: 'TEST-001',
          type: 'TYPE_A'
        })
      ).rejects.toThrow('Item number already exists');
    });
  });
});
```

### Integration Testing

```typescript
// tests/integration/my-domain.integration.test.ts
import { WindchillAPIService } from '../../src/services/windchill-api.js';
import { MyDomainAgent } from '../../src/agents/my-domain-agent.js';

describe('MyDomain Integration Tests', () => {
  let agent: MyDomainAgent;

  beforeAll(() => {
    // Use real API service with test credentials
    agent = new MyDomainAgent();
  });

  it('should perform end-to-end item lifecycle', async () => {
    const testNumber = `TEST-${Date.now()}`;

    // Create item
    const createTool = agent['tools'].find(t => t.name === 'create');
    const created = await createTool?.handler({
      name: 'Integration Test Item',
      number: testNumber,
      type: 'TYPE_A',
      description: 'Created by integration test'
    });

    expect(created.Number).toBe(testNumber);

    // Search for item
    const searchTool = agent['tools'].find(t => t.name === 'search');
    const searchResult = await searchTool?.handler({
      number: testNumber
    });

    expect(searchResult.items).toHaveLength(1);
    expect(searchResult.items[0].Number).toBe(testNumber);

    // Update item
    const updateTool = agent['tools'].find(t => t.name === 'update');
    const updated = await updateTool?.handler({
      id: created.ID,
      description: 'Updated by integration test'
    });

    expect(updated.Description).toBe('Updated by integration test');

    // Clean up - delete test item
    // ... cleanup code
  });
});
```

## Best Practices

### 1. Error Handling

```typescript
// Always wrap API calls in try-catch
handler: async (params: any) => {
  try {
    const response = await this.api.get(`/endpoint/${params.id}`);
    return response.data;
  } catch (error: any) {
    // Provide context-specific error messages
    if (error.response?.status === 404) {
      throw new Error(`Item not found: ${params.id}`);
    }
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - check Windchill credentials');
    }
    if (error.response?.status === 403) {
      throw new Error('Insufficient permissions for this operation');
    }
    throw new Error(`Operation failed: ${error.message}`);
  }
}
```

### 2. Input Validation

```typescript
// Use comprehensive JSON Schema validation
inputSchema: {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'Valid email address'
    },
    count: {
      type: 'number',
      minimum: 1,
      maximum: 1000,
      description: 'Count between 1 and 1000'
    },
    status: {
      type: 'string',
      enum: ['ACTIVE', 'INACTIVE'],
      description: 'Status must be ACTIVE or INACTIVE'
    }
  },
  required: ['email'],
  additionalProperties: false // Reject unknown properties
}
```

### 3. Response Formatting

```typescript
// Provide consistent, informative responses
handler: async (params: any) => {
  const result = await this.performOperation(params);

  return {
    // Core data
    ...result,

    // Metadata
    operation: 'create',
    timestamp: new Date().toISOString(),

    // User feedback
    message: 'Operation completed successfully',

    // Additional context
    affectedItems: [result.id],
    warnings: [], // Any warnings during operation

    // Navigation aids
    links: {
      self: `/api/items/${result.id}`,
      edit: `/api/items/${result.id}/edit`,
      related: `/api/items/${result.id}/related`
    }
  };
}
```

### 4. Performance Optimization

```typescript
// Implement efficient pagination and filtering
private async searchWithPagination(params: any) {
  // Use OData $skip and $top for server-side pagination
  const queryParams = new URLSearchParams();

  // Always include count for pagination info
  queryParams.append('$count', 'true');

  // Implement efficient filtering
  queryParams.append('$filter', this.buildEfficientFilter(params));

  // Select only needed fields
  queryParams.append('$select', 'ID,Name,Number,ModifiedOn');

  // Use consistent ordering
  queryParams.append('$orderby', 'ModifiedOn desc');

  return await this.api.get(`/endpoint?${queryParams.toString()}`);
}
```

### 5. Documentation

```typescript
/**
 * Tool for searching domain items with advanced filtering capabilities.
 *
 * @param params Search parameters
 * @param params.name Item name for partial matching
 * @param params.state Lifecycle state filter
 * @param params.limit Maximum results (1-1000, default: 50)
 *
 * @returns Search results with pagination information
 *
 * @example
 * // Search for active items with "widget" in name
 * const results = await searchTool.handler({
 *   name: "widget",
 *   state: "ACTIVE",
 *   limit: 25
 * });
 *
 * @throws {Error} When Windchill API is unavailable
 * @throws {Error} When authentication fails
 */
```

This comprehensive guide provides all the necessary information for developing robust, maintainable agents for the Windchill MCP Server.