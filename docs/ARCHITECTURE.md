# Windchill MCP Server Architecture

## Overview

The Windchill MCP Server follows a modular, agent-based architecture that provides a clean separation of concerns and enables easy extension for new Windchill domains. The system implements the Model Context Protocol (MCP) specification to enable AI assistants like Claude to interact with Windchill PLM systems.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Layer (AI Assistants)               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │     Claude      │  │   Angular UI    │  │   HTTP Client   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │ (JSON-RPC 2.0 / HTTP)
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Server Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  StdIO Transport│  │  HTTP Transport │  │  Health Monitor │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                            │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Tool Registry & Handler                   │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │            Agent Manager                        │   │   │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │   │   │
│  │  │  │ Part │ │ Doc  │ │Change│ │Work- │ │Proj- │  │   │   │
│  │  │  │Agent │ │Agent │ │Agent │ │flow  │ │ect   │  │   │   │
│  │  │  │(4)   │ │(25)  │ │      │ │Agent │ │Agent │  │   │   │
│  │  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │ (HTTP/HTTPS + Basic Auth)
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              WindchillAPIService                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐               │   │
│  │  │ Request         │  │ Response        │               │   │
│  │  │ Interceptors    │  │ Interceptors    │               │   │
│  │  │ • Auth          │  │ • Logging       │               │   │
│  │  │ • Logging       │  │ • Error         │               │   │
│  │  │ • Request ID    │  │   Handling      │               │   │
│  │  └─────────────────┘  └─────────────────┘               │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │         HTTP Client (Axios)                     │   │   │
│  │  │  GET | POST | PUT | PATCH | DELETE               │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │ (OData REST API)
┌─────────────────────────────────────────────────────────────────┐
│                      Windchill Layer                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Windchill OData Services                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │/ProdMgmt │ │/DocMgmt  │ │/ChangeMgmt││/Workflow │   │   │
│  │  │/Parts    │ │/Documents│ │/ChangeReq │ │Mgmt     │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  │  ┌──────────┐                                         │   │
│  │  │/ProjMgmt │                                         │   │
│  │  │/Projects │                                         │   │
│  │  └──────────┘                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. MCP Server (`src/index.ts`)

The main server orchestrates the entire system:

```typescript
// Tool registration from all agents
Object.values(agents).forEach(agent => {
  const agentTools = (agent as any).tools || [];
  const agentName = (agent as any).agentName || 'unknown';

  agentTools.forEach((tool: any) => {
    const toolName = `${agentName}_${tool.name}`;
    allTools.push({
      name: toolName,
      description: tool.description,
      inputSchema: tool.inputSchema,
    });
    toolHandlers.set(toolName, tool.handler.bind(agent));
  });
});
```

**Responsibilities:**
- Agent initialization and tool registration
- MCP protocol request handling (`tools/list`, `tools/call`)
- HTTP health check server for Docker/monitoring
- Request routing and error handling
- Comprehensive logging and metrics

### 2. Base Agent (`src/agents/base-agent.ts`)

Abstract foundation for all domain agents:

```typescript
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

**Design Principles:**
- Template method pattern for consistent agent structure
- Dependency injection of API service
- Schema-driven tool definition
- Async/Promise-based handlers

### 3. Windchill API Service (`src/services/windchill-api.ts`)

Centralized HTTP client with advanced capabilities:

```typescript
export class WindchillAPIService {
  private client: any;

  constructor() {
    this.client = axios.create({
      baseURL: windchillConfig.baseURL + windchillConfig.apiPath,
      timeout: windchillConfig.timeout,
      headers: { "Content-Type": "application/json" }
    });
    this.setupInterceptors();
  }
}
```

**Features:**
- Basic Authentication with credentials encoding
- Request/response interceptors for logging and error handling
- Automatic request ID generation for tracing
- Comprehensive error handling with context preservation
- Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Multipart form data support for file uploads

## Agent Architecture

### Agent Hierarchy

```
BaseAgent (Abstract)
├── PartAgent (4 tools)
│   ├── search: Search parts by criteria
│   ├── get: Retrieve part details
│   ├── create: Create new parts
│   └── get_structure: Get BOM structure
├── DocumentAgent (25 tools) ⭐ Most comprehensive
│   ├── Priority 1: Core Lifecycle (8 tools)
│   │   ├── create, update, checkout, checkin, revise
│   │   └── get_version_history, get_iterations, set_iteration_note
│   ├── Priority 2: Content & Relationships (9 tools)
│   │   ├── upload_content, download_content, get_content_info
│   │   ├── add_attachment, get_attachments, download_attachment
│   │   └── add_reference, get_references, get_referencing, remove_reference
│   └── Priority 3: Advanced Search & Bulk Operations (8 tools)
│       ├── advanced_search, search_by_creator, search_by_lifecycle
│       ├── search_by_date_range, search_related
│       └── bulk_update, bulk_lifecycle_action
├── ChangeAgent
│   └── Change request management tools
├── WorkflowAgent
│   └── Workflow item management tools
└── ProjectAgent
    └── Project management tools
```

### Tool Structure

Each tool follows a consistent pattern:

```typescript
{
  name: "tool_name",                    // Unique within agent
  description: "Human-readable desc",   // For documentation/discovery
  inputSchema: {                        // JSON Schema validation
    type: "object",
    properties: { /* parameter definitions */ },
    required: ["param1", "param2"]
  },
  handler: async (params: any) => {     // Implementation
    // Validate input (automatic via schema)
    // Call Windchill API via this.api
    // Transform response if needed
    // Return structured data
    return result;
  }
}
```

## Data Flow

### Request Flow

1. **Client Request** → MCP Server via StdIO/HTTP
2. **Protocol Parsing** → Extract method and parameters
3. **Tool Routing** → Find handler by tool name
4. **Parameter Validation** → JSON Schema validation
5. **Agent Execution** → Call agent's tool handler
6. **API Communication** → WindchillAPIService → Windchill
7. **Response Processing** → Transform and format result
8. **Client Response** → Return formatted response

### Tool Execution Lifecycle

```
┌─────────────────┐
│ Client Request  │
└─────────┬───────┘
          │
