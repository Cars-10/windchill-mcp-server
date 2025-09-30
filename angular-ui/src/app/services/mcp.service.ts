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

      if (response.error) {
        throw new Error(`MCP Error ${response.error.code}: ${response.error.message}`);
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
      const response = await Promise.race([
        firstValueFrom(
          this.http.get<ToolsListResponse>(`${this.baseUrl}/tools`)
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Direct request timeout')), 5000)
        )
      ]) as ToolsListResponse;

      return response;
    } catch (error: any) {
      throw new Error(`Failed to load tools: ${error?.message || 'Server unreachable'}`);
    }
  }

  /**
   * Execute a tool using MCP JSON-RPC 2.0 protocol
   */
  async executeTool(toolName: string, parameters: any): Promise<any> {
    const request: McpRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parameters
      }
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
          setTimeout(() => reject(new Error('Tool execution timeout')), 15000)
        )
      ]) as McpResponse;

      if (response.error) {
        throw new Error(`MCP Error ${response.error.code}: ${response.error.message}`);
      }

      return response.result;
    } catch (error: any) {
      // Fallback to direct HTTP request if MCP protocol fails
      console.warn('MCP protocol failed, falling back to direct HTTP:', error.message);
      return this.executeToolDirect(toolName, parameters);
    }
  }

  /**
   * Fallback method to execute tool via direct HTTP request
   */
  private async executeToolDirect(toolName: string, parameters: any): Promise<any> {
    try {
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

      return response;
    } catch (error: any) {
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
      this.http.get(`${this.baseUrl}/`)
    );
  }
}