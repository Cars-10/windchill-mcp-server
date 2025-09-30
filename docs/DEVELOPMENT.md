# Development Guide

## Getting Started

### Prerequisites

- **Node.js**: 20.x LTS or higher
- **npm**: 10.x or higher
- **Docker**: 24.x or higher (for containerized development)
- **Docker Compose**: 2.x or higher
- **Git**: Latest version
- **TypeScript**: 5.x (installed via npm)

### Development Environment Setup

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd windchill-mcp-server
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp docker/.env.example docker/.env
   # Edit docker/.env with your Windchill configuration
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

The development server will start with hot reload enabled, automatically restarting when you make changes to TypeScript files.

## Project Structure

```
windchill-mcp-server/
├── src/                          # Source code
│   ├── agents/                   # Agent implementations
│   │   ├── base-agent.ts        # Abstract base class
│   │   ├── document-agent.ts    # Document management (25 tools)
│   │   ├── part-agent.ts        # Part management (4 tools)
│   │   ├── change-agent.ts      # Change management
│   │   ├── workflow-agent.ts    # Workflow management
│   │   └── project-agent.ts     # Project management
│   ├── config/                   # Configuration files
│   │   ├── logger.ts            # Winston logging configuration
│   │   └── windchill.ts         # Windchill API endpoints
│   ├── services/                 # Service layer
│   │   └── windchill-api.ts     # HTTP client service
│   ├── types/                    # TypeScript type definitions
│   │   └── axios.d.ts           # Axios type extensions
│   └── index.ts                  # Main entry point
├── dist/                         # Compiled JavaScript (generated)
├── logs/                         # Application logs (generated)
├── docker/                       # Docker configuration
│   ├── Dockerfile               # Production container
│   ├── Dockerfile.dev           # Development container
│   ├── Dockerfile.ui            # Angular UI container
│   ├── docker-compose.yml       # Production orchestration
│   ├── docker-compose.dev.yml   # Development orchestration
│   ├── .env.example             # Environment template
│   └── *.sh                     # Setup scripts
├── docs/                         # Documentation
├── angular-ui/                   # Angular web interface
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
└── CLAUDE.md                     # Development guidelines
```

## Development Workflow

### 1. Hot Reload Development

```bash
# Start development server with hot reload
npm run dev

# The server will restart automatically when you modify:
# - TypeScript files in src/
# - Configuration files
# - Package.json dependencies
```

### 2. Building and Testing

```bash
# Build TypeScript to JavaScript
npm run build

# Run production build locally
npm start

# View build output
ls -la dist/
```

### 3. Docker Development

```bash
# Start development container with hot reload
npm run docker:dev

# Build and start production containers
npm run docker:build
npm run docker:up

# View logs
npm run docker:logs

# Stop containers
npm run docker:down
```

## Agent Development

### Creating a New Agent

1. **Create Agent File**: `src/agents/my-agent.ts`

```typescript
import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';

export class MyAgent extends BaseAgent {
  protected agentName = 'my-domain';

  protected tools = [
    {
      name: 'search',
      description: 'Search for items in my domain',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          limit: {
            type: 'number',
            description: 'Maximum results to return'
          }
        },
        required: ['query']
      },
      handler: async (params: any) => {
        // Implementation using this.api
        const queryParams = new URLSearchParams();
        queryParams.append('$filter', `contains(Name,'${params.query}')`);

        if (params.limit) {
          queryParams.append('$top', params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.myEndpoint}?${queryParams.toString()}`
        );

        return response.data;
      }
    }
  ];
}
```

2. **Add API Endpoint**: `src/config/windchill.ts`

```typescript
export const apiEndpoints = {
  // existing endpoints...
  myEndpoint: '/MyDomain/MyEntities',
};
```

3. **Register Agent**: `src/index.ts`

```typescript
import { MyAgent } from './agents/my-agent.js';

