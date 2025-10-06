# Using Windchill MCP Server with Claude Desktop

This guide explains how to use the Windchill MCP Server with Claude Desktop for AI-powered interaction with your Windchill PLM system.

## Prerequisites

- **Node.js** 18 or higher
- **Claude Desktop** installed on your system
- **PTC Windchill** 13.0.2.x server with REST API enabled
- **Access credentials** for your Windchill server

## Quick Setup

### 1. Install the MCP Server

```bash
# Clone the repository
git clone <your-repo-url>
cd windchill-mcp-server

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

### 2. Configure Claude Desktop

#### Find Your Claude Desktop Configuration

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

#### Add Windchill MCP Server Configuration

Edit your `claude_desktop_config.json` file and add the following configuration:

```json
{
  "mcpServers": {
    "windchill": {
      "command": "node",
      "args": [
        "/absolute/path/to/windchill-mcp-server/dist/index.js"
      ],
      "env": {
        "WINDCHILL_URL": "https://your-windchill-server.com/Windchill",
        "WINDCHILL_USER": "your-username",
        "WINDCHILL_PASSWORD": "your-password",
        "MCP_STDIO_ONLY": "true",
        "LOG_LEVEL": "error"
      }
    }
  }
}
```

**Important**: Replace the following values:
- `/absolute/path/to/windchill-mcp-server` - Full absolute path to your installation directory
- `https://your-windchill-server.com/Windchill` - Your Windchill server URL
- `your-username` - Your Windchill username
- `your-password` - Your Windchill password

#### Multi-Server Configuration (Optional)

If you need to connect to multiple Windchill servers, you can configure numbered server variables:

