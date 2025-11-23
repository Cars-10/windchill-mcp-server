# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server for PTC Windchill 13.0.2.x, providing Claude with the ability to interact with Windchill PLM systems. The server implements multiple agents that handle different Windchill domains: parts, documents, changes, workflows, projects, data administration (containers/contexts), and server management (multi-server switching).

## Architecture

### Agent-Based Design
The codebase follows an agent-based architecture where each domain is handled by a specialized agent:

- **BaseAgent** (`src/agents/base-agent.ts`): Abstract base class that provides common MCP server tool registration and error handling

**Core Domain Agents:**
- **PartAgent**: Handles part management, BOM structures, and part searches (24 tools)
- **DocumentAgent**: Comprehensive document management with 25 tools covering:
  - Document lifecycle (create, update, checkout, checkin, revise)
  - Version management (history, iterations, notes)
  - Content management (upload, download, attachments)
  - Relationship management (references, linking)
  - Advanced search (multi-criteria, date ranges, lifecycle states)
  - Bulk operations (batch updates, lifecycle actions)
- **ChangeAgent**: Manages change requests and change processes (16 tools)
- **WorkflowAgent**: Manages workflow items and processes (~12 tools)
- **ProjectAgent**: Handles project-related operations (~10 tools)
- **DataAdminAgent**: Container and context management (13 tools) covering:
  - Container discovery (list products, libraries, organizations, projects, site)
  - Container details and navigation (folders, folder contents)
  - Product/library configuration (option pools, option sets)
  - Uses Windchill REST Services DataAdmin domain (`/DataAdmin/Containers`)
- **ServerManagerAgent**: Multi-server management and switching (5 tools) covering:
  - Server discovery (list all configured servers)
  - Dynamic server switching (change active server at runtime via MCP)
  - Connection testing (verify server availability before switching)
  - Server information retrieval (get current and specific server details)
  - Enables Claude Desktop users to seamlessly switch between Production, Development, and Test environments

**Tier 1 Agents (High Priority - Common Use Cases):**
- **PrincipalMgmtAgent**: User, group, role, and team management (16 tools)
  - User management (list, search, get details, groups, teams)
  - Group management (list, search, members)
  - Team management (list, search, members with roles)
  - Role management (list, assignments)
- **ProdPlatformMgmtAgent**: Options & Variants configuration (12 tools)
  - Option management (list, search, choices)
  - Option set management (list, search, assignments)
  - Choice management
  - Variant expressions and validation
- **NavCriteriaAgent**: BOM navigation and filtering (8 tools)
  - Navigation criteria management
  - Filter expressions and types
  - Applied criteria and defaults by view
- **PartListMgmtAgent**: Parts lists and favorites (10 tools)
  - Part list management (list, search, items)
  - List operations (add, remove, create, delete, update)
  - Sharing and collaboration

**Tier 2 Agents (Module-Specific - Requires Additional Windchill Modules):**
- **ManufacturingAgent**: Manufacturing data (requires Windchill MPMLink) (12 tools)
  - Manufacturing parts management
  - Process plans and operations
  - Resources and work instructions
- **QualityAgent**: Quality management (requires Windchill QMS) (10 tools)
  - Quality inspections
  - Nonconformance reports (NCRs)
  - Corrective actions

**Tier 3 Agents (Specialized Features):**
- **VisualizationAgent**: Creo View visualization services (3 tools)
  - Visualization representations, thumbnails, 3D views
- **EffectivityMgmtAgent**: Date/unit effectivity management (2 tools)
  - Effectivity definitions and effective items
- **CADDocumentMgmtAgent**: CAD-specific document operations (2 tools)
  - CAD documents and structure management
- **ClfStructureAgent**: Classification/taxonomy management (2 tools)
  - Classification nodes and hierarchy
- **SavedSearchAgent**: Saved search management (3 tools)
  - Search definitions and execution
- **ServiceInfoMgmtAgent**: Service information/technical publications (2 tools)
  - Service documentation management
- **PTCAgent**: Common utility entities (2 tools)
  - PTC common entity types and attributes

Each agent extends BaseAgent and defines its own tools with specific input schemas and handlers.

### Windchill Server Management
- **WindchillServerManager** (`src/config/windchill-servers.ts`): Manages multiple Windchill server configurations
- Loads all numbered server configurations from environment variables (`WINDCHILL_*_1`, `WINDCHILL_*_2`, etc.)
- Tracks active server and provides methods to switch between servers
- Supports up to 10 configured servers (can be extended)
- Backward compatible with single-server legacy configuration

### Windchill API Integration
- **WindchillAPIService** (`src/services/windchill-api.ts`): Centralized service for Windchill REST API communication
- **Multiple Authentication Methods**:
  - **Basic Auth**: Username/password for simple authentication
  - **Session-Based Auth**: Basic Auth + session cookies + CSRF tokens (default)
  - **OAuth 2.0**: Client credentials grant with automatic token management