// Add to agents object
const agents = {
  part: new PartAgent(),
  change: new ChangeAgent(),
  document: new DocumentAgent(),
  workflow: new WorkflowAgent(),
  project: new ProjectAgent(),
  myDomain: new MyAgent(), // Add your agent here
};
```

### Tool Development Guidelines

#### 1. Tool Structure Template

```typescript
{
  name: 'tool_name',                    // Unique within agent
  description: 'Clear description',     // For documentation
  inputSchema: {                        // JSON Schema validation
    type: 'object',
    properties: {
      requiredParam: {
        type: 'string',
        description: 'Parameter description'
      },
      optionalParam: {
        type: 'number',
        description: 'Optional parameter'
      }
    },
    required: ['requiredParam']
  },
  handler: async (params: any) => {     // Implementation
    try {
      // 1. Validate parameters (automatic via schema)
      // 2. Build API request
      // 3. Make API call via this.api
      // 4. Process and return response

      const response = await this.api.get('/endpoint');
      return response.data;

    } catch (error: any) {
      // Errors are automatically logged by the MCP server
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }
}
```

#### 2. Best Practices

**Parameter Validation:**
- Use comprehensive JSON Schema definitions
- Include clear parameter descriptions
- Specify required vs optional parameters
- Use enums for constrained values

**Error Handling:**
- Always wrap API calls in try-catch blocks
- Provide meaningful error messages
- Let the MCP server handle logging
- Don't catch and ignore errors

**API Usage:**
- Use `this.api` for all Windchill API calls
- Leverage HTTP methods: `get`, `post`, `put`, `patch`, `delete`
- Build proper OData query strings
- Handle different response formats appropriately

**Documentation:**
- Write clear tool descriptions
- Document all parameters thoroughly
- Include usage examples in comments
- Explain any special behavior or limitations

#### 3. Common Patterns

**OData Filtering:**
```typescript
const queryParams = new URLSearchParams();

// Equality filter
if (params.number) {
  queryParams.append('$filter', `Number eq '${params.number}'`);
}

// Contains filter for partial matches
if (params.name) {
  queryParams.append('$filter', `contains(Name,'${params.name}')`);
}

// Date range filters
if (params.createdAfter) {
  queryParams.append('$filter', `CreatedOn gt ${params.createdAfter}`);
}

// Combine multiple filters
const filters = [];
if (params.type) filters.push(`Type eq '${params.type}'`);
if (params.state) filters.push(`State eq '${params.state}'`);
if (filters.length > 0) {
  queryParams.append('$filter', filters.join(' and '));
}

// Pagination
if (params.limit) {
  queryParams.append('$top', params.limit.toString());
}

const response = await this.api.get(`${endpoint}?${queryParams.toString()}`);
```

**Error Handling Pattern:**
```typescript
handler: async (params: any) => {
  try {
    // Validate business logic
    if (!params.id) {
      throw new Error('Document ID is required');
    }

    // Make API call
    const response = await this.api.get(`/Documents('${params.id}')`);

    // Process response
    if (!response.data) {
      throw new Error('Document not found');
    }

    return response.data;

  } catch (error: any) {
    // Re-throw with context
    throw new Error(`Failed to retrieve document: ${error.message}`);
  }
}
```

**Bulk Operations Pattern:**
```typescript
handler: async (params: any) => {
  const results = [];

  for (const id of params.documentIds) {
    try {
      const response = await this.api.patch(
        `/Documents('${id}')`,
        params.updates
      );
      results.push({
        id,
        success: true,
        data: response.data
      });
    } catch (error: any) {
      results.push({
        id,
        success: false,
        error: error.message
      });
    }
  }

  return {
    results,
    totalProcessed: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  };
}
```

## API Service Development

### Extending WindchillAPIService

The `WindchillAPIService` class provides a centralized HTTP client for all Windchill API interactions.

```typescript
// src/services/windchill-api.ts
export class WindchillAPIService {
  private client: any;

  // Available methods:
  async get(endpoint: string, params?: any, config?: any)
  async post(endpoint: string, data: any, config?: any)
  async put(endpoint: string, data: any)
  async patch(endpoint: string, data: any)
  async delete(endpoint: string)
}
```

### Adding New HTTP Methods

```typescript
// Example: Adding a HEAD method
async head(endpoint: string, config?: any) {
  apiLogger.debug('HEAD request initiated', {
    endpoint,
    hasConfig: !!config
  });
  return this.client.head(endpoint, config);
}
```

### Custom Request Configuration

```typescript
// Example: File upload with progress tracking
const formData = new FormData();
formData.append('file', fileData);

const response = await this.api.post(
  '/Documents/upload',
  formData,
  {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      const progress = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      console.log(`Upload progress: ${progress}%`);
    }
  }
);
```

## Configuration Management

### Environment Variables

Create and modify `docker/.env`:

```env
# Required Windchill Configuration
WINDCHILL_URL=http://your-windchill-server/Windchill
WINDCHILL_USER=your-username
WINDCHILL_PASSWORD=your-password

# MCP Server Configuration
MCP_SERVER_NAME=windchill-mcp
MCP_SERVER_VERSION=1.0.0
MCP_SERVER_PORT=3000

# Logging Configuration
LOG_LEVEL=debug
NODE_ENV=development

# Optional Performance Tuning
REQUEST_TIMEOUT=30000
MAX_CONNECTIONS=10
RETRY_ATTEMPTS=3
```

### Adding New Configuration

1. **Update windchill.ts:**
```typescript
export const windchillConfig = {
  // existing config...
  maxRetries: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
  connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '5000', 10),
};
```

2. **Use in API Service:**
```typescript
constructor() {
  this.client = axios.create({
    baseURL: windchillConfig.baseURL + windchillConfig.apiPath,
    timeout: windchillConfig.connectionTimeout,
    // other config...
  });
}
```

## Logging and Debugging

### Logger Usage

```typescript
import { logger, apiLogger } from '../config/logger.js';

// Application logging
logger.info('Operation completed', {
  operationType: 'document_create',
  documentId: 'DOC-123'
});

logger.error('Operation failed', {
  error: error.message,
  stack: error.stack,
  context: { userId: 'user123' }
});

