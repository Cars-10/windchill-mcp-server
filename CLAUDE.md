# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server for PTC Windchill 13.0.2.x, providing Claude with the ability to interact with Windchill PLM systems. The server implements multiple agents that handle different Windchill domains: parts, changes, documents, workflows, and projects.

## Architecture

### Agent-Based Design
The codebase follows an agent-based architecture where each domain is handled by a specialized agent:

- **BaseAgent** (`src/agents/base-agent.ts`): Abstract base class that provides common MCP server tool registration and error handling
- **PartAgent**: Handles part management, BOM structures, and part searches
- **ChangeAgent**: Manages change requests and change processes
- **DocumentAgent**: Comprehensive document management with 25 tools covering:
  - Document lifecycle (create, update, checkout, checkin, revise)
  - Version management (history, iterations, notes)
  - Content management (upload, download, attachments)
  - Relationship management (references, linking)
  - Advanced search (multi-criteria, date ranges, lifecycle states)
  - Bulk operations (batch updates, lifecycle actions)
- **WorkflowAgent**: Manages workflow items and processes
- **ProjectAgent**: Handles project-related operations

Each agent extends BaseAgent and defines its own tools with specific input schemas and handlers.

### Windchill Server Management
- **WindchillServerManager** (`src/config/windchill-servers.ts`): Manages multiple Windchill server configurations
- Loads all numbered server configurations from environment variables (`WINDCHILL_*_1`, `WINDCHILL_*_2`, etc.)
- Tracks active server and provides methods to switch between servers
- Supports up to 10 configured servers (can be extended)
- Backward compatible with single-server legacy configuration

### Windchill API Integration
- **WindchillAPIService** (`src/services/windchill-api.ts`): Centralized service for Windchill REST API communication
- Uses Basic Authentication directly for all OData endpoints
- Implements comprehensive HTTP methods (GET, POST, PUT, PATCH, DELETE)
- **Dynamic Configuration**: Supports switching servers at runtime via `updateServerConfig(serverId)`
- Request/response interceptors for logging and error handling
- Each request gets a unique ID for traceability
- Automatically uses credentials from currently active server
- No session-based authentication or CSRF token management required

### MCP Server Architecture
- **src/index.ts**: Main entry point that:
  - Creates MCP server with stdio transport for Claude integration
  - Creates HTTP server for health checks and web UI integration
  - Registers all agent tools with prefixed names (`{agentName}_{toolName}`)
  - Supports both MCP JSON-RPC 2.0 protocol and direct HTTP tool execution
  - Implements comprehensive CORS support for Angular UI
- **Tool Registration Pattern**: Tools are registered with agent-prefixed names (e.g., `document_search`, `part_get_bom`)
- **Dual Protocol Support**:
  - Standard MCP JSON-RPC 2.0 for Claude integration via stdio
  - HTTP JSON-RPC 2.0 endpoints at `/api` for web UI
  - Direct tool execution endpoints at `/api/tools/{toolName}`

### Configuration
- **windchill.ts** (`src/config/windchill.ts`): Contains Windchill connection settings and API endpoint definitions
- Environment-based configuration using dotenv (loads from project root or `docker/.env`)
- Defines standard OData endpoints for each domain (`/ProdMgmt/Parts`, `/DocMgmt/Documents`, etc.)
- All configuration files should be placed in `docker/.env` for Docker deployments

