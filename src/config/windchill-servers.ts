import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root, not from current working directory
// This ensures it works when run from any directory (e.g., Claude Desktop runs from /)
const projectRoot = path.resolve(__dirname, '../..');
const envPath = path.join(projectRoot, '.env');

dotenv.config({ path: envPath });

export interface WindchillServerConfig {
  id: number;
  name: string;
  baseURL: string;
  username: string;
  password: string;
  timeout: number;
  apiPath: string;
}

class WindchillServerManager {
  private servers: Map<number, WindchillServerConfig> = new Map();
  private activeServerId: number = 1;

  constructor() {
    this.loadServers();
  }

  /**
   * Load all server configurations from environment variables
   */
  private loadServers() {
    logger.info('Loading Windchill server configurations...');

    // First, try to load numbered servers (WINDCHILL_*_1, WINDCHILL_*_2, etc.)
    let serverCount = 0;
    for (let i = 1; i <= 10; i++) {
      const url = process.env[`WINDCHILL_URL_${i}`];
      const user = process.env[`WINDCHILL_USER_${i}`];
      const password = process.env[`WINDCHILL_PASSWORD_${i}`];
      const name = process.env[`WINDCHILL_NAME_${i}`];

      if (url && user && password) {
        this.servers.set(i, {
          id: i,
          name: name || `Windchill Server ${i}`,
          baseURL: url,
          username: user,
          password: password,
          timeout: 30000,
          apiPath: '/servlet/odata'
        });
        serverCount++;
        logger.info(`Loaded server ${i}: ${name || `Server ${i}`}`, { url });
      }
    }

    // If no numbered servers found, use legacy single-server configuration
    if (serverCount === 0) {
      const legacyUrl = process.env.WINDCHILL_URL;
      const legacyUser = process.env.WINDCHILL_USER;
      const legacyPassword = process.env.WINDCHILL_PASSWORD;

      if (legacyUrl && legacyUser && legacyPassword) {
        this.servers.set(1, {
          id: 1,
          name: 'Windchill Server',
          baseURL: legacyUrl,
          username: legacyUser,
          password: legacyPassword,
          timeout: 30000,
          apiPath: '/servlet/odata'
        });
        serverCount = 1;
        logger.info('Loaded legacy single-server configuration', { url: legacyUrl });
      }
    }

    if (serverCount === 0) {
      logger.error('No Windchill server configurations found!');
      throw new Error('No Windchill server configurations found in environment variables');
    }

    // Set active server from environment or default to 1
    const activeServerEnv = process.env.WINDCHILL_ACTIVE_SERVER;
    if (activeServerEnv) {
      const activeId = parseInt(activeServerEnv, 10);
      if (this.servers.has(activeId)) {
        this.activeServerId = activeId;
        logger.info(`Active server set to: ${activeId}`);
      } else {
        logger.warn(`WINDCHILL_ACTIVE_SERVER=${activeId} not found, defaulting to server 1`);
        this.activeServerId = 1;
      }
    } else {
      // Default to first available server
      this.activeServerId = Array.from(this.servers.keys())[0];
      logger.info(`No WINDCHILL_ACTIVE_SERVER specified, defaulting to server ${this.activeServerId}`);
    }

    logger.info(`Successfully loaded ${serverCount} Windchill server(s)`, {
      activeServer: this.activeServerId,
      serverIds: Array.from(this.servers.keys())
    });
  }

  /**
   * Get all available server configurations
   */
  getAllServers(): WindchillServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get currently active server configuration
   */
  getActiveServer(): WindchillServerConfig {
    const server = this.servers.get(this.activeServerId);
    if (!server) {
      logger.error(`Active server ${this.activeServerId} not found!`);
      throw new Error(`Active server ${this.activeServerId} not found`);
    }
    return server;
  }

  /**
   * Get active server ID
   */
  getActiveServerId(): number {
    return this.activeServerId;
  }

  /**
   * Get specific server by ID
   */
  getServerById(id: number): WindchillServerConfig | undefined {
    return this.servers.get(id);
  }

  /**
   * Switch to a different server
   */
  switchServer(serverId: number): WindchillServerConfig {
    const server = this.servers.get(serverId);
    if (!server) {
      logger.error(`Cannot switch to server ${serverId}: not found`);
      throw new Error(`Server ${serverId} not found`);
    }

    const previousServerId = this.activeServerId;
    const previousServer = this.getActiveServer();

    this.activeServerId = serverId;

    logger.info('Switched Windchill server', {
      from: {
        id: previousServerId,
        name: previousServer.name,
        url: previousServer.baseURL
      },
      to: {
        id: serverId,
        name: server.name,
        url: server.baseURL
      },
      timestamp: new Date().toISOString()
    });

    return server;
  }

  /**
   * Validate if server ID exists
   */
  hasServer(serverId: number): boolean {
    return this.servers.has(serverId);
  }

  /**
   * Get count of configured servers
   */
  getServerCount(): number {
    return this.servers.size;
  }
}

// Export singleton instance
export const serverManager = new WindchillServerManager();
