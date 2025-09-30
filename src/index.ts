import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import dotenv from 'dotenv';
import { logger } from './config/logger.js';
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
      resultSize: JSON.stringify(result).length
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
  } else if (req.url === '/') {
    logger.debug('Server info requested', { requestId, ip: req.socket.remoteAddress });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Windchill MCP Server',
      version: process.env.MCP_SERVER_VERSION || '1.0.0',
      status: 'running',
      agents: Object.keys(agents),
      tools: allTools.length,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }));
  } else if (req.url === '/tools' || req.url === '/api') {
    logger.debug('Tools list requested via HTTP', { requestId, ip: req.socket.remoteAddress, url: req.url });

    // Handle both direct tools list and MCP JSON-RPC requests
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        let response: any;

        if (body && req.url === '/api') {
          // Handle MCP JSON-RPC 2.0 request
          const jsonRpcRequest = JSON.parse(body);

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
                        text: JSON.stringify(result, null, 2),
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
        } else {
          // Handle direct tools list request
          response = {
            tools: allTools
          };
        }

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