```json
{
  "mcpServers": {
    "windchill": {
      "command": "node",
      "args": [
        "/absolute/path/to/windchill-mcp-server/dist/index.js"
      ],
      "env": {
        "WINDCHILL_URL_1": "https://plm-prod.windchill.com/Windchill",
        "WINDCHILL_USER_1": "wcadmin",
        "WINDCHILL_PASSWORD_1": "your-password",
        "WINDCHILL_NAME_1": "Production PLM",
        "WINDCHILL_URL_2": "https://plm-dev.windchill.com/Windchill",
        "WINDCHILL_USER_2": "wcadmin",
        "WINDCHILL_PASSWORD_2": "your-password",
        "WINDCHILL_NAME_2": "Development PLM",
        "WINDCHILL_ACTIVE_SERVER": "1",
        "MCP_STDIO_ONLY": "true",
        "LOG_LEVEL": "error"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After updating the configuration:
1. Quit Claude Desktop completely
2. Restart Claude Desktop
3. The Windchill MCP server will automatically start when Claude Desktop launches

## Verifying Installation

### Check Server Status

Open Claude Desktop and ask:
```
Can you list the available Windchill tools?
```

You should see a list of 42+ tools across 5 agents:
- **Part Agent** (19 tools): Part management, BOM structures, searches
- **Document Agent** (25 tools): Document lifecycle, content, relationships
- **Change Agent** (16 tools): Change request management
- **Workflow Agent** (15 tools): Workflow task management
- **Project Agent** (18 tools): Project management operations

### Test Basic Functionality

Try these example queries in Claude Desktop:

```
Search for parts with number starting with "00000"
```

```
List all documents in the system (limit 10)
```

```
Get my workflow tasks
```

## Available Tools

### Part Agent Tools (19 tools)

**Core Operations:**
- `part_search` - Search parts by number, name, or state with wildcard support
- `part_get` - Get detailed part information by ID
- `part_create` - Create new parts
- `part_update` - Update part metadata
- `part_checkout` / `part_checkin` - Check out/in parts for editing
- `part_revise` - Create new part revisions

**BOM Management:**
- `part_get_structure` - Get BOM structure with configurable depth
- `part_add_bom_component` - Add components to BOM
- `part_remove_bom_component` - Remove BOM components
- `part_get_where_used` - Find parent assemblies

**Advanced:**
- `part_advanced_search` - Multi-criteria search
- `part_bulk_update` - Update multiple parts at once

### Document Agent Tools (25 tools)

**Core Lifecycle:**
- `document_search` - Search documents by number/name
- `document_create` - Create new documents
- `document_update` - Update metadata
- `document_checkout` / `document_checkin` - Check out/in
- `document_revise` - Create revisions

**Content Management:**
- `document_upload_content` - Upload files
- `document_download_content` - Download files
- `document_add_attachment` - Add attachments
- `document_get_attachments` - List attachments

**Advanced:**
- `document_advanced_search` - Multi-criteria search with date ranges
- `document_bulk_update` - Update multiple documents
- `document_add_reference` - Link documents
- `document_search_related` - Find related documents

### Change Agent Tools (16 tools)

**Core Operations:**
- `change_search` - Search change requests
- `change_create` - Create change requests
- `change_submit` / `change_approve` / `change_reject` - Workflow actions
- `change_add_affected_object` - Add parts/documents to change

### Workflow Agent Tools (15 tools)

**Task Management:**
- `workflow_get_tasks` - Search workflow tasks
- `workflow_get_my_tasks` - Get current user's tasks
- `workflow_complete_task` - Complete tasks
- `workflow_approve_task` / `workflow_reject_task` - Approval actions
- `workflow_reassign_task` - Reassign to another user

### Project Agent Tools (18 tools)

**Project Management:**
- `project_list` - List/search projects
- `project_create` - Create projects
- `project_get_team` / `project_add_team_member` - Team management
- `project_add_project_object` - Add parts/documents to project

## Alternative: Using .env File (Recommended)

Instead of embedding credentials in Claude Desktop's config, you can use a `.env` file:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Example `.env` file:**
```bash
WINDCHILL_URL=https://your-windchill-server.com/Windchill
WINDCHILL_USER=your-username
WINDCHILL_PASSWORD=your-password
MCP_STDIO_ONLY=true
LOG_LEVEL=error
```

Then simplify your Claude Desktop config:

```json
{
  "mcpServers": {
    "windchill": {
      "command": "node",
      "args": [
        "/absolute/path/to/windchill-mcp-server/dist/index.js"
      ]
    }
  }
}
```

**Benefits:**
- ✅ Credentials not stored in Claude Desktop config
- ✅ Easier to manage and update
- ✅ Can be excluded from version control
- ✅ Same configuration for development and Claude Desktop

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WINDCHILL_URL` | Yes | - | Windchill server base URL |
| `WINDCHILL_USER` | Yes | - | Username for authentication |
| `WINDCHILL_PASSWORD` | Yes | - | Password for authentication |
| `MCP_STDIO_ONLY` | No | `false` | Disable HTTP server (recommended for Claude Desktop) |
| `LOG_LEVEL` | No | `info` | Logging level (`error`, `warn`, `info`, `debug`) |
| `WINDCHILL_TIMEOUT` | No | `30000` | API request timeout in milliseconds |

### Logging

When `MCP_STDIO_ONLY=true`, the server:
- **Disables console logging** to avoid interfering with MCP protocol
- **Writes logs to files** in the `logs/` directory:
  - `windchill-mcp-YYYY-MM-DD.log` - Main application log
  - `windchill-api-YYYY-MM-DD.log` - API request/response log
  - `windchill-mcp-error-YYYY-MM-DD.log` - Error log only

Recommended log level for Claude Desktop: `error` (only log errors)

### Performance Tuning

For optimal performance with Claude Desktop:

```json
{
  "env": {
    "MCP_STDIO_ONLY": "true",
    "LOG_LEVEL": "error",
    "WINDCHILL_TIMEOUT": "30000"
  }
}
```

## Troubleshooting

### Server Not Starting

**Check Claude Desktop logs:**
- macOS: `~/Library/Logs/Claude/mcp*.log`
- Windows: `%APPDATA%\Claude\logs\mcp*.log`

