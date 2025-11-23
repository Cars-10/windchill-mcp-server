import axios from "axios";
import { getWindchillConfig } from "../config/windchill.js";
import { serverManager, WindchillServerConfig } from "../config/windchill-servers.js";
import { apiLogger, logger } from "../config/logger.js";
import { WindchillAPIError, WindchillError } from "../types/common.js";

export class WindchillAPIService {
  private client: any;
  private currentConfig: ReturnType<typeof getWindchillConfig>;
  private csrfToken: string | null = null;
  private sessionCookies: string[] = [];
  private sessionEstablished: boolean = false;
  // OAuth 2.0 tokens
  private oauthAccessToken: string | null = null;
  private oauthRefreshToken: string | null = null;
  private oauthTokenExpiry: number | null = null;

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

    // Clear all authentication state (each server has its own auth state)
    this.csrfToken = null;
    this.sessionCookies = [];
    this.sessionEstablished = false;
    this.oauthAccessToken = null;
    this.oauthRefreshToken = null;
    this.oauthTokenExpiry = null;

    // Recreate client with new configuration
    this.createClient();

    // Re-setup interceptors for new client
    this.setupInterceptors();

    logger.info('WindchillAPIService configuration updated successfully', {
      serverId: newServer.id,
      serverName: newServer.name,
      baseURL: newServer.baseURL,
      authMethod: newServer.authMethod
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

        const serverConfig = serverManager.getActiveServer();

        apiLogger.debug('API Request initiated', {
          requestId,
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          authMethod: serverConfig.authMethod
        });

        // Construct and log the complete URL
        const completeUrl = `${config.baseURL}${config.url}`;
        apiLogger.debug('Complete URL', {
          requestId,
          completeUrl
        });

        // Apply authentication based on auth method
        if (serverConfig.authMethod === 'oauth') {
          // OAuth 2.0 - use Bearer token
          const accessToken = await this.getOAuthToken();
          config.headers["Authorization"] = `Bearer ${accessToken}`;
          apiLogger.debug('OAuth Bearer token attached', { requestId });

        } else {
          // Basic or Session auth - use Basic Authentication
          if (!serverConfig.username || !serverConfig.password) {
            throw new Error('Username and password required for Basic/Session auth');
          }

          const auth = Buffer.from(
            `${serverConfig.username}:${serverConfig.password}`
          ).toString("base64");
          config.headers["Authorization"] = `Basic ${auth}`;

          // Add session cookies if we have them (for session auth)
          if (this.sessionCookies.length > 0) {
            config.headers["Cookie"] = this.sessionCookies.join('; ');
            apiLogger.debug('Session cookies attached', {
              requestId,
              cookieCount: this.sessionCookies.length
            });
          }
        }

        // Log all headers being sent (excluding auth and cookies for security)
        const headersToLog = { ...config.headers };
        delete headersToLog.Authorization;
        delete headersToLog.Cookie;
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

        // Capture session cookies from Set-Cookie headers
        const setCookieHeaders = response.headers['set-cookie'];
        if (setCookieHeaders) {
          const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

          // Extract cookie names and values (ignore attributes like Path, HttpOnly, etc.)
          cookieArray.forEach((cookieStr: string) => {
            const cookieParts = cookieStr.split(';')[0]; // Get just "name=value"
            const cookieName = cookieParts.split('=')[0];

            // Update or add this cookie
            const existingIndex = this.sessionCookies.findIndex(c => c.startsWith(cookieName + '='));
            if (existingIndex >= 0) {
              this.sessionCookies[existingIndex] = cookieParts;
            } else {
              this.sessionCookies.push(cookieParts);
            }
          });

          apiLogger.debug('Session cookies updated', {
            requestId,
            cookieCount: this.sessionCookies.length,
            newCookies: cookieArray.length
          });
        }

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
   * Fetch OAuth 2.0 access token using client credentials grant
   */
  private async fetchOAuthToken(): Promise<void> {
    const serverConfig = serverManager.getActiveServer();

    if (serverConfig.authMethod !== 'oauth') {
      throw new Error('OAuth token fetch called but auth method is not oauth');
    }

    if (!serverConfig.oauthClientId || !serverConfig.oauthClientSecret) {
      throw new Error('OAuth client credentials not configured');
    }

    try {
      apiLogger.info('Fetching OAuth 2.0 access token', {
        tokenUrl: serverConfig.oauthTokenUrl,
        serverId: serverConfig.id
      });

      const tokenUrl = serverConfig.oauthTokenUrl || `${serverConfig.baseURL}/oauth2/token`;

      // OAuth 2.0 Client Credentials Grant
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', serverConfig.oauthClientId);
      params.append('client_secret', serverConfig.oauthClientSecret);
      params.append('scope', 'odata'); // Windchill OData scope

      // Use a separate axios instance for OAuth token requests (not the configured client)
      const tokenResponse = await (axios as any).default.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.oauthAccessToken = tokenResponse.data.access_token;
      this.oauthRefreshToken = tokenResponse.data.refresh_token || null;

      // Calculate expiry time (current time + expires_in seconds - 60 second buffer)
      const expiresIn = tokenResponse.data.expires_in || 3600;
      this.oauthTokenExpiry = Date.now() + ((expiresIn - 60) * 1000);

      apiLogger.info('OAuth 2.0 access token obtained successfully', {
        expiresIn,
        hasRefreshToken: !!this.oauthRefreshToken,
        tokenType: tokenResponse.data.token_type
      });

    } catch (error: any) {
      apiLogger.error('Failed to fetch OAuth 2.0 token', {
        error: error.message,
        statusCode: error.response?.status,
        responseData: error.response?.data
      });
      throw new WindchillAPIError(
        'Failed to obtain OAuth 2.0 access token: ' + error.message,
        error.response?.status,
        error.response?.data
      );
    }
  }

  /**
   * Get valid OAuth access token, fetching new one if needed
   */
  private async getOAuthToken(): Promise<string> {
    // Check if token exists and is not expired
    if (this.oauthAccessToken && this.oauthTokenExpiry && Date.now() < this.oauthTokenExpiry) {
      return this.oauthAccessToken;
    }

    // Token is missing or expired, fetch new one
    apiLogger.info('OAuth token expired or missing, fetching new token');
    await this.fetchOAuthToken();

    return this.oauthAccessToken!;
  }

  /**
   * Establish a session with Windchill to enable CSRF token support
   * This must be called before making requests to action endpoints
   */
  private async establishSession(): Promise<void> {
    if (this.sessionEstablished) {
      apiLogger.debug('Session already established, skipping');
      return;
    }

    try {
      apiLogger.info('Establishing session with Windchill', {
        baseURL: this.currentConfig.baseURL
      });

      // Make a simple GET request to the OData root to establish session
      // This will return Set-Cookie headers which we'll capture
      const response = await this.client.get('/');

      // Check if we received cookies
      if (this.sessionCookies.length > 0) {
        this.sessionEstablished = true;
        apiLogger.info('Session established successfully', {
          cookieCount: this.sessionCookies.length,
          sessionCookies: this.sessionCookies.map(c => c.split('=')[0]) // Log cookie names only
        });
      } else {
        apiLogger.warn('No session cookies received from Windchill', {
          status: response.status,
          headers: Object.keys(response.headers)
        });
        // Continue anyway - some Windchill configurations might not use cookies
        this.sessionEstablished = true;
      }
    } catch (error: any) {
      apiLogger.error('Failed to establish session', {
        error: error.message,
        statusCode: error.statusCode
      });
      throw new WindchillAPIError(
        'Failed to establish Windchill session: ' + error.message,
        error.statusCode,
        error.response?.data
      );
    }
  }

  /**
   * Fetch CSRF token (nonce) from Windchill using PTC GetCSRFToken endpoint
   * Required for POST/PUT/DELETE operations (actions)
   */
  private async fetchCsrfToken(): Promise<string> {
    try {
      // Establish session first to get cookies
      await this.establishSession();

      apiLogger.info('Fetching CSRF token from PTC GetCSRFToken endpoint', {
        baseURL: this.client.defaults.baseURL,
        serverId: serverManager.getActiveServerId(),
        hasCookies: this.sessionCookies.length > 0
      });

      // PTC Windchill specific CSRF token endpoint
      // GET /Windchill/servlet/odata/PTC/GetCSRFToken()
      const response = await this.client.get('/PTC/GetCSRFToken()');

      apiLogger.info('CSRF token response received', {
        status: response.status,
        statusText: response.statusText,
        dataKeys: Object.keys(response.data || {})
      });

      // PTC returns CSRF token in response body with NonceValue property
      if (response.data && response.data.NonceValue) {
        const token: string = response.data.NonceValue;
        this.csrfToken = token;

        apiLogger.info('CSRF token successfully retrieved from PTC endpoint', {
          nonceKey: response.data.NonceKey || 'unknown',
          tokenLength: token.length,
          tokenPreview: token.substring(0, 20) + '...'
        });

        return token;
      }

      // Fallback: If PTC endpoint doesn't work, Windchill might not require CSRF
      apiLogger.warn('No CSRF token in PTC response - Windchill may not require CSRF protection', {
        responseData: response.data
      });
      this.csrfToken = 'NO_CSRF_REQUIRED';
      return this.csrfToken;

    } catch (error: any) {
      apiLogger.error('Failed to fetch CSRF token from PTC endpoint', {
        error: error.message,
        statusCode: error.statusCode,
        responseData: error.response?.data
      });
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

  /**
   * Refresh session and CSRF token when they expire
   */
  private async refreshSession(): Promise<void> {
    apiLogger.info('Refreshing Windchill session and CSRF token');

    // Clear existing session state
    this.sessionCookies = [];
    this.csrfToken = null;
    this.sessionEstablished = false;

    // Re-establish session and get new CSRF token
    await this.fetchCsrfToken();

    apiLogger.info('Session refreshed successfully', {
      cookieCount: this.sessionCookies.length,
      hasToken: !!this.csrfToken
    });
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
    apiLogger.info('POST request initiated', {
      endpoint,
      dataSize: JSON.stringify(data).length,
      hasConfig: !!config,
      skipCsrf: config?.skipCsrf
    });

    // Skip CSRF token if explicitly requested (for endpoints that don't need it)
    if (config?.skipCsrf) {
      apiLogger.info('Skipping CSRF token for this request', { endpoint });
      return await this.client.post(endpoint, data, config);
    }

    // Get CSRF token and add to headers (PTC uses CSRF_NONCE header)
    try {
      const csrfToken = await this.getCsrfToken();
      const headers = {
        ...config?.headers,
        'CSRF_NONCE': csrfToken  // PTC Windchill specific header
      };

      apiLogger.info('POST request with CSRF_NONCE token', {
        endpoint,
        hasToken: !!csrfToken,
        tokenPreview: csrfToken?.substring(0, 20) + '...'
      });

      return await this.client.post(endpoint, data, { ...config, headers });
    } catch (tokenError: any) {
      // If we get INVALID_NONCE error, refresh the entire session
      const isInvalidNonce = tokenError.response?.data?.error?.code === 'INVALID_NONCE';

      if (isInvalidNonce) {
        apiLogger.warn('CSRF token error (INVALID_NONCE), refreshing session', {
          error: tokenError.message,
          statusCode: tokenError.statusCode,
          endpoint
        });

        try {
          // Refresh entire session (cookies + CSRF token)
          await this.refreshSession();

          const csrfToken = this.csrfToken!;
          const headers = {
            ...config?.headers,
            'CSRF_NONCE': csrfToken  // PTC Windchill specific header
          };

          apiLogger.info('Retrying POST with refreshed session and CSRF_NONCE token', { endpoint });
          return await this.client.post(endpoint, data, { ...config, headers });
        } catch (retryError: any) {
          apiLogger.error('POST request failed after session refresh', {
            endpoint,
            error: retryError.message,
            statusCode: retryError.statusCode,
            responseData: retryError.response?.data
          });
          throw retryError;
        }
      } else {
        // For other errors, just rethrow
        apiLogger.error('POST request failed (non-CSRF error)', {
          endpoint,
          error: tokenError.message,
          statusCode: tokenError.statusCode,
          responseData: tokenError.response?.data
        });
        throw tokenError;
      }
    }
  }

  async put(endpoint: string, data: any, config?: any) {
    apiLogger.debug('PUT request initiated', {
      endpoint,
      dataSize: JSON.stringify(data).length
    });

    // Get CSRF token and add to headers (PTC uses CSRF_NONCE header)
    const csrfToken = await this.getCsrfToken();
    const headers = {
      ...config?.headers,
      'CSRF_NONCE': csrfToken  // PTC Windchill specific header
    };

    return this.client.put(endpoint, data, { ...config, headers });
  }

  async patch(endpoint: string, data: any, config?: any) {
    apiLogger.debug('PATCH request initiated', {
      endpoint,
      dataSize: JSON.stringify(data).length
    });

    // Get CSRF token and add to headers (PTC uses CSRF_NONCE header)
    const csrfToken = await this.getCsrfToken();
    const headers = {
      ...config?.headers,
      'CSRF_NONCE': csrfToken  // PTC Windchill specific header
    };

    return this.client.patch(endpoint, data, { ...config, headers });
  }

  async delete(endpoint: string, config?: any) {
    apiLogger.debug('DELETE request initiated', { endpoint });

    // Get CSRF token and add to headers (PTC uses CSRF_NONCE header)
    const csrfToken = await this.getCsrfToken();
    const headers = {
      ...config?.headers,
      'CSRF_NONCE': csrfToken  // PTC Windchill specific header
    };

    return this.client.delete(endpoint, { ...config, headers });
  }
}

export const windchillAPI = new WindchillAPIService();
