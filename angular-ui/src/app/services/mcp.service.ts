import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface McpRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: any;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface ToolsListResponse {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: any;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class McpService {
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  /**
   * Get the list of available tools using MCP JSON-RPC 2.0 protocol
   */
  async getToolsList(): Promise<ToolsListResponse> {
    const request: McpRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method: 'tools/list',
      params: {}
    };

    try {
      const response = await Promise.race([
        firstValueFrom(
          this.http.post<McpResponse>(this.baseUrl, request, {
            headers: new HttpHeaders({
              'Content-Type': 'application/json'
            })
          })
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        )
      ]) as McpResponse;

      console.log('MCP protocol response:', response);

      if (response.error) {
        throw new Error(`MCP Error ${response.error.code}: ${response.error.message}`);
      }

      if (!response.result) {
        console.warn('MCP response.result is undefined, falling back to direct HTTP');
        throw new Error('Invalid MCP response: result is undefined');
      }

      return response.result;
    } catch (error: any) {
      // Fallback to direct HTTP request if MCP protocol fails
      console.warn('MCP protocol failed, falling back to direct HTTP:', error.message);
      return this.getToolsListDirect();
    }
  }

  /**
   * Fallback method to get tools list via direct HTTP request
   */
  private async getToolsListDirect(): Promise<ToolsListResponse> {
    try {
      console.log('Attempting direct HTTP GET to /api/tools');
      const response = await Promise.race([
        firstValueFrom(
          this.http.get<ToolsListResponse>(`${this.baseUrl}/tools`)
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Direct request timeout')), 5000)
        )
      ]) as ToolsListResponse;

      console.log('Direct HTTP response:', response);

      if (!response || !response.tools) {
        throw new Error('Invalid response format from server');
      }

      return response;
    } catch (error: any) {
      console.error('Direct HTTP request failed:', error);
      throw new Error(`Failed to load tools: ${error?.message || 'Server unreachable'}`);
    }
  }

  /**
   * Execute a tool using MCP JSON-RPC 2.0 protocol
   */
  async executeTool(toolName: string, parameters: any): Promise<any> {
    console.log('=== MCP Service executeTool START ===');
    console.log('Tool:', toolName);
    console.log('Parameters:', parameters);
    console.log('Parameter types:', Object.entries(parameters).map(([k, v]) => ({ [k]: typeof v })));

    const request: McpRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parameters
      }
    };

    console.log('MCP JSON-RPC request:', {
      url: this.baseUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: request
    });

    try {
      const response = await Promise.race([
        firstValueFrom(
          this.http.post<McpResponse>(this.baseUrl, request, {
            headers: new HttpHeaders({
              'Content-Type': 'application/json'
            })
          })
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tool execution timeout')), 15000)
        )
      ]) as McpResponse;

      console.log('=== RAW MCP RESPONSE DEBUG ===');
      console.log('Full response object:', response);
      console.log('Response keys:', Object.keys(response || {}));
      console.log('Response.jsonrpc:', (response as any)?.jsonrpc);
      console.log('Response.id:', response?.id);
      console.log('Response.result:', response?.result);
      console.log('Response.error:', response?.error);

      console.log('MCP response received:', {
        id: response.id,
        hasResult: !!response.result,
        hasError: !!response.error,
        resultType: typeof response.result
      });

      if (response.error) {
        console.error('MCP error response:', response.error);
        throw new Error(`MCP Error ${response.error.code}: ${response.error.message}`);
      }

      // Unwrap MCP JSON-RPC response content
      if (response.result?.content && Array.isArray(response.result.content) && response.result.content.length > 0) {
        const content = response.result.content[0];
        if (content.type === 'text' && content.text) {
          try {
            // Parse the JSON string in the text field to get the actual result
            const actualResult = JSON.parse(content.text);
            console.log('=== MCP Service executeTool SUCCESS ===');
            console.log('Unwrapped result type:', typeof actualResult);
            return actualResult;
          } catch (parseError) {
            // If not valid JSON, return the text as-is
            console.log('=== MCP Service executeTool SUCCESS (text response) ===');
            return content.text;
          }
        }
      }

      console.log('=== MCP Service executeTool SUCCESS ===');
      return response.result;
    } catch (error: any) {
      console.log('=== MCP protocol failed, trying direct HTTP ===');
      console.log('Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        url: error.url
      });

      // Fallback to direct HTTP request if MCP protocol fails
      return this.executeToolDirect(toolName, parameters);
    }
  }

  /**
   * Fallback method to execute tool via direct HTTP request
   */
  private async executeToolDirect(toolName: string, parameters: any): Promise<any> {
    try {
      console.log('=== Direct HTTP fallback execution ===');
      console.log('Tool:', toolName);
      console.log('Parameters:', parameters);
      console.log('Direct HTTP URL:', `${this.baseUrl}/tools/${toolName}`);

      const response = await Promise.race([
        firstValueFrom(
          this.http.post<any>(`${this.baseUrl}/tools/${toolName}`, parameters, {
            headers: new HttpHeaders({
              'Content-Type': 'application/json'
            })
          })
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tool execution timeout')), 15000)
        )
      ]) as any;

      console.log('=== Direct HTTP response received ===');
      console.log('Response status:', response?.status);
      console.log('Response data type:', typeof response);
      console.log('Response data:', response);

      return response;
    } catch (error: any) {
      console.error('=== Direct HTTP execution failed ===');
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        url: error.url,
        data: error.data || error.error
      });

      if (error?.status === 404) {
        throw new Error(`Tool '${toolName}' not found on server`);
      }
      if (error?.status === 500) {
        throw new Error(`Server error executing tool: ${error?.error?.message || error?.message}`);
      }
      throw new Error(`Failed to execute tool: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate a unique request ID for JSON-RPC
   */
  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get server health status
   */
  async getServerHealth(): Promise<any> {
    return firstValueFrom(
      this.http.get(`${this.baseUrl}/health`)
    );
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<any> {
    return firstValueFrom(
      this.http.get(`${this.baseUrl}/info`)
    );
  }

  /**
   * Get list of all available Windchill servers
   */
  async getAvailableServers(): Promise<any> {
    return firstValueFrom(
      this.http.get(`${this.baseUrl}/servers`)
    );
  }

  /**
   * Get currently active Windchill server
   */
  async getCurrentWindchillServer(): Promise<any> {
    return firstValueFrom(
      this.http.get(`${this.baseUrl}/servers/current`)
    );
  }

  /**
   * Switch to a different Windchill server
   */
  async switchWindchillServer(serverId: number): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/servers/switch`, { serverId })
    );
  }
}