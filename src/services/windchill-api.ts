import axios from "axios";
import { getWindchillConfig } from "../config/windchill.js";
import { serverManager, WindchillServerConfig } from "../config/windchill-servers.js";
import { apiLogger, logger } from "../config/logger.js";
import { WindchillAPIError, WindchillError } from "../types/common.js";

export class WindchillAPIService {
  private client: any;
  private currentConfig: ReturnType<typeof getWindchillConfig>;
  private csrfToken: string | null = null;

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

    // Clear CSRF token (each server has its own token)
    this.csrfToken = null;

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

        // Log all headers being sent (excluding auth for security)
        const headersToLog = { ...config.headers };
        delete headersToLog.Authorization;
        apiLogger.debug('Request headers', {
          requestId,
          headers: headersToLog
        });

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

        // Log detailed error information including response body
        const errorDetails: any = {
          requestId,
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          duration: `${duration}ms`,
          errorMessage: error.message,
          errorCode: error.code
        };

        // Add response body if available (helps debug 400 errors)
        if (error.response?.data) {
          errorDetails.responseBody = error.response.data;
        }

        apiLogger.error('API Request failed', errorDetails);

        // Create a more informative error
        const windchillError = new WindchillAPIError(
          error.response?.data?.error?.message || error.message,
          error.response?.status,
          error.response?.data
        );

        return Promise.reject(windchillError);
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Fetch CSRF token (nonce) from Windchill
   * Required for POST/PUT/DELETE operations
   */
  private async fetchCsrfToken(): Promise<string> {
    try {
      apiLogger.debug('Fetching CSRF token from Windchill');

      // Make a GET request to the OData root to get CSRF token
      const response = await this.client.get('/', {
        headers: {
          'X-CSRF-Token': 'fetch'
        }
      });

      // Log all response headers for debugging
      apiLogger.debug('Response headers received', {
        headers: Object.keys(response.headers),
        allHeaders: response.headers
      });

      // Try different header name variations
      const token = response.headers['x-csrf-token'] ||
                    response.headers['X-CSRF-Token'] ||
                    response.headers['X-Csrf-Token'] ||
                    response.headers['csrf-token'] ||
                    response.headers['CSRF-Token'];

      if (token) {
        apiLogger.debug('CSRF token received', { tokenLength: token.length });
        this.csrfToken = token;
        return token;
      }

      // If no token header, Windchill might not require CSRF for this version
      // Return a dummy token and let the POST request proceed
      apiLogger.warn('No CSRF token in response headers - Windchill may not require CSRF protection');
      this.csrfToken = 'NO_CSRF_REQUIRED';
      return this.csrfToken;
    } catch (error: any) {
      apiLogger.error('Failed to fetch CSRF token', { error: error.message });
      throw error;
    }
  }

  /**
   * Get valid CSRF token, fetching new one if needed
   */
  private async getCsrfToken(): Promise<string> {
    if (!this.csrfToken) {
      await this.fetchCsrfToken();
    }
    return this.csrfToken!;
  }

  async get(endpoint: string, params?: any, config?: any) {
    apiLogger.debug('GET request initiated', {
      endpoint,
      params,
      hasConfig: !!config,
      wildcardSearch: config?.wildcardSearch
    });

    // Build headers object
    const headers = { ...config?.headers };
    if (config?.wildcardSearch) {
      headers['PTC-WildcardSearch'] = 'true';
      apiLogger.debug('Wildcard search enabled', { endpoint, headers });
    }

    // Merge config properly
    const requestConfig = {
      params,
      ...config,
      headers
    };

    return this.client.get(endpoint, requestConfig);
  }

  async post(endpoint: string, data: any, config?: any) {
    apiLogger.debug('POST request initiated', {
      endpoint,
      dataSize: JSON.stringify(data).length,
      hasConfig: !!config
    });

    // Get CSRF token and add to headers
    try {
      const csrfToken = await this.getCsrfToken();
      const headers = {
        ...config?.headers,
        'X-CSRF-Token': csrfToken
      };

      return await this.client.post(endpoint, data, { ...config, headers });
    } catch (tokenError: any) {
      // If token fetch fails, try refreshing it once
      apiLogger.warn('CSRF token error, refreshing token', { error: tokenError.message });
      this.csrfToken = null;

      const csrfToken = await this.getCsrfToken();
      const headers = {
        ...config?.headers,
        'X-CSRF-Token': csrfToken
      };

      return await this.client.post(endpoint, data, { ...config, headers });
    }
  }

  async put(endpoint: string, data: any, config?: any) {
    apiLogger.debug('PUT request initiated', {
      endpoint,
      dataSize: JSON.stringify(data).length
    });

    // Get CSRF token and add to headers
    const csrfToken = await this.getCsrfToken();
    const headers = {
      ...config?.headers,
      'X-CSRF-Token': csrfToken
    };

    return this.client.put(endpoint, data, { ...config, headers });
  }

  async patch(endpoint: string, data: any, config?: any) {
    apiLogger.debug('PATCH request initiated', {
      endpoint,
      dataSize: JSON.stringify(data).length
    });

    // Get CSRF token and add to headers
    const csrfToken = await this.getCsrfToken();
    const headers = {
      ...config?.headers,
      'X-CSRF-Token': csrfToken
    };

    return this.client.patch(endpoint, data, { ...config, headers });
  }

  async delete(endpoint: string, config?: any) {
    apiLogger.debug('DELETE request initiated', { endpoint });

    // Get CSRF token and add to headers
    const csrfToken = await this.getCsrfToken();
    const headers = {
      ...config?.headers,
      'X-CSRF-Token': csrfToken
    };

    return this.client.delete(endpoint, { ...config, headers });
  }
}

export const windchillAPI = new WindchillAPIService();