- Implements comprehensive HTTP methods (GET, POST, PUT, PATCH, DELETE)
- **Dynamic Configuration**: Supports switching servers at runtime via `updateServerConfig(serverId)`
- Request/response interceptors for logging, cookie/token management, and error handling
- Each request gets a unique ID for traceability
- Automatically uses credentials from currently active server
- **Automatic Token/Session Refresh**: Detects expired tokens and refreshes automatically

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

## Token Efficiency Best Practices

This MCP server is optimized for LLM token efficiency using shared utilities in `src/utils/response-formatter.ts`. All agents should follow these patterns:

### Response Format Options

All tools should support two response formats via `response_format` parameter:

```typescript
import { ResponseFormat, FORMAT_SCHEMA_PROPS, buildListResponse } from '../utils/response-formatter.js';

// Add to inputSchema.properties
...FORMAT_SCHEMA_PROPS

// Use in handler
const responseFormat = params.response_format || ResponseFormat.MARKDOWN;
```

- **markdown** (default): Token-efficient, human-readable tables
- **json**: Complete structured data for programmatic processing

### Detail Levels

Support `detail_level` parameter for controlling field inclusion:
- **concise** (default): Essential fields only (5-7 fields per item)
- **detailed**: All available fields

### Pagination

All list/search tools must support pagination with standardized metadata:

```typescript
import { STANDARD_LIST_SCHEMA_PROPS, buildODataPagination, buildListResponse } from '../utils/response-formatter.js';

// Input schema
properties: {
  ...STANDARD_LIST_SCHEMA_PROPS,  // Adds limit, offset, response_format, detail_level
  // ... tool-specific properties
}

// Handler
const queryParams = buildODataPagination(params);  // Handles $top, $skip, $count

// Response automatically includes:
// { total, count, offset, limit, has_more, next_offset }
```

### Character Limits

Responses exceeding `CHARACTER_LIMIT` (25,000 chars) are automatically truncated with helpful guidance:

```typescript
import { CHARACTER_LIMIT, applyTruncation } from '../utils/response-formatter.js';

// Truncation message example:
// "Response truncated from 500 to 100 items. Use 'limit' and 'offset' or add filters."
```

### Tool Annotations

All tools must include MCP annotations for client UX:

```typescript
import { ToolAnnotations } from '../types/common.js';

// Read-only tools (search, get, list)
annotations: {
  title: 'Search Parts',
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
}

// Write tools (create, update)
annotations: {
  title: 'Create Part',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true
}

// Destructive tools (delete, remove)
annotations: {
  title: 'Remove BOM Component',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true
}
```

### Comprehensive Tool Descriptions

Tool descriptions must include:
- Brief summary of what the tool does
- Parameter documentation with examples
- Return schema for both formats
- Usage examples (when to use, when not to use)
- Error handling guidance

Example:
```typescript
description: `Search for parts by number, name, or type.

**Parameters:**
- number: Part number with wildcards (e.g., "PRT*")
- limit: Max results (1-100, default: 20)
- response_format: 'markdown' or 'json'

**Returns (markdown):**
| Number | Name | Type | State | Version |

**Returns (json):**
{ data: [...], pagination: { total, has_more, next_offset } }

**Examples:**
- Find by prefix: { "number": "PRT*" }
- Paginate: { "offset": 20, "limit": 20 }

**Error handling:**
- Empty results: Returns suggestions for broader search`
```

### Reference Implementation

See `src/agents/part-agent.ts` as the reference implementation for all token efficiency patterns.

---

## Authentication Methods

The Windchill MCP server supports three authentication methods, configurable per server via `WINDCHILL_AUTH_METHOD_{N}`:

### 1. Basic Authentication (`auth_method: basic`)
Simple username/password authentication without sessions or tokens.
- **Pros**: Simple, no token management
- **Cons**: Cannot use action endpoints that require CSRF tokens
- **Use When**: Testing, read-only operations, or when Windchill doesn't require CSRF

### 2. Session-Based Authentication (`auth_method: session`) - **DEFAULT**
Basic Auth + session cookies + automatic CSRF token management.
- **Pros**: Full support for all endpoints including actions
- **Cons**: Requires session management overhead
- **Use When**: Production use with full Windchill API access

### 3. OAuth 2.0 Authentication (`auth_method: oauth`)
Modern OAuth 2.0 with client credentials grant and automatic token refresh.
- **Pros**: Industry standard, more secure, automatic token expiry handling
- **Cons**: Requires OAuth 2.0 configuration in Windchill
- **Use When**: Enterprise deployments with OAuth infrastructure

---

## OAuth 2.0 Configuration

### Windchill OAuth 2.0 Setup

Before using OAuth authentication, you must configure OAuth 2.0 in your Windchill server:

1. **Register OAuth Client** in Windchill Administration
   - Navigate to: Site → Utilities → OAuth Application Management
   - Create new OAuth application with:
     - **Grant Type**: Client Credentials
     - **Scope**: `odata` (for REST Services access)
   - Note the generated `client_id` and `client_secret`

2. **Configure Token Endpoint**
   - Default: `{WINDCHILL_URL}/oauth2/token`
   - Verify endpoint availability in your Windchill version

### Environment Configuration

