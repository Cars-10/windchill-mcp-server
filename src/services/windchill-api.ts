import axios from "axios";
import { getWindchillConfig } from "../config/windchill.js";
import { serverManager, WindchillServerConfig } from "../config/windchill-servers.js";
import { apiLogger, logger } from "../config/logger.js";

export class WindchillAPIService {
  private client: any;
  private currentConfig: ReturnType<typeof getWindchillConfig>;

  constructor() {
    this.currentConfig = getWindchillConfig();

    logger.info('Initializing WindchillAPIService', {
      baseURL: this.currentConfig.baseURL,
      timeout: this.currentConfig.timeout,
      username: this.currentConfig.username,
      serverId: serverManager.getActiveServerId()
    });

    this.createClient();
    this.setupInterceptors();
  }

  /**
   * Create or recreate the axios client with current configuration
   */
  private createClient() {
    this.currentConfig = getWindchillConfig();

    this.client = (axios as any).create({
      baseURL: this.currentConfig.baseURL + this.currentConfig.apiPath,
      timeout: this.currentConfig.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Update the service to use a different server configuration
   */
  updateServerConfig(serverId: number): void {
    logger.info('Updating WindchillAPIService configuration', {
      previousServerId: serverManager.getActiveServerId(),
      newServerId: serverId
    });

    // Switch server in server manager
    const newServer = serverManager.switchServer(serverId);

    // Recreate client with new configuration
    this.createClient();

    // Re-setup interceptors for new client
    this.setupInterceptors();

    logger.info('WindchillAPIService configuration updated successfully', {
      serverId: newServer.id,
      serverName: newServer.name,
      baseURL: newServer.baseURL
    });
  }

  /**
   * Get current server information
   */
  getCurrentServer(): WindchillServerConfig {
    return serverManager.getActiveServer();
  }

  private setupInterceptors() {
    // Request interceptor for authentication and logging
    this.client.interceptors.request.use(
      async (config: any) => {
        const requestId = this.generateRequestId();
        config.metadata = { requestId, startTime: Date.now() };

        apiLogger.debug('API Request initiated', {
          requestId,
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          authMethod: 'Basic Auth'
        });

        // Construct and log the complete URL
        const completeUrl = `${config.baseURL}${config.url}`;
        apiLogger.debug('Complete URL', {
          requestId,
          completeUrl
        });

        // Use Basic Authentication directly for OData endpoints
        const auth = Buffer.from(
          `${this.currentConfig.username}:${this.currentConfig.password}`
        ).toString("base64");
        config.headers["Authorization"] = `Basic ${auth}`;

        return config;
      },
      (error: any) => {
        apiLogger.error('Request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling and logging
    this.client.interceptors.response.use(
      (response: any) => {
        const { requestId, startTime } = response.config.metadata || {};
        const duration = Date.now() - (startTime || 0);

        apiLogger.info('API Request successful', {
          requestId,
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`,
          dataSize: JSON.stringify(response.data).length
        });

        return response;
      },
      async (error: any) => {
        const { requestId, startTime } = error.config?.metadata || {};
        const duration = Date.now() - (startTime || 0);

        apiLogger.error('API Request failed', {
          requestId,
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          duration: `${duration}ms`,
          errorMessage: error.message,
          errorCode: error.code
        });

        return Promise.reject(error);
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }


  async get(endpoint: string, params?: any, config?: any) {
    apiLogger.debug('GET request initiated', {
      endpoint,
      params,
      hasConfig: !!config
    });
    return this.client.get(endpoint, { params, ...config });
  }

  async post(endpoint: string, data: any, config?: any) {
    apiLogger.debug('POST request initiated', {
      endpoint,
      dataSize: JSON.stringify(data).length,
      hasConfig: !!config
    });
    return this.client.post(endpoint, data, config);
  }

  async put(endpoint: string, data: any) {
    apiLogger.debug('PUT request initiated', {
      endpoint,
      dataSize: JSON.stringify(data).length
    });
    return this.client.put(endpoint, data);
  }

  async patch(endpoint: string, data: any) {
    apiLogger.debug('PATCH request initiated', {
      endpoint,
      dataSize: JSON.stringify(data).length
    });
    return this.client.patch(endpoint, data);
  }

  async delete(endpoint: string) {
    apiLogger.debug('DELETE request initiated', { endpoint });
    return this.client.delete(endpoint);
  }
}

export const windchillAPI = new WindchillAPIService();
