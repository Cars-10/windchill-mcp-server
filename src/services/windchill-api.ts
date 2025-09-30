import axios from "axios";
import { windchillConfig } from "../config/windchill.js";
import { apiLogger, logger } from "../config/logger.js";

export class WindchillAPIService {
  private client: any;

  constructor() {
    logger.info('Initializing WindchillAPIService', {
      baseURL: windchillConfig.baseURL,
      timeout: windchillConfig.timeout,
      username: windchillConfig.username
    });

    this.client = (axios as any).create({
      baseURL: windchillConfig.baseURL + windchillConfig.apiPath,
      timeout: windchillConfig.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
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
          `${windchillConfig.username}:${windchillConfig.password}`
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