**Common issues:**
1. **Wrong path**: Ensure absolute path to `dist/index.js` is correct
2. **Not built**: Run `npm run build` to compile TypeScript
3. **Missing dependencies**: Run `npm install`
4. **Node.js version**: Ensure Node.js 18+ is installed

### Authentication Errors

**Check your credentials:**
```bash
# Test Windchill connectivity manually
curl -u "username:password" "https://your-windchill-server.com/Windchill/servlet/odata/ProdMgmt/Parts"
```

**Common issues:**
1. **Wrong URL**: Ensure URL ends with `/Windchill`
2. **Wrong credentials**: Verify username/password
3. **REST API disabled**: Contact Windchill administrator
4. **Network issues**: Check firewall/VPN settings

### Tools Not Appearing

**Restart Claude Desktop completely:**
1. Quit Claude Desktop (Cmd+Q on Mac, Alt+F4 on Windows)
2. Wait 5 seconds
3. Restart Claude Desktop

**Check configuration:**
1. JSON syntax is valid (use a JSON validator)
2. All environment variables are set correctly
3. Absolute path is correct (not relative)

### Performance Issues

**Reduce logging:**
```json
{
  "env": {
    "LOG_LEVEL": "error"
  }
}
```

**Increase timeout for slow networks:**
```json
{
  "env": {
    "WINDCHILL_TIMEOUT": "60000"
  }
}
```

### Viewing Logs

**Application logs:**
```bash
cd /path/to/windchill-mcp-server
tail -f logs/windchill-mcp-$(date +%Y-%m-%d).log
```

**API logs:**
```bash
tail -f logs/windchill-api-$(date +%Y-%m-%d).log
```

## Security Considerations

### Credentials Storage

Your Windchill credentials are stored in the Claude Desktop configuration file in **plain text**. Ensure:

1. **File permissions** are restricted:
   ```bash
   chmod 600 ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **Do not commit** the configuration file to version control

3. **Consider using environment variables** instead of hardcoding passwords

### Network Security

- Use **HTTPS** for Windchill URL when possible
- Ensure **VPN** is active if connecting to internal servers
- Review **firewall rules** for necessary access

## Advanced Usage

### Using with npx

Instead of cloning the repository, you can use `npx` to run the server directly:

```json
{
  "mcpServers": {
    "windchill": {
      "command": "npx",
      "args": [
        "-y",
        "windchill-mcp-server"
      ],
      "env": {
        "WINDCHILL_URL": "https://your-server.com/Windchill",
        "WINDCHILL_USER": "username",
        "WINDCHILL_PASSWORD": "password",
        "MCP_STDIO_ONLY": "true",
        "LOG_LEVEL": "error"
      }
    }
  }
}
```

**Note**: This requires the package to be published to npm.

### Development Mode

For development and debugging, you can run the server with console logging enabled:

```json
{
  "env": {
    "MCP_STDIO_ONLY": "false",
    "LOG_LEVEL": "debug"
  }
}
```

**Warning**: This may interfere with the MCP protocol. Only use for debugging.

## Getting Help

### Resources

- **Documentation**: Check the main [README.md](../README.md) for general information
- **CLAUDE.md**: See [CLAUDE.md](../CLAUDE.md) for development guidelines
- **Docker Setup**: See [DOCKER.md](DOCKER.md) for Docker deployment

### Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review the logs in the `logs/` directory
3. Test Windchill connectivity independently
4. Check Claude Desktop logs for MCP errors

### Example Queries to Test

Once configured, try these queries in Claude Desktop:

```
Show me all parts with number starting with "0000"
```

```
Create a new document called "Test Document" with type "SPEC"
```

```
Search for documents created in the last 7 days
```

```
Get the BOM structure for part with ID "VR:wt.part.WTPart:123456"
```

```
Show me my current workflow tasks
```

## Next Steps

- Explore the [Web UI](../README.md#web-interface) for interactive tool discovery
- Review [tool documentation](../README.md#features) for detailed capabilities
- Configure [multiple servers](#multi-server-configuration-optional) if needed
- Set up appropriate [logging levels](#logging) for your use case

---

**Happy Windchill exploration with Claude!** 🚀
