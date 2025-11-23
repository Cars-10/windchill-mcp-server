/**
 * @fileoverview Server Manager Agent - Token-Efficient MCP Tools for Windchill Server Management
 *
 * Provides tools for managing and switching between multiple Windchill servers
 * with token-efficient responses.
 */

import { BaseAgent } from './base-agent.js';
import { serverManager } from '../config/windchill-servers.js';
import axios from 'axios';
import { logger } from '../config/logger.js';
import { ToolDefinition, ToolAnnotations } from '../types/common.js';
import {
  ResponseFormat,
  FORMAT_SCHEMA_PROPS,
  buildErrorResponse
} from '../utils/response-formatter.js';

// ============================================================================
// TOOL ANNOTATIONS
// ============================================================================

const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

const WRITE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true
};

// ============================================================================
// SERVER MANAGER AGENT
// ============================================================================

/**
 * ServerManagerAgent provides tools for managing and switching between multiple Windchill servers.
 *
 * Enables Claude Desktop users to dynamically switch between different Windchill environments
 * (Production, Development, Test) without restarting the MCP server.
 */
export class ServerManagerAgent extends BaseAgent {
  protected agentName = 'servermanager';

  protected tools: ToolDefinition[] = [
    {
      name: 'list_servers',
      description: `List all configured Windchill servers with connection status.

**Parameters:**
- response_format: 'markdown' (default) or 'json'

**Returns:** Server list with ID, name, URL, and active status

**Example:** { }`,
      inputSchema: {
        type: 'object',
        properties: {
          ...FORMAT_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'List Windchill Servers',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          logger.info('Listing all configured Windchill servers');

          const servers = serverManager.getAllServers();
          const activeServerId = serverManager.getActiveServerId();

          const serverList = servers.map(server => ({
            id: server.id,
            name: server.name,
            url: server.baseURL,
            username: server.username,
            isActive: server.id === activeServerId
          }));

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

          if (responseFormat === ResponseFormat.MARKDOWN) {
            const lines: string[] = [];
            lines.push(`## Windchill Servers (${serverList.length} configured)`);
            lines.push('');
            lines.push('| ID | Name | URL | User | Status |');
            lines.push('| --- | --- | --- | --- | --- |');

            serverList.forEach(s => {
              const status = s.isActive ? '**ACTIVE**' : 'Available';
              lines.push(`| ${s.id} | ${s.name} | ${s.url} | ${s.username} | ${status} |`);
            });

            lines.push('');
            lines.push(`> **Active Server:** ${activeServerId}`);

            return lines.join('\n');
          } else {
            return JSON.stringify({
              servers: serverList,
              totalCount: serverList.length,
              activeServerId
            }, null, 2);
          }
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'list servers',
            suggestion: 'Check server configuration in .env file.'
          });
        }
      }
    },

    {
      name: 'get_current_server',
      description: `Get details about the currently active Windchill server.

**Parameters:**
- response_format: 'markdown' (default) or 'json'

**Returns:** Current server details (ID, name, URL, username)

**Example:** { }`,
      inputSchema: {
        type: 'object',
        properties: {
          ...FORMAT_SCHEMA_PROPS
        },
        required: []
      },
      annotations: {
        title: 'Get Current Server',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const server = serverManager.getActiveServer();
          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

          if (responseFormat === ResponseFormat.MARKDOWN) {
            const lines: string[] = [];
            lines.push(`## Current Windchill Server`);
            lines.push('');
            lines.push(`- **ID:** ${server.id}`);
            lines.push(`- **Name:** ${server.name}`);
            lines.push(`- **URL:** ${server.baseURL}`);
            lines.push(`- **Username:** ${server.username}`);
            lines.push(`- **API Path:** ${server.apiPath}`);

            return lines.join('\n');
          } else {
            return JSON.stringify({
              id: server.id,
              name: server.name,
              url: server.baseURL,
              username: server.username,
              timeout: server.timeout,
              apiPath: server.apiPath
            }, null, 2);
          }
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'get current server',
            suggestion: 'Use list_servers to see available servers.'
          });
        }
      }
    },

    {
      name: 'switch_server',
      description: `Switch to a different Windchill server. All subsequent operations use the new server.

**Parameters:**
- serverId (required): Server ID to switch to (1, 2, 3, etc.)
- response_format: 'markdown' or 'json'

**Returns:** Switch confirmation with previous and new server details

**Example:** { "serverId": 2 }

**Note:** Use list_servers first to see available server IDs.`,
      inputSchema: {
        type: 'object',
        properties: {
          serverId: {
            type: 'number',
            description: 'Server ID to switch to (1, 2, 3, etc.)'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['serverId']
      },
      annotations: {
        title: 'Switch Windchill Server',
        ...WRITE_ANNOTATIONS
      },
      handler: async (params: any) => {
        try {
          const requestedServerId = params.serverId;

          if (!serverManager.hasServer(requestedServerId)) {
            const available = serverManager.getAllServers().map(s => `${s.id} (${s.name})`).join(', ');
            return buildErrorResponse(
              `Server ${requestedServerId} not found`,
              {
                operation: 'switch server',
                suggestion: `Available servers: ${available}`
              }
            );
          }

          const previousServer = serverManager.getActiveServer();
          this.api.updateServerConfig(requestedServerId);
          const newServer = serverManager.getActiveServer();

          logger.info('Server switch completed', {
            from: previousServer.name,
            to: newServer.name
          });

          const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

          if (responseFormat === ResponseFormat.MARKDOWN) {
            return `**Switched server successfully**

- **From:** ${previousServer.name} (ID: ${previousServer.id})
- **To:** ${newServer.name} (ID: ${newServer.id})
- **URL:** ${newServer.baseURL}

All subsequent operations will use **${newServer.name}**.`;
          } else {
            return JSON.stringify({
              success: true,
              previousServer: { id: previousServer.id, name: previousServer.name },
              currentServer: { id: newServer.id, name: newServer.name, url: newServer.baseURL }
            }, null, 2);
          }
        } catch (error) {
          return buildErrorResponse(error, {
            operation: 'switch server',
            suggestion: 'Use list_servers to see available servers.'
          });
        }
      }
    },

    {
      name: 'test_connection',
      description: `Test connectivity to a Windchill server without switching.

**Parameters:**
- serverId (required): Server ID to test (1, 2, 3, etc.)
- response_format: 'markdown' or 'json'

**Returns:** Connection status with response time

**Example:** { "serverId": 2 }`,
      inputSchema: {
        type: 'object',
        properties: {
          serverId: {
            type: 'number',
            description: 'Server ID to test connectivity'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['serverId']
      },
      annotations: {
        title: 'Test Server Connection',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        const serverId = params.serverId;
        const server = serverManager.getServerById(serverId);

        if (!server) {
          const available = serverManager.getAllServers().map(s => `${s.id} (${s.name})`).join(', ');
          return buildErrorResponse(
            `Server ${serverId} not found`,
            { suggestion: `Available servers: ${available}` }
          );
        }

        const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

        try {
          const startTime = Date.now();
          const testUrl = `${server.baseURL}/servlet/WindchillAuthGW/wt.httpgw.HTTPServer/`;
          const testResponse = await (axios as any).get(testUrl, {
            timeout: 10000,
            auth: { username: server.username, password: server.password },
            validateStatus: () => true
          });
          const responseTime = Date.now() - startTime;

          const isReachable = testResponse.status < 500;

          if (responseFormat === ResponseFormat.MARKDOWN) {
            if (isReachable) {
              return `**Connection Test: SUCCESS**

- **Server:** ${server.name} (ID: ${server.id})
- **URL:** ${server.baseURL}
- **Status:** ${testResponse.status}
- **Response Time:** ${responseTime}ms`;
            } else {
              return `**Connection Test: FAILED**

- **Server:** ${server.name} (ID: ${server.id})
- **Status:** ${testResponse.status} (Server Error)

> **Suggestion:** Server may be down or misconfigured.`;
            }
          } else {
            return JSON.stringify({
              success: isReachable,
              reachable: isReachable,
              server: { id: server.id, name: server.name, url: server.baseURL },
              statusCode: testResponse.status,
              responseTimeMs: responseTime
            }, null, 2);
          }
        } catch (error: any) {
          if (responseFormat === ResponseFormat.MARKDOWN) {
            return `**Connection Test: FAILED**

- **Server:** ${server.name} (ID: ${server.id})
- **Error:** ${error.message}

> **Suggestion:** Check network connectivity and server URL.`;
          } else {
            return JSON.stringify({
              success: false,
              reachable: false,
              server: { id: server.id, name: server.name },
              error: error.message
            }, null, 2);
          }
        }
      }
    },

    {
      name: 'get_server_info',
      description: `Get detailed information about a specific server by ID.

**Parameters:**
- serverId (required): Server ID (1, 2, 3, etc.)
- response_format: 'markdown' or 'json'

**Returns:** Server configuration details

**Example:** { "serverId": 1 }`,
      inputSchema: {
        type: 'object',
        properties: {
          serverId: {
            type: 'number',
            description: 'Server ID to get information about'
          },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['serverId']
      },
      annotations: {
        title: 'Get Server Info',
        ...READ_ONLY_ANNOTATIONS
      },
      handler: async (params: any) => {
        const serverId = params.serverId;
        const server = serverManager.getServerById(serverId);

        if (!server) {
          const available = serverManager.getAllServers().map(s => `${s.id} (${s.name})`).join(', ');
          return buildErrorResponse(
            `Server ${serverId} not found`,
            { suggestion: `Available servers: ${available}` }
          );
        }

        const isActive = serverId === serverManager.getActiveServerId();
        const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

        if (responseFormat === ResponseFormat.MARKDOWN) {
          const lines: string[] = [];
          lines.push(`## Server: ${server.name}`);
          lines.push('');
          lines.push(`- **ID:** ${server.id}`);
          lines.push(`- **URL:** ${server.baseURL}`);
          lines.push(`- **Username:** ${server.username}`);
          lines.push(`- **API Path:** ${server.apiPath}`);
          lines.push(`- **Timeout:** ${server.timeout}ms`);
          lines.push(`- **Status:** ${isActive ? '**ACTIVE**' : 'Available'}`);

          return lines.join('\n');
        } else {
          return JSON.stringify({
            id: server.id,
            name: server.name,
            url: server.baseURL,
            username: server.username,
            apiPath: server.apiPath,
            timeout: server.timeout,
            isActive,
            fullApiUrl: `${server.baseURL}${server.apiPath}`
          }, null, 2);
        }
      }
    }
  ];
}
