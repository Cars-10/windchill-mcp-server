import { BaseAgent } from './base-agent.js';
import { serverManager } from '../config/windchill-servers.js';
import axios from 'axios';
import { logger } from '../config/logger.js';

/**
 * ServerManagerAgent provides tools for managing and switching between multiple Windchill servers.
 *
 * This agent exposes server management capabilities through MCP, allowing Claude Desktop users
 * to dynamically switch between different Windchill environments (Production, Development, Test, etc.)
 * without restarting the MCP server or reconfiguring Claude Desktop.
 *
 * **Core Capabilities:**
 * - list_servers: List all configured Windchill servers
 * - get_current_server: Get details about the currently active server
 * - switch_server: Switch to a different Windchill server
 * - test_connection: Test connectivity to a server before switching
 *
 * **Multi-Server Configuration:**
 * Servers are configured in .env with numbered suffixes:
 * ```
 * WINDCHILL_URL_1=http://prod.windchill.com/Windchill
 * WINDCHILL_USER_1=wcadmin
 * WINDCHILL_PASSWORD_1=wcadmin
 * WINDCHILL_NAME_1=Production PLM
 *
 * WINDCHILL_URL_2=http://dev.windchill.com/Windchill
 * WINDCHILL_USER_2=wcadmin
 * WINDCHILL_PASSWORD_2=wcadmin
 * WINDCHILL_NAME_2=Development PLM
 * ```
 *
 * **How It Works:**
 * 1. User asks Claude: "Switch to Development server"
 * 2. Claude calls: servermanager_switch_server({serverId: 2})
 * 3. WindchillAPIService updates its configuration
 * 4. All subsequent tool calls automatically use the new server
 *
 * **Note:** Server switching is persistent for the current MCP session.
 * When the MCP server restarts, it reverts to WINDCHILL_ACTIVE_SERVER from .env.
 */
export class ServerManagerAgent extends BaseAgent {
  protected agentName = 'servermanager';

