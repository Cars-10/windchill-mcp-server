import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import dotenv from 'dotenv';
import { logger } from './config/logger.js';
import { serverManager } from './config/windchill-servers.js';
import { windchillAPI } from './services/windchill-api.js';
import { PartAgent } from './agents/part-agent.js';
import { ChangeAgent } from './agents/change-agent.js';
import { DocumentAgent } from './agents/document-agent.js';
import { WorkflowAgent } from './agents/workflow-agent.js';
import { ProjectAgent } from './agents/project-agent.js';

dotenv.config();

const server = new Server(
  {
    name: process.env.MCP_SERVER_NAME || 'windchill-mcp',
    version: process.env.MCP_SERVER_VERSION || '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize agents
logger.info('Initializing MCP agents...');
const agents = {
  part: new PartAgent(),
  change: new ChangeAgent(),
  document: new DocumentAgent(),
  workflow: new WorkflowAgent(),
  project: new ProjectAgent(),
};

// Collect all tools from agents
const allTools: any[] = [];
const toolHandlers = new Map<string, (params: any) => Promise<any>>();

Object.values(agents).forEach(agent => {
  const agentTools = (agent as any).tools || [];
  const agentName = (agent as any).agentName || 'unknown';

  logger.debug('Registering tools for agent', {
    agentName,
    toolCount: agentTools.length,
    tools: agentTools.map((t: any) => t.name)
  });

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

logger.info('Agent initialization complete', {
  agentCount: Object.keys(agents).length,
  totalTools: allTools.length,
  agents: Object.keys(agents)
});

// Register tools/list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.debug('Tools list requested', { toolCount: allTools.length });
  return { tools: allTools };
});

// Register tools/call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const requestId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  logger.info('Tool execution started', {
    requestId,
    toolName,
    arguments: request.params.arguments
  });

  const handler = toolHandlers.get(toolName);

  if (!handler) {
    logger.error('Tool not found', { requestId, toolName, availableTools: Array.from(toolHandlers.keys()) });
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    const result = await handler(request.params.arguments);
    const duration = Date.now() - startTime;

    logger.info('Tool execution successful', {
      requestId,
      toolName,
      duration: `${duration}ms`,
      resultSize: result ? JSON.stringify(result).length : 0,
      hasResult: !!result
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('Tool execution failed', {
      requestId,
      toolName,
      duration: `${duration}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Create a simple HTTP health check server for Docker
const healthCheckPort = parseInt(process.env.MCP_SERVER_PORT || '3000', 10);
const healthServer = http.createServer((req, res) => {
  const requestId = `http_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add CORS headers for Angular app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health') {
    logger.debug('Health check requested', { requestId, ip: req.socket.remoteAddress });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'windchill-mcp',
      version: process.env.MCP_SERVER_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
      agents: Object.keys(agents).length,
      tools: allTools.length
    }));
  } else if (req.url === '/' || req.url === '/api/info') {
    logger.debug('Server info requested', { requestId, ip: req.socket.remoteAddress, url: req.url });

    const currentServer = serverManager.getActiveServer();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify({
      name: 'Windchill MCP Server',
      version: process.env.MCP_SERVER_VERSION || '1.0.0',
      status: 'running',
      agents: Object.keys(agents),
      tools: allTools.length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      windchillServer: {
        id: currentServer.id,
        name: currentServer.name,
        url: currentServer.baseURL
      }
    }));
  } else if (req.url === '/tools' || req.url === '/api' || req.url === '/api/tools') {
    logger.debug('Tools list requested via HTTP', { requestId, ip: req.socket.remoteAddress, url: req.url, method: req.method });

    // Handle GET requests directly
    if (req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end(JSON.stringify({ tools: allTools }));
      return;
    }

    // Handle both direct tools list and MCP JSON-RPC requests for POST
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        let response: any;

        // Try to parse as JSON-RPC if body is present
        if (body) {
          try {
            const jsonRpcRequest = JSON.parse(body);

            // Check if it's a valid JSON-RPC request
            if (jsonRpcRequest.jsonrpc === '2.0' && jsonRpcRequest.method) {
              logger.debug('Processing JSON-RPC request', { requestId, method: jsonRpcRequest.method });

              if (jsonRpcRequest.method === 'tools/list') {
            response = {
              jsonrpc: '2.0',
              id: jsonRpcRequest.id,
              result: {
                tools: allTools
              }
            };
          } else if (jsonRpcRequest.method === 'tools/call') {
            const toolName = jsonRpcRequest.params.name;
            const handler = toolHandlers.get(toolName);

            if (!handler) {
              response = {
                jsonrpc: '2.0',
                id: jsonRpcRequest.id,
                error: {
                  code: -32601,
                  message: `Unknown tool: ${toolName}`
                }
              };
            } else {
              try {
                const result = await handler(jsonRpcRequest.params.arguments);
                response = {
                  jsonrpc: '2.0',
                  id: jsonRpcRequest.id,
                  result: {
                    content: [
                      {
                        type: 'text',
                        text: result ? JSON.stringify(result, null, 2) : 'No result returned',
                      },
                    ],
                  }
                };
              } catch (error: any) {
                response = {
                  jsonrpc: '2.0',
                  id: jsonRpcRequest.id,
                  error: {
                    code: -32603,
                    message: error.message || 'Internal error'
                  }
                };
              }
            }
              } else {
                response = {
                  jsonrpc: '2.0',
                  id: jsonRpcRequest.id,
                  error: {
                    code: -32601,
                    message: `Method not found: ${jsonRpcRequest.method}`
                  }
                };
              }

              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
              });
              res.end(JSON.stringify(response));
              return;
            }
          } catch (parseError) {
            // Body is not valid JSON or not a JSON-RPC request, fall through
            logger.debug('Body is not valid JSON-RPC', { requestId });
          }
        }

        // Handle direct tools list request (non-JSON-RPC POST or empty body)
        response = {
          tools: allTools
        };

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify(response));

      } catch (error: any) {
        logger.error('Error processing tools request', { requestId, error: error.message });
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Invalid request',
          message: error.message
        }));
      }
    });
  } else if (req.url?.startsWith('/api/tools/')) {
    // Handle direct tool execution: /api/tools/{toolName}
    const toolName = req.url.replace('/api/tools/', '');

    logger.info('=== SERVER: Direct tool execution requested ===', {
      requestId,
      toolName,
      ip: req.socket.remoteAddress,
      timestamp: new Date().toISOString()
    });

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        let parameters: any = {};

        // Parse request body if present
        if (body) {
          const contentType = req.headers['content-type'] || '';

          if (contentType.includes('application/x-www-form-urlencoded')) {
            // Handle form data from Angular forms
            logger.debug('Parsing form data', { requestId, contentType, bodyLength: body.length });

            // Parse form data manually since we don't have querystring library
            const formParams = new URLSearchParams(body);
            for (const [key, value] of formParams.entries()) {
              parameters[key] = value;
            }

            // Convert number parameters back to numbers
            // We need to check the tool schema to know which parameters should be numbers
            // For now, try to convert common number fields
            if (parameters.limit || parameters.number) {
              if (parameters.limit && !isNaN(Number(parameters.limit))) {
                parameters.limit = Number(parameters.limit);
              }
              if (parameters.number && /^\d+$/.test(parameters.number)) {
                parameters.number = Number(parameters.number);
              }
            }

          } else if (contentType.includes('application/json')) {
            // Handle JSON data
            try {
              parameters = JSON.parse(body);
            } catch (parseError) {
              logger.warn('Invalid JSON in tool execution request', { requestId, body });
            }
          } else {
            // Try to parse as JSON first, fallback to form data
            try {
              parameters = JSON.parse(body);
            } catch (parseError) {
              logger.debug('Trying form data parsing as fallback', { requestId });
              try {
                const formParams = new URLSearchParams(body);
                for (const [key, value] of formParams.entries()) {
                  parameters[key] = value;
                }
              } catch (formParseError) {
                logger.warn('Could not parse request body', { requestId, body });
              }
            }
          }
        }

        logger.info('=== SERVER: Parameter parsing completed ===', {
          requestId,
          toolName,
          parameterCount: Object.keys(parameters).length,
          parameters: parameters,
          parameterTypes: Object.entries(parameters).map(([k, v]) => ({ [k]: typeof v }))
        });

        const handler = toolHandlers.get(toolName);

        if (!handler) {
          logger.error('=== SERVER: Tool not found ===', {
            requestId,
            toolName,
            availableTools: Array.from(toolHandlers.keys())
          });

          res.writeHead(404, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({
            error: 'Tool not found',
            message: `Tool '${toolName}' is not available`
          }));
          return;
        }

        logger.info('=== SERVER: Executing tool handler ===', {
          requestId,
          toolName,
          handlerFound: !!handler
        });

        try {
          const result = await handler(parameters);

          logger.info('=== SERVER: Tool execution successful ===', {
            requestId,
            toolName,
            resultType: typeof result,
            resultSize: result ? JSON.stringify(result).length : 0,
            hasResult: !!result
          });

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(JSON.stringify(result));

        } catch (error: any) {
          logger.error('=== SERVER: Tool execution failed ===', {
            requestId,
            toolName,
            parameters,
            error: error.message,
            stack: error.stack
          });

          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({
            error: 'Tool execution failed',
            message: error.message || 'Internal server error'
          }));
        }

      } catch (error: any) {
        logger.error('Error processing tool execution', { requestId, error: error.message });
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Invalid request',
          message: error.message
        }));
      }
    });
  } else if (req.url === '/api/servers') {
    // GET /api/servers - List all available Windchill servers
    logger.debug('Available servers list requested', { requestId, ip: req.socket.remoteAddress });

    const servers = serverManager.getAllServers().map(server => ({
      id: server.id,
      name: server.name,
      url: server.baseURL,
      username: server.username,
      isActive: server.id === serverManager.getActiveServerId()
    }));

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify({ servers }));
  } else if (req.url === '/api/servers/current') {
    // GET /api/servers/current - Get currently active server
    logger.debug('Current server info requested', { requestId, ip: req.socket.remoteAddress });

    const currentServer = serverManager.getActiveServer();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify({
      id: currentServer.id,
      name: currentServer.name,
      url: currentServer.baseURL,
      username: currentServer.username
    }));
  } else if (req.url === '/api/servers/switch') {
    // POST /api/servers/switch - Switch to different server
    logger.debug('Server switch requested', { requestId, ip: req.socket.remoteAddress });

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { serverId } = JSON.parse(body);

        if (!serverId || typeof serverId !== 'number') {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({
            error: 'Invalid request',
            message: 'serverId is required and must be a number'
          }));
          return;
        }

        if (!serverManager.hasServer(serverId)) {
          res.writeHead(404, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({
            error: 'Server not found',
            message: `Server with ID ${serverId} not found`
          }));
          return;
        }

        logger.info('Testing connectivity to Windchill server before switch', {
          requestId,
          fromServer: serverManager.getActiveServerId(),
          toServer: serverId,
          ip: req.socket.remoteAddress
        });

        // Get the target server config to test connectivity
        const targetServer = serverManager.getServerById(serverId);
        if (!targetServer) {
          res.writeHead(404, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({
            error: 'Server not found',
            message: `Server configuration for ID ${serverId} not found`
          }));
          return;
        }

        // Test connectivity to the Windchill server
        try {
          logger.debug('Testing connection to Windchill server', {
            serverId,
            url: targetServer.baseURL
          });

          const axios = (await import('axios')).default;
          const testResponse = await axios.get(`${targetServer.baseURL}/servlet/WindchillAuthGW/wt.httpgw.HTTPServer/`
, {
            timeout: 5000,
            validateStatus: (status) => status < 500, // Accept any status < 500 as "server is reachable"
            auth: {
              username: targetServer.username,
              password: targetServer.password
            }
          });

          logger.info('Windchill server connectivity test passed', {
            serverId,
            serverName: targetServer.name,
            status: testResponse.status
          });
        } catch (connectError: any) {
          logger.error('Windchill server connectivity test failed', {
            serverId,
            serverName: targetServer.name,
            error: connectError.message,
            code: connectError.code
          });

          res.writeHead(503, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({
            error: 'Server unreachable',
            message: `Cannot connect to ${targetServer.name} at ${targetServer.baseURL}`,
            details: connectError.code === 'ECONNREFUSED'
              ? 'Connection refused - server may be down'
              : connectError.code === 'ETIMEDOUT'
              ? 'Connection timed out - server not responding'
              : connectError.message
          }));
          return;
        }

        logger.info('Switching Windchill server', {
          requestId,
          fromServer: serverManager.getActiveServerId(),
          toServer: serverId,
          ip: req.socket.remoteAddress
        });

        // Update the WindchillAPIService configuration
        windchillAPI.updateServerConfig(serverId);

        const newServer = serverManager.getActiveServer();

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify({
          success: true,
          message: `Switched to ${newServer.name}`,
          server: {
            id: newServer.id,
            name: newServer.name,
            url: newServer.baseURL,
            username: newServer.username
          }
        }));

      } catch (error: any) {
        logger.error('Error switching servers', { requestId, error: error.message, stack: error.stack });
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          error: 'Server switch failed',
          message: error.message || 'Unknown error occurred'
        }));
      }
    });
  } else {
    logger.debug('404 request', { requestId, url: req.url, ip: req.socket.remoteAddress });
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Start the MCP server
async function main() {
  try {
    logger.info('Starting Windchill MCP Server...');

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('MCP Server connected successfully', {
      serverName: process.env.MCP_SERVER_NAME || 'windchill-mcp',
      serverVersion: process.env.MCP_SERVER_VERSION || '1.0.0',
      toolsRegistered: allTools.length,
      agentsLoaded: Object.keys(agents).length
    });

    // Also log to stderr for compatibility
    console.error('Windchill MCP Server started successfully');
    console.error(`Registered ${allTools.length} tools from ${Object.keys(agents).length} agents`);

    // Start health check server
    healthServer.listen(healthCheckPort, () => {
      logger.info('Health check server started', {
        port: healthCheckPort,
        endpoints: ['/health', '/'],
        timestamp: new Date().toISOString()
      });

      // Also log to stderr for compatibility
      console.error(`Health check server listening on port ${healthCheckPort}`);
      console.error(`Server started at: ${new Date().toISOString()}`);
    });

  } catch (error: any) {
    logger.error('Failed to start MCP Server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  console.error('Shutting down gracefully...');
  healthServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  console.error('Shutting down gracefully...');
  healthServer.close();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason,
    promise: promise
  });
});

main().catch(console.error);