// API-specific logging
apiLogger.debug('Making API request', {
  endpoint: '/Documents',
  method: 'GET',
  parameters: params
});
```

### Log Files

Development logs are written to:
- `logs/windchill-mcp-YYYY-MM-DD.log` - All application logs
- `logs/windchill-mcp-error-YYYY-MM-DD.log` - Error logs only
- `logs/windchill-api-YYYY-MM-DD.log` - API request/response logs

### Debugging Tools

```bash
# Watch logs in real-time
tail -f logs/windchill-mcp-$(date +%Y-%m-%d).log

# Filter for specific operations
grep "document_create" logs/windchill-mcp-$(date +%Y-%m-%d).log

# Monitor API calls
tail -f logs/windchill-api-$(date +%Y-%m-%d).log | grep "POST"

# Debug Docker containers
docker-compose logs -f windchill-mcp-server
docker exec -it windchill-mcp-server /bin/sh
```

## Testing

### Manual Testing

1. **Using HTTP Endpoints:**
```bash
# Health check
curl http://localhost:3000/health

# List tools
curl http://localhost:3000/tools

# Execute tool via JSON-RPC 2.0
curl -X POST http://localhost:3000/api \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test_001",
    "method": "tools/call",
    "params": {
      "name": "document_search",
      "arguments": {
        "name": "specification"
      }
    }
  }'
```

2. **Using Angular UI:**
   - Navigate to `http://localhost:4200`
   - Browse available tools
   - Execute tools interactively

### Integration Testing

Create test scripts in `tests/` directory:

```typescript
// tests/document-agent.test.ts
import { DocumentAgent } from '../src/agents/document-agent.js';

const agent = new DocumentAgent();

// Test tool execution
const testDocumentSearch = async () => {
  try {
    const result = await agent.tools
      .find(t => t.name === 'search')
      ?.handler({ name: 'test' });

    console.log('Search results:', result);
    return true;
  } catch (error) {
    console.error('Search failed:', error);
    return false;
  }
};

testDocumentSearch();
```

## Code Quality

### TypeScript Configuration

The project uses strict TypeScript configuration (`tsconfig.json`):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist"
  }
}
```

### Coding Standards

**File Naming:**
- Use kebab-case for files: `my-agent.ts`
- Use PascalCase for classes: `MyAgent`
- Use camelCase for functions/variables: `myFunction`

**Code Organization:**
- One class per file
- Group related functionality
- Use explicit imports/exports
- Document public interfaces

**Error Handling:**
- Always handle async operations
- Provide meaningful error messages
- Use proper TypeScript typing
- Log errors appropriately

### Performance Considerations

**Memory Management:**
- Avoid memory leaks in long-running processes
- Clean up event listeners
- Close file handles properly
- Monitor memory usage in production

**Connection Pooling:**
- Reuse HTTP connections where possible
- Implement proper timeout handling
- Consider connection limits
- Monitor connection health

## Deployment

### Development Deployment

```bash
# Quick development deployment
npm run docker:dev

# Full development stack
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up --build
```

### Production Deployment

```bash
# Build production images
npm run docker:build

# Deploy production stack
npm run deploy:all

# Verify deployment
curl http://localhost:3000/health
curl http://localhost:4200
```

### Health Monitoring

Monitor deployment health:

```bash
# Check container status
docker-compose ps

# Monitor logs
docker-compose logs -f

# Check resource usage
docker stats windchill-mcp-server

# Verify endpoints
curl -f http://localhost:3000/health || echo "Health check failed"
```

## Troubleshooting

### Common Development Issues

**TypeScript Compilation Errors:**
```bash
# Clear build cache
rm -rf dist/
npm run build

# Check for type errors
npx tsc --noEmit
```

**Hot Reload Not Working:**
```bash
# Restart development server
npm run dev

# Check file watchers
lsof +D src/
```

**Docker Issues:**
```bash
# Rebuild containers from scratch
docker-compose down
docker system prune -f
npm run docker:build

# Check container logs
docker-compose logs windchill-mcp-server
```

**Windchill Connection Issues:**
```bash
# Test connectivity from container
docker exec windchill-mcp-server ping your-windchill-server

# Check credentials
docker exec windchill-mcp-server env | grep WINDCHILL

# Test API endpoint
curl -u username:password http://windchill-server/Windchill/servlet/odata/DocMgmt/Documents
```

### Performance Issues

**Slow Response Times:**
- Check Windchill server performance
- Monitor network latency
- Analyze API endpoint performance
- Review query complexity

**Memory Leaks:**
- Monitor container memory usage
- Check for unclosed connections
- Review event listener cleanup
- Analyze log file growth

**High CPU Usage:**
- Profile TypeScript compilation
- Check for infinite loops
- Monitor concurrent requests
- Review algorithm complexity

## Contributing

### Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes following coding standards
4. Update documentation if needed
5. Test changes thoroughly
6. Submit pull request with clear description

### Code Review Guidelines

- Follow existing code patterns
- Ensure comprehensive error handling
- Add appropriate logging statements
- Update documentation for new features
- Test edge cases and error conditions
- Verify Docker deployment works

This development guide provides comprehensive information for contributing to and extending the Windchill MCP Server project.