### Angular UI Integration
- **angular-ui/** directory contains a full Angular 18 application
- Web interface provides:
  - Tool discovery with search and filtering
  - Dynamic form generation from JSON schemas
  - Real-time tool execution with formatted results
  - Windchill server selection and switching
  - MCP JSON-RPC 2.0 protocol compliance
- Development: Proxies API calls to MCP server on port 3000
- Production: Deployed via multi-stage Docker build with Nginx on port 8080 (mapped to 4200)

## Development Commands

```bash
# Development with hot reload (starts both MCP server + Angular UI)
npm run dev

# Run services separately
npm run dev:server  # MCP server only (port 3000)
npm run dev:ui      # Angular UI only (port 4200)

# Build TypeScript to JavaScript
npm run build

# Run production build
npm start

# Angular UI specific
npm run ui:install  # Install Angular dependencies
npm run ui:build    # Build Angular production bundle
npm run ui:serve    # Serve Angular dev server

# Docker commands
npm run docker:build     # Build production image
npm run docker:up        # Start containers
npm run docker:down      # Stop containers
npm run docker:logs      # View container logs
npm run docker:dev       # Start with hot reload
npm run deploy:ui        # Deploy Angular UI only
npm run deploy:all       # Deploy full system
npm run verify:docker    # Run pre-deployment checks

# Note: No tests are currently configured
npm test  # Returns error - tests need to be implemented
```

## Environment Configuration

### Multi-Server Configuration

The server supports connecting to multiple Windchill servers with dynamic switching through the Angular UI. Configure multiple servers in `docker/.env` using numbered suffixes:

```bash
# Windchill Server 1 (Production)
WINDCHILL_URL_1=http://plm-prod.windchill.com/Windchill
WINDCHILL_USER_1=wcadmin
WINDCHILL_PASSWORD_1=wcadmin
WINDCHILL_NAME_1=Production PLM

# Windchill Server 2 (Development)
WINDCHILL_URL_2=http://plm-dev.windchill.com/Windchill
WINDCHILL_USER_2=wcadmin
WINDCHILL_PASSWORD_2=wcadmin
WINDCHILL_NAME_2=Development PLM

# Windchill Server 3 (Test)
WINDCHILL_URL_3=http://plm-test.windchill.com/Windchill
WINDCHILL_USER_3=wcadmin
WINDCHILL_PASSWORD_3=wcadmin
WINDCHILL_NAME_3=Test PLM

# Default active server (1, 2, 3, etc.)
WINDCHILL_ACTIVE_SERVER=1
```

**Backward Compatibility:** If no numbered servers are configured, the system will use legacy single-server variables:
```bash
WINDCHILL_URL=http://plm.windchill.com/Windchill
WINDCHILL_USER=wcadmin
WINDCHILL_PASSWORD=wcadmin
```

**Other Configuration:**
```bash
MCP_SERVER_NAME=windchill-mcp
MCP_SERVER_VERSION=1.0.0
MCP_SERVER_PORT=3000
LOG_LEVEL=info
```

### Server Management Endpoints

The MCP server exposes HTTP endpoints for managing Windchill server connections:

- **GET /api/servers** - List all configured Windchill servers
- **GET /api/servers/current** - Get currently active Windchill server
- **POST /api/servers/switch** - Switch to a different Windchill server (body: `{serverId: number}`)

The Angular UI provides a dropdown to select and switch between configured servers dynamically.

## Key Dependencies

- `@modelcontextprotocol/sdk`: MCP framework for tool registration and communication
- `axios`: HTTP client for Windchill API calls
- `dotenv`: Environment variable management
- `express`: HTTP server (v5.1.0)
- `winston` + `winston-daily-rotate-file`: Structured logging with daily rotation
- `typescript` + `tsx`: Development tooling (tsx for hot reload)
- `concurrently`: Run multiple dev servers simultaneously

## TypeScript Configuration

- Target: ES2020
- Module: ES2020 (package.json specifies `"type": "module"`)
- Strict mode enabled
- Output directory: `./dist`
- Source maps and declarations generated for debugging
- ES module interop enabled for compatibility with MCP SDK imports
- Uses `.js` extensions in imports for ES modules (e.g., `from './base-agent.js'`)

## Code Quality Guidelines

### TypeScript Best Practices

**Always use proper types - avoid `any`:**
```typescript
// ❌ BAD
handler: async (params: any) => {
  const response = await this.api.get('/endpoint', params);
  return response.data;
}

// ✅ GOOD
import { ToolParams, ToolResult, DocumentSearchParams } from '../types/common.js';

handler: async (params: ToolParams): Promise<ToolResult> => {
  const searchParams = params as DocumentSearchParams;
  const response = await this.api.get('/endpoint', searchParams);
  return response.data;
}
```

**Use custom error types:**
```typescript
import { WindchillAPIError, MCPToolError } from '../types/common.js';

// Throw appropriate errors
if (!params.id) {
  throw new MCPToolError('Missing required parameter: id', 'INVALID_PARAMS');
}

// API errors are automatically wrapped by WindchillAPIError
try {
  const response = await this.api.get(`/Parts('${params.id}')`);
  return response.data;
} catch (error) {
  if (error instanceof WindchillAPIError) {
    throw new MCPToolError(
      `Failed to fetch part: ${error.message}`,
      'API_ERROR',
      { statusCode: error.statusCode }
    );
  }
  throw error;
}
```

**Define proper interfaces for tool parameters:**
```typescript
// Create specific param interfaces in src/types/common.ts
export interface PartSearchParams extends ToolParams {
  number?: string;
  name?: string;
  state?: string;
  limit?: number;
}

// Use in tool handler
handler: async (params: ToolParams): Promise<ToolResult> => {
  const searchParams = params as PartSearchParams;
  // Now you have type safety and autocomplete
  if (searchParams.limit && searchParams.limit > 1000) {
    throw new MCPToolError('Limit cannot exceed 1000', 'INVALID_PARAMS');
  }
}
```

### Tool Development Guidelines

**Mark tool status appropriately:**
```typescript
import { ToolDefinition, ToolStatus } from '../types/common.js';

// Document experimental or problematic tools in comments
{
  name: 'get_by_state',
  description: 'Get parts by lifecycle state (EXPERIMENTAL - may not work in all Windchill versions)',
  // Note: State property not available in Windchill 13.0.2 OData API
  // This tool is marked experimental until confirmed working
  inputSchema: { ... },
  handler: async (params: ToolParams): Promise<ToolResult> => {
    // Implementation
  }
}
```

**Document Windchill version compatibility:**
```typescript
{
  name: 'search',
  description: 'Search parts by number and name',
  inputSchema: {
    type: 'object',
    properties: {
      number: { type: 'string', description: 'Part number' },
      name: { type: 'string', description: 'Part name' },
      // REMOVED: State property - not supported in Windchill 13.0.2 OData
      // state: { type: 'string', description: 'Lifecycle state' }
    }
  },
  handler: async (params: ToolParams): Promise<ToolResult> => {
    const filters = [];
    if (params.number) filters.push(`Number eq '${params.number}'`);
    if (params.name) filters.push(`contains(Name,'${params.name}')`);
    // State filter removed - causes 400 Bad Request in Windchill 13.0.2

    const queryParams = new URLSearchParams();
    if (filters.length > 0) {
      queryParams.append('$filter', filters.join(' and '));
    }

    const response = await this.api.get(`/ProdMgmt/Parts?${queryParams.toString()}`);
    return response.data;
  }
}
```

## Adding New Functionality

### Creating a New Agent
1. Extend `BaseAgent` class in `src/agents/`
2. Define `agentName` (string) and `tools` (array)
3. Implement tool handlers that use `this.api` for Windchill calls
4. Register the agent in `src/index.ts` in the `agents` object

Example:
```typescript
import { BaseAgent } from "./base-agent.js";
import { apiEndpoints } from "../config/windchill.js";

export class MyAgent extends BaseAgent {
  protected agentName = "my";

  protected tools = [
    {
      name: "search",  // Will be registered as "my_search"
      description: "Search for items",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
        }
      },
      handler: async (params) => {
        const response = await this.api.get('/MyEndpoint', {
          $filter: `contains(Name,'${params.query}')`
        });
        return response.data;
      }
    }
  ];
}
```

### Tool Schema Pattern
Each tool requires:
- `name`: Tool identifier (will be prefixed with agent name)
- `description`: Human-readable description for MCP clients
- `inputSchema`: JSON schema for parameters (used for validation)
- `handler`: Async function that processes requests and returns results

### API Endpoint Pattern
- All Windchill API calls use OData endpoints defined in `apiEndpoints`
- Base URL constructed as: `${baseURL}/servlet/odata${endpoint}`
- Standard OData query parameters supported (`$filter`, `$select`, `$expand`, etc.)
- Response data in `response.data`, automatically parsed by axios
- Use Basic Auth (automatically added by interceptors)

### Logging Pattern
- Import logger from `src/config/logger.js`
- Use structured logging with context objects:
  ```typescript
  logger.info('Operation completed', {
    requestId,
    duration: `${duration}ms`,
    resultCount: results.length
  });
  ```
- Log levels: `error`, `warn`, `info`, `debug`
- Separate `apiLogger` for API-specific requests in `windchill-api.ts`