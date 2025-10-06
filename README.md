# Windchill MCP Server

A comprehensive Model Context Protocol (MCP) server for PTC Windchill 13.0.2.x that enables Claude and other AI assistants to interact with Windchill PLM systems through a standardized interface with 42+ tools across 5 specialized agents.

## 🚀 Quick Start

### Using with Claude Desktop

The fastest way to get started is to use this server with [Claude Desktop](https://claude.ai/download):

```bash
# Clone and build
git clone <your-repo-url>
cd windchill-mcp-server
npm install
npm run build

# Configure Claude Desktop (see docs/CLAUDE_DESKTOP.md for details)
# Edit: ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
#   or: %APPDATA%\Claude\claude_desktop_config.json (Windows)
```

**📖 Full Claude Desktop setup guide:** [docs/CLAUDE_DESKTOP.md](docs/CLAUDE_DESKTOP.md)

---

### Local Development & Web UI

### Option 1: Setup Wizard (Easiest)

```bash
chmod +x docker/setup-wizard.sh
./docker/setup-wizard.sh
```

The wizard will:

1. Run pre-flight checks
2. Configure your environment
3. Start the server
4. Run automated tests

### Option 2: Manual Setup

#### Local Development

```bash
# Install dependencies
npm install
cd angular-ui && npm install && cd ..

# Configure environment
cp docker/.env.example docker/.env
# Edit .env with your Windchill credentials

# Run in development mode (starts both MCP server + Angular UI)
npm run dev

# Or run services separately:
npm run dev:server  # MCP server only (port 3000)
npm run dev:ui      # Angular UI only (port 4200)
```

The `npm run dev` command starts:
- **MCP Server** on http://localhost:3000 (with hot reload)
- **Angular UI** on http://localhost:4200 (with proxy to port 3000)

### Docker Deployment

#### Production

```bash
# Make scripts executable
chmod +x docker/docker-run.sh

# Build and run
./docker/docker-run.sh

# Or using npm scripts
npm run docker:build
npm run docker:up
```

#### Accessing the Applications

After starting the containers, access the applications at:

- **Angular Web UI**: `http://localhost:4200` - Modern web interface for all MCP tools with JSON-RPC 2.0 support
- **MCP Server API**: `http://localhost:3000/api/` - Direct API access to all tools (JSON-RPC 2.0 compliant)
- **MCP Server Info**: `http://localhost:3000` - Server health and information

#### Development with Hot Reload

```bash
# Make scripts executable
chmod +x docker/docker-dev.sh

# Run development container
./docker/docker-dev.sh

# Or using npm scripts
npm run docker:dev
```

#### Deploy Angular UI Only

```bash
# Make deployment script executable
chmod +x docker/deploy-ui.sh

# Deploy Angular UI (requires MCP server to be running)
./docker/deploy-ui.sh

# Or using npm scripts
npm run deploy:ui
```

#### Deploy Complete System

```bash
# Deploy both MCP server and Angular UI
npm run deploy:all

# Or manually
docker compose -f docker/docker-compose.yml up -d
```

#### Verify Docker Environment

```bash
# Verify Docker setup before deployment
./docker/verify-docker.sh

# Or using npm
npm run verify:docker
```

For detailed Docker setup, see [DOCKER.md](docs/DOCKER.md)

## 🌐 Web Interface

### Angular MCP Tools UI

The server includes a modern Angular-based web interface that provides:

- **MCP JSON-RPC 2.0 Compliance**: Full support for standardized MCP protocol
- **Interactive Tool Discovery**: Browse and search available tools with filtering
- **Dynamic Form Generation**: Automatic parameter input forms based on JSON Schema
- **Real-time Tool Execution**: Execute tools directly from the web interface
- **Response Visualization**: Formatted display of tool execution results
- **Error Handling**: Comprehensive error reporting and debugging information

#### Using the Web Interface

1. **Access**: Navigate to `http://localhost:4200` after starting the containers
   - *Note: Port 4200 is the standard Angular CLI development port*
2. **Discover Tools**: Browse available tools by agent or category
3. **Filter & Search**: Use the search bar and filters to find specific tools
4. **Execute Tools**: Click on any tool to open the execution interface
5. **View Results**: See formatted responses and handle errors gracefully

#### MCP Protocol Support

The web interface fully implements the MCP JSON-RPC 2.0 specification:

```typescript
// Example MCP JSON-RPC 2.0 request
{
  "jsonrpc": "2.0",
  "id": "req_123",
  "method": "tools/list",
  "params": {}
}

// Example tool execution request
{
  "jsonrpc": "2.0",
  "id": "req_456",
  "method": "tools/call",
  "params": {
    "name": "document_create",
    "arguments": {
      "number": "DOC-123",
      "name": "New Document",
      "type": "SPEC"
    }
  }
}
```

## 📋 Features

### Recent Enhancements (v1.2.0)

**Claude Desktop Integration:**
- ✅ **Native stdio support** for seamless Claude Desktop integration
- ✅ **Stdio-only mode** (`MCP_STDIO_ONLY=true`) - disables HTTP server for cleaner operation
- ✅ **Optimized logging** - file-only logging in stdio mode
- ✅ **Package bin entry** - installable as a command-line tool
- ✅ **Comprehensive setup guide** - [docs/CLAUDE_DESKTOP.md](docs/CLAUDE_DESKTOP.md)

### Previous Enhancements (v1.1.0)

**Document Agent Expansion**: The Document Agent has been significantly enhanced with 22 additional tools:
- **Angular UI Deployment**: Complete Docker deployment configuration with multi-stage builds
- **MCP JSON-RPC 2.0 Support**: Full protocol compliance in both server and client
- **Docker Build Fix**: Changed from npm ci to npm install for Angular UI (generates package-lock.json during build)
- **Angular Config Fix**: Removed environment file dependencies and Angular Material references that were causing build failures
- **HTML Template Fix**: Fixed unterminated textarea tags in Angular component templates
- **Polyfills Configuration**: Added proper TypeScript compilation configuration for polyfills
- **Polyfills Import Fix**: Simplified polyfills.ts by removing @angular/localize/init and fixing zone.js import path
- **Nginx Configuration Fix**: Removed invalid 'must-revalidate' directive from gzip_proxied configuration
- **UI Performance Fix**: Added debounced search input and safe JSON display to prevent browser freezing
- **TypeScript Fixes**: Fixed NodeJS.Timeout type usage and HttpClient response type handling
- **Dependency Updates**: Updated Angular from v17 to v18 and suppressed npm deprecation warnings
- **22 new tools** added across Priority 1-3 implementation tiers
- **Enhanced API Service** with PATCH method and multipart form data support
- **Comprehensive error handling** with proper TypeScript typing
- **Advanced search capabilities** with date ranges and lifecycle state filtering
- **Bulk operations** for efficient batch processing
- **Content management** with upload/download and attachment handling
- **Relationship management** for document linking and references

### Agents

- **Part Agent**: Part management, BOM structures, part searches
- **Change Agent**: Change request management
- **Document Agent**: Comprehensive document management with 25 tools:
  - **Core Lifecycle**: Create, update, checkout, checkin, revise documents
  - **Version Management**: Version history, iterations, iteration notes
  - **Content Management**: Upload/download content, attachment handling
  - **Relationship Management**: Document references and linking
  - **Advanced Search**: Multi-criteria search with date/lifecycle filters
  - **Bulk Operations**: Batch updates and lifecycle actions
- **Workflow Agent**: Workflow items and processes
- **Project Agent**: Project management operations

### Capabilities

- Session-based authentication with CSRF token management
- Automatic re-authentication on session expiry
- Comprehensive HTTP method support (GET, POST, PUT, PATCH, DELETE)
- OData query support for all endpoints with advanced filtering
- Multipart form data support for file uploads
- Extensible agent-based architecture
- Comprehensive error handling and logging
- Bulk operation support for efficient processing

## 🏗️ Architecture

```
windchill-mcp-server/
├── src/
│   ├── agents/          # Agent implementations
│   │   ├── base-agent.ts
│   │   ├── part-agent.ts
│   │   ├── change-agent.ts
│   │   ├── document-agent.ts
│   │   ├── workflow-agent.ts
│   │   └── project-agent.ts
│   ├── config/          # Configuration
│   │   └── windchill.ts
│   ├── services/        # API services
│   │   └── windchill-api.ts
│   └── index.ts         # Main entry point
├── docker/
│   ├── Dockerfile           # Production container
│   ├── Dockerfile.dev       # Development container
│   ├── docker-compose.yml   # Production compose
│   ├── docker-compose.dev.yml # Development compose
│   ├── .env.example         # Environment template
│   └── *.sh                 # Setup and run scripts
└── docs/                    # Documentation files
```

## 🔧 Configuration

### Environment Variables

| Variable             | Required | Default       | Description        |
| -------------------- | -------- | ------------- | ------------------ |
| `WINDCHILL_URL`      | Yes      | -             | Windchill base URL |
| `WINDCHILL_USER`     | Yes      | -             | Windchill username |
| `WINDCHILL_PASSWORD` | Yes      | -             | Windchill password |
| `MCP_STDIO_ONLY`     | No       | false         | Stdio-only mode (recommended for Claude Desktop) |
| `MCP_SERVER_NAME`    | No       | windchill-mcp | MCP server name    |
| `MCP_SERVER_VERSION` | No       | 1.0.0         | Server version     |
| `MCP_SERVER_PORT`    | No       | 3000          | Server port (ignored when MCP_STDIO_ONLY=true) |
| `LOG_LEVEL`          | No       | info          | Logging level (use 'error' for Claude Desktop) |

## 📚 API Endpoints

The server uses Windchill REST API with OData endpoints:

- `/ProdMgmt/Parts` - Part management
- `/DocMgmt/Documents` - Document management
- `/ChangeMgmt/ChangeRequests` - Change management
- `/WorkflowMgmt/WorkItems` - Workflow management
- `/ProjMgmt/Projects` - Project management

## 🛠️ Development

### Available Scripts

```bash
# Local development
npm run dev              # Start with hot reload
npm run build            # Build TypeScript
npm start                # Run production build

# Docker
npm run docker:build     # Build Docker image
npm run docker:up        # Start container
npm run docker:down      # Stop container
npm run docker:logs      # View logs
npm run docker:dev       # Start development container
```

### Adding New Agents

1. Create agent file in `src/agents/`:

```typescript
import { BaseAgent } from "./base-agent.js";

export class MyAgent extends BaseAgent {
  protected agentName = "my-agent";

  protected tools = [
    {
      name: "my_tool",
      description: "Tool description",
      inputSchema: {
        /* JSON schema */
      },
      handler: async (params) => {
        /* implementation */
      },
    },
  ];
}
```

2. Register in `src/index.ts`:

```typescript
import { MyAgent } from "./agents/my-agent.js";

const agents = {
  // ... existing agents
  myAgent: new MyAgent(),
};
```

## 🐳 Docker Details

### Production Container

- **Base**: Node.js 20 Alpine
- **User**: Non-root (nodejs:1001)
- **Port**: 3000
- **Health Check**: 30s interval

### Angular UI Container

- **Base**: Multi-stage build (Node.js 20 + Nginx Alpine)
- **Build Stage**: Compiles Angular TypeScript to JavaScript using npm install
- **Production Stage**: Nginx serves static files with API proxy
- **Port**: 8080 (internal), mapped to 4200 (external)
- **API Proxy**: Routes `/api/*` requests to MCP server
- **SPA Support**: Handles Angular client-side routing
- **Dependency Management**: Generates package-lock.json during build process

### Development Container

- **Hot Reload**: Enabled via ts-node-dev
- **Source Mounting**: Live code updates
- **Debug Logging**: Enabled

See [DOCKER.md](docs/DOCKER.md) for complete Docker documentation.

## 🔐 Security

- Session-based authentication with CSRF tokens
- Non-root container user
- Environment-based secrets
- Health checks enabled
- Network isolation via Docker networks

## 📊 Integration with Data Platform

This MCP server is part of a larger data platform architecture:

```
Data Sources (PLM/ERP/MES) → MCP Agents → Kafka → Data Lake → Analytics
```

See `IT Architecture.mmd` for the complete architecture diagram.

## 🐛 Troubleshooting

### Authentication Fails

- Verify WINDCHILL_URL is accessible
- Check username/password in .env
- Ensure Windchill REST API is enabled

### Container Issues

```bash
# View logs
docker-compose logs -f

# Check container status
docker-compose ps

# Restart container
docker-compose restart
```

### Connection Issues

```bash
# Test Windchill connectivity from container
docker exec windchill-mcp-server ping plm.windchill.com
```

## 🖥️ Claude Desktop vs Web UI

This server supports two distinct usage modes:

### Claude Desktop Mode (Recommended)

Use `MCP_STDIO_ONLY=true` for:
- ✅ Integration with Claude Desktop app
- ✅ Stdio-based MCP protocol communication
- ✅ File-only logging (no console output)
- ✅ No HTTP server overhead
- ✅ Simplified configuration

**See**: [docs/CLAUDE_DESKTOP.md](docs/CLAUDE_DESKTOP.md)

### Web UI Mode

Default mode with HTTP server for:
- ✅ Interactive Angular web interface on port 4200
- ✅ REST API on port 3000
- ✅ Multi-server switching capability
- ✅ Real-time tool testing
- ✅ Docker deployment support

**See**: Docker deployment section above

## 📝 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📞 Support

For issues and questions:

- Check [DOCKER.md](docs/DOCKER.md) for Docker-specific issues
- Check [CLAUDE.md](./CLAUDE.md) for development guidelines
- Review logs: `docker-compose logs -f`
