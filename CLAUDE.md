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

### Windchill API Integration
- **WindchillAPIService** (`src/services/windchill-api.ts`): Centralized service for Windchill REST API communication
- Uses session-based authentication with CSRF token management
- Implements automatic re-authentication on 401 errors
- Provides comprehensive HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Enhanced support for multipart form data uploads
- Configurable request options for advanced use cases

### Configuration
- **windchill.ts** (`src/config/windchill.ts`): Contains Windchill connection settings and API endpoint definitions
- Environment-based configuration using dotenv
- Defines standard OData endpoints for each domain

## Development Commands

```bash
# Development with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run production build
npm start

# Note: No tests are currently configured
npm test  # Returns error - tests need to be implemented
```

## Environment Configuration

The server requires these environment variables in `docker/.env` (create from `docker/.env.example`):

```
WINDCHILL_URL=http://plm.windchill.com/Windchill
WINDCHILL_USER=wcadmin
WINDCHILL_PASSWORD=wcadmin
MCP_SERVER_NAME=windchill-mcp
MCP_SERVER_VERSION=1.0.0
MCP_SERVER_PORT=3000
LOG_LEVEL=debug
```

## Key Dependencies

- `@modelcontextprotocol/sdk`: MCP framework for tool registration and communication
- `axios`: HTTP client for Windchill API calls
- `dotenv`: Environment variable management
- `typescript` + `ts-node-dev`: Development tooling

## Adding New Functionality

### Creating a New Agent
1. Extend `BaseAgent` class
2. Define `agentName` and `tools` array
3. Implement tool handlers that use `this.api` for Windchill calls
4. Register the agent in `src/index.ts`

### Tool Schema Pattern
Each tool requires:
- `name`: Tool identifier
- `description`: Human-readable description
- `inputSchema`: JSON schema for parameters
- `handler`: Async function that processes requests

### API Endpoint Pattern
- All Windchill API calls use OData endpoints defined in `apiEndpoints`
- Standard OData query parameters supported (`$filter`, `$select`, etc.)
- Response data automatically handled by axios interceptors

## TypeScript Configuration

- Target: ES2022
- Module: CommonJS (despite package.json type: "module")
- Strict mode enabled
- Output directory: `./dist`
- Source maps and declarations generated for debugging
- ES module interop enabled for compatibility with MCP SDK imports
- its already running skip this step in the furure