  protected tools = [
    {
      name: 'list_servers',
      description: 'List all configured Windchill servers with their connection details and status',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: async (params: any) => {
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

        logger.info('Server list retrieved', {
          totalServers: serverList.length,
          activeServer: activeServerId
        });

        return {
          servers: serverList,
          totalCount: serverList.length,
          activeServerId
        };
      }
    },
    {
      name: 'get_current_server',
      description: 'Get details about the currently active Windchill server',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: async (params: any) => {
        logger.info('Getting current active server information');

        const server = serverManager.getActiveServer();

        const serverInfo = {
          id: server.id,
          name: server.name,
          url: server.baseURL,
          username: server.username,
          timeout: server.timeout,
          apiPath: server.apiPath
        };

        logger.info('Current server retrieved', {
          serverId: server.id,
          serverName: server.name
        });

        return serverInfo;
      }
    },
    {
      name: 'switch_server',
      description: 'Switch to a different Windchill server by its ID. All subsequent operations will use the new server.',
      inputSchema: {
        type: 'object',
        properties: {
          serverId: {
            type: 'number',
            description: 'Server ID to switch to (1, 2, 3, etc.). Use list_servers to see available servers.'
          }
        },
        required: ['serverId']
      },
      handler: async (params: any) => {
        const requestedServerId = params.serverId;

        logger.info('Server switch requested', {
          fromServer: serverManager.getActiveServerId(),
          toServer: requestedServerId
        });

        // Validate server exists
        if (!serverManager.hasServer(requestedServerId)) {
          logger.error('Server switch failed: server not found', {
            requestedServerId,
            availableServers: serverManager.getAllServers().map(s => s.id)
          });

          throw new Error(
            `Server ${requestedServerId} not found. Available servers: ${
              serverManager.getAllServers().map(s => `${s.id} (${s.name})`).join(', ')
            }`
          );
        }

        // Get previous server info for logging
        const previousServer = serverManager.getActiveServer();

        // Switch server in WindchillAPIService
        // Note: windchillAPI is imported in BaseAgent and accessible via this.api
        // The api service has a reference to serverManager and will update automatically
        this.api.updateServerConfig(requestedServerId);

        // Get new server info
        const newServer = serverManager.getActiveServer();

        logger.info('Server switch completed successfully', {
          previousServer: {
            id: previousServer.id,
            name: previousServer.name
          },
          newServer: {
            id: newServer.id,
            name: newServer.name
          },
          timestamp: new Date().toISOString()
        });

        return {
          success: true,
          message: `Successfully switched from "${previousServer.name}" to "${newServer.name}"`,
          previousServer: {
            id: previousServer.id,
            name: previousServer.name,
            url: previousServer.baseURL
          },
          currentServer: {
            id: newServer.id,
            name: newServer.name,
            url: newServer.baseURL,
            username: newServer.username
          }
        };
      }
    },
    {
      name: 'test_connection',
      description: 'Test connectivity to a Windchill server without switching to it. Useful for verifying server availability.',
      inputSchema: {
        type: 'object',
        properties: {
          serverId: {
            type: 'number',
            description: 'Server ID to test connectivity (1, 2, 3, etc.)'
          }
        },
        required: ['serverId']
      },
      handler: async (params: any) => {
        const serverId = params.serverId;

        logger.info('Server connection test requested', { serverId });

        // Get server configuration
        const server = serverManager.getServerById(serverId);
        if (!server) {
          logger.error('Server not found for connection test', {
            serverId,
            availableServers: serverManager.getAllServers().map(s => s.id)
          });

          throw new Error(
            `Server ${serverId} not found. Available servers: ${
              serverManager.getAllServers().map(s => `${s.id} (${s.name})`).join(', ')
            }`
          );
        }

        // Test connectivity by attempting to reach Windchill's authentication gateway
        try {
          logger.debug('Testing connection to Windchill server', {
            serverId,
            serverName: server.name,
            url: server.baseURL
          });

          const testUrl = `${server.baseURL}/servlet/WindchillAuthGW/wt.httpgw.HTTPServer/`;
          const testResponse = await (axios as any).get(testUrl, {
            timeout: 10000,
            auth: {
              username: server.username,
              password: server.password
            },
            validateStatus: () => true // Accept any status code
          });

          const isReachable = testResponse.status < 500;

          if (isReachable) {
            logger.info('Server connection test successful', {
              serverId,
              serverName: server.name,
              statusCode: testResponse.status
            });

            return {
              success: true,
              reachable: true,
              message: `Server "${server.name}" is reachable`,
              server: {
                id: server.id,
                name: server.name,
                url: server.baseURL
              },
              statusCode: testResponse.status,
              responseTime: testResponse.headers['x-response-time'] || 'N/A'
            };
          } else {
            logger.warn('Server returned server error status', {
              serverId,
              serverName: server.name,
              statusCode: testResponse.status
            });

            return {
              success: false,
              reachable: false,
              message: `Server "${server.name}" returned error status ${testResponse.status}`,
              server: {
                id: server.id,
                name: server.name,
                url: server.baseURL
              },
              statusCode: testResponse.status
            };
          }
        } catch (error: any) {
          logger.error('Server connection test failed', {
            serverId,
            serverName: server.name,
            error: error.message
          });

          return {
            success: false,
            reachable: false,
            message: `Cannot connect to server "${server.name}": ${error.message}`,
            server: {
              id: server.id,
              name: server.name,
              url: server.baseURL
            },
            error: {
              code: error.code,
              message: error.message
            }
          };
        }
      }
    },
    {
      name: 'get_server_info',
      description: 'Get detailed information about a specific Windchill server by its ID',
      inputSchema: {
        type: 'object',
        properties: {
          serverId: {
            type: 'number',
            description: 'Server ID to get information about (1, 2, 3, etc.)'
          }
        },
        required: ['serverId']
      },
      handler: async (params: any) => {
        const serverId = params.serverId;

        logger.info('Server info requested', { serverId });

        const server = serverManager.getServerById(serverId);
        if (!server) {
          logger.error('Server not found', {
            serverId,
            availableServers: serverManager.getAllServers().map(s => s.id)
          });

          throw new Error(
            `Server ${serverId} not found. Available servers: ${
              serverManager.getAllServers().map(s => `${s.id} (${s.name})`).join(', ')
            }`
          );
        }

        const isActive = serverId === serverManager.getActiveServerId();

        logger.info('Server info retrieved', {
          serverId,
          serverName: server.name,
          isActive
        });

        return {
          id: server.id,
          name: server.name,
          url: server.baseURL,
          username: server.username,
          timeout: server.timeout,
          apiPath: server.apiPath,
          isActive,
          fullApiUrl: `${server.baseURL}${server.apiPath}`
        };
      }
    }
  ];
}