Add OAuth credentials to `.env` or Claude Desktop config:

```bash
# Server with OAuth 2.0
WINDCHILL_URL_1=https://plm.windchill.com/Windchill
WINDCHILL_NAME_1=Production PLM
WINDCHILL_AUTH_METHOD_1=oauth
WINDCHILL_OAUTH_CLIENT_ID_1=your-oauth-client-id
WINDCHILL_OAUTH_CLIENT_SECRET_1=your-oauth-client-secret
WINDCHILL_OAUTH_TOKEN_URL_1=https://plm.windchill.com/Windchill/oauth2/token  # Optional
```

### OAuth 2.0 Implementation Details

**Token Fetching** (windchill-api.ts:224-281):
- Uses OAuth 2.0 Client Credentials Grant
- POST to token endpoint with `grant_type=client_credentials`
- Requests `odata` scope for REST Services access
- Stores access_token and optional refresh_token

**Automatic Token Management** (windchill-api.ts:286-297):
- Checks token expiry before each request
- Automatically refreshes expired tokens (60-second buffer)
- No manual token management required

**Request Authentication** (windchill-api.ts:109-113):
- Adds `Authorization: Bearer {access_token}` header
- No session cookies or CSRF tokens needed

### OAuth Diagnostic Logging

OAuth operations are logged at INFO level in `logs/windchill-api-*.log`:
```
[INFO]: Fetching OAuth 2.0 access token | tokenUrl: https://...
[INFO]: OAuth 2.0 access token obtained successfully | expiresIn: 3600
[INFO]: OAuth token expired or missing, fetching new token
```

---

## Session-Based CSRF Token Support (Default)

### Overview
The Windchill MCP server's default authentication method is **session-based with automatic CSRF token management**. This enables full support for Windchill REST Actions like `GetPartStructure`, `Checkout`, `Checkin`, etc.

### How It Works

1. **Automatic Session Establishment**
   - When a POST/PUT/DELETE request requires a CSRF token, the service automatically establishes a session
   - Makes an initial GET request to `/servlet/odata/` to obtain session cookies
   - Captures `Set-Cookie` headers and stores them for subsequent requests

2. **Cookie Management**
   - Session cookies are automatically attached to all requests via `Cookie` header
   - Cookies are updated when Windchill sends new `Set-Cookie` headers
   - Each server has its own isolated session state

3. **CSRF Token Fetching**
   - After session establishment, requests CSRF token with `X-CSRF-Token: fetch` header
   - With session cookies present, Windchill returns a valid CSRF token
   - Token is cached and reused for subsequent requests

4. **Automatic Session Refresh**
   - Detects `INVALID_NONCE` errors (expired/invalid CSRF tokens)
   - Automatically clears session state and re-establishes session
   - Retries the failed request with new session and CSRF token

### Implementation Details

**Session State** (windchill-api.ts:11-12):
```typescript
private sessionCookies: string[] = [];
private sessionEstablished: boolean = false;
```

**Session Establishment** (windchill-api.ts:303-364):
- Called automatically before CSRF token fetch
- Makes GET request to OData root
- Captures and stores session cookies

**PTC CSRF Token Fetching** (windchill-api.ts:370-419):
- Uses PTC-specific endpoint: `GET /PTC/GetCSRFToken()`
- Receives token in response body: `{ NonceKey, NonceValue }`
- Stores `NonceValue` for subsequent requests
- Automatic retry on token expiry

**Cookie Injection** (windchill-api.ts:127-133):
- Request interceptor adds `Cookie` header with session cookies
- Logs cookie count for debugging

**CSRF Token Injection** (windchill-api.ts:490-504):
- POST/PUT/PATCH/DELETE requests include `CSRF_NONCE` header
- PTC Windchill uses `CSRF_NONCE` (not `X-CSRF-Token`)
- Token automatically refreshed on `INVALID_NONCE` errors

**Cookie Capture** (windchill-api.ts:140-164):
- Response interceptor captures `Set-Cookie` headers
- Updates session cookie store
- Merges new cookies with existing ones

**Session Refresh** (windchill-api.ts:341-356):
- Clears all session state
- Re-establishes session and fetches new CSRF token
- Triggered on `INVALID_NONCE` errors

### Diagnostic Logging

Session operations are logged at INFO level in `logs/windchill-api-*.log`:
```
[INFO]: Establishing session with Windchill
[INFO]: Session established successfully | cookieCount: 2
[INFO]: Fetching CSRF token from PTC GetCSRFToken endpoint
[INFO]: CSRF token successfully retrieved from PTC endpoint | nonceKey: ... | tokenLength: 36
[INFO]: POST request with CSRF_NONCE token
[WARN]: CSRF token error (INVALID_NONCE), refreshing session
[INFO]: Retrying POST with refreshed session and CSRF_NONCE token
```

### Alternative: OData Navigation Properties

For simple BOM queries, you can still use CSRF-free OData navigation:
- `part_get_bom_components` uses `$expand=Uses($expand=Child)`
- No session or CSRF tokens required
- Limited to single-level BOM retrieval
- See part-agent.ts:343-383 for implementation

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