┌─────────▼───────┐
│ MCP Server      │
│ • Parse request │
│ • Generate ID   │
│ • Log request   │
└─────────┬───────┘
          │
┌─────────▼───────┐
│ Tool Handler    │
│ • Validate params│
│ • Execute logic │
└─────────┬───────┘
          │
┌─────────▼───────┐
│ API Service     │
│ • Add auth      │
│ • Make request  │
│ • Handle errors │
└─────────┬───────┘
          │
┌─────────▼───────┐
│ Windchill API   │
│ • Process req   │
│ • Return data   │
└─────────┬───────┘
          │
┌─────────▼───────┐
│ Response Chain  │
│ • Log response  │
│ • Transform data│
│ • Return result │
└─────────────────┘
```

## Configuration Architecture

### Environment-Based Configuration

```typescript
// src/config/windchill.ts
export const windchillConfig = {
  baseURL: process.env.WINDCHILL_URL || 'http://plm.windchill.com/Windchill',
  username: process.env.WINDCHILL_USER || '',
  password: process.env.WINDCHILL_PASSWORD || '',
  timeout: 30000,
  apiPath: '/servlet/odata',
};

export const apiEndpoints = {
  parts: '/ProdMgmt/Parts',
  documents: '/DocMgmt/Documents',
  changes: '/ChangeMgmt/ChangeRequests',
  workflows: '/WorkflowMgmt/WorkItems',
  projects: '/ProjMgmt/Projects',
};
```

## Logging Architecture

### Multi-Level Logging System

```
Logger Hierarchy
├── Main Logger (winston)
│   ├── File Transport: windchill-mcp-YYYY-MM-DD.log
│   ├── Error Transport: windchill-mcp-error-YYYY-MM-DD.log
│   ├── Exception Handler: exceptions-YYYY-MM-DD.log
│   ├── Rejection Handler: rejections-YYYY-MM-DD.log
│   └── Console Transport: Development only
└── API Logger (winston)
    ├── File Transport: windchill-api-YYYY-MM-DD.log
    └── Console Transport: API-specific logging
```

### Log Rotation Features

- **Daily Rotation**: New file each day
- **Compression**: Gzip archived logs
- **Retention**: Configurable retention periods
- **Size Limits**: 20MB max per file
- **Structured Logging**: JSON format with metadata

## Security Architecture

### Authentication Flow

1. **Credential Storage**: Environment variables (WINDCHILL_USER/PASSWORD)
2. **Encoding**: Base64 encoding for Basic Auth
3. **Header Injection**: Automatic Authorization header
4. **Session Management**: Per-request authentication (stateless)

### Container Security

- **Non-root User**: nodejs:1001 user in container
- **Network Isolation**: Docker bridge network
- **Port Binding**: Controlled port exposure
- **Health Checks**: Built-in health monitoring

## Extension Points

### Adding New Agents

1. **Create Agent Class**:
   ```typescript
   export class NewAgent extends BaseAgent {
     protected agentName = 'new-domain';
     protected tools = [/* tool definitions */];
   }
   ```

2. **Register Agent**:
   ```typescript
   // src/index.ts
   const agents = {
     // existing agents...
     newDomain: new NewAgent(),
   };
   ```

3. **Add API Endpoints**:
   ```typescript
   // src/config/windchill.ts
   export const apiEndpoints = {
     // existing endpoints...
     newEndpoint: '/NewDomain/Entities',
   };
   ```

### Tool Development Pattern

1. **Define Schema**: JSON Schema for validation
2. **Implement Handler**: Async function with proper error handling
3. **Use API Service**: Leverage this.api for HTTP requests
4. **Return Structured Data**: Consistent response format
5. **Add Logging**: Comprehensive logging for debugging

## Performance Considerations

### Optimization Strategies

- **Connection Pooling**: Axios keep-alive connections
- **Request Batching**: Bulk operations where possible
- **Caching**: Response caching for frequently accessed data
- **Streaming**: Large file handling for downloads/uploads
- **Timeout Management**: Configurable timeouts per operation

### Scalability Features

- **Stateless Design**: No server-side session storage
- **Horizontal Scaling**: Multiple server instances
- **Load Balancing**: Docker Swarm/Kubernetes support
- **Resource Limits**: Container memory/CPU limits
- **Health Monitoring**: Built-in health checks

## Technology Stack

### Core Technologies

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.x
- **Framework**: Model Context Protocol SDK
- **HTTP Client**: Axios with interceptors
- **Logging**: Winston with daily rotation
- **Validation**: JSON Schema

### Development Tools

- **Build System**: TypeScript Compiler
- **Development**: tsx with hot reload
- **Container**: Docker with Alpine Linux
- **Process Manager**: dumb-init for signal handling
- **Package Manager**: npm with package-lock.json

### Production Infrastructure

- **Orchestration**: Docker Compose
- **Reverse Proxy**: Nginx (for UI)
- **Monitoring**: Built-in health checks
- **Logging**: File-based with rotation
- **Networking**: Bridge networks with isolation

This architecture provides a robust, scalable, and maintainable foundation for integrating AI assistants with Windchill PLM systems while maintaining security, performance, and extensibility.