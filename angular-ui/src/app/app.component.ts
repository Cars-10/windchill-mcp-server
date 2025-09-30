import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Tool } from './models/tool.model';
import { McpService } from './services/mcp.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  tools: Tool[] = [];
  filteredTools: Tool[] = [];
  agents: string[] = [];
  searchTerm = '';
  selectedAgent = '';
  selectedCategory = '';
  showSchemas = false;
  loading = false;
  serverStatus = 'disconnected';

  selectedTool: Tool | null = null;
  showExecutionModal = false;
  parameters: { [key: string]: any } = {};
  executing = false;
  executionResult: { success: boolean; data?: any; error?: string } | null = null;
  searchTimeout?: any;

  // Cache for tool parameters to prevent repeated computation
  cachedToolParameters: any[] = [];

  constructor(private mcpService: McpService) {}

  ngOnInit() {
    this.loadTools();
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  async loadTools() {
    console.log('loadTools starting...');
    this.loading = true;
    this.serverStatus = 'disconnected';

    try {
      const response = await this.mcpService.getToolsList();
      console.log('Tools response received:', response);

      if (!response || !Array.isArray(response.tools)) {
        throw new Error('Invalid tools response format');
      }

      this.tools = response.tools.map((tool: any) => ({
        ...tool,
        agent: tool.name?.split('_')[0] || 'unknown',
        category: this.getToolCategory(tool.name || '')
      }));

      console.log(`Loaded ${this.tools.length} tools`);

      this.agents = [...new Set(this.tools.map(t => t.agent))];
      this.filteredTools = [...this.tools];
      this.serverStatus = 'connected';

      console.log('Available agents:', this.agents);
    } catch (error: any) {
      console.error('Failed to load tools:', error);
      this.serverStatus = 'disconnected';
      this.tools = [];
      this.filteredTools = [];
      this.agents = [];

      // Show user-friendly error message
      alert(`Failed to load tools: ${error?.message || 'Server connection failed'}\n\nPlease check that the MCP server is running.`);
    } finally {
      this.loading = false;
      console.log('loadTools completed. Loading:', this.loading);
    }
  }

  filterTools() {
    if (!this.tools.length) {
      this.filteredTools = [];
      return;
    }

    // Cache normalized search terms for performance
    const normalizedSearchTerm = this.searchTerm.toLowerCase().trim();

    this.filteredTools = this.tools.filter(tool => {
      // Skip expensive string operations if no search term
      let matchesSearch = true;
      if (normalizedSearchTerm) {
        matchesSearch =
          tool.name.toLowerCase().includes(normalizedSearchTerm) ||
          tool.description.toLowerCase().includes(normalizedSearchTerm);
      }

      const matchesAgent = !this.selectedAgent || tool.agent === this.selectedAgent;
      const matchesCategory = !this.selectedCategory || tool.category === this.selectedCategory;

      return matchesSearch && matchesAgent && matchesCategory;
    });
  }

  selectTool(tool: Tool) {
    console.log('selectTool called with:', tool?.name);
    try {
      this.selectedTool = tool;
      this.parameters = {};
      this.executionResult = null;
      this.executing = false;

      // Cache the tool parameters once when selecting a tool
      this.cachedToolParameters = this.computeToolParameters(tool);

      this.showExecutionModal = true;

      console.log('Modal state set:', {
        selectedTool: this.selectedTool?.name,
        showExecutionModal: this.showExecutionModal,
        parametersCount: this.cachedToolParameters.length
      });

    } catch (error) {
      console.error('Error in selectTool:', error);
    }
  }

  closeExecutionModal() {
    this.showExecutionModal = false;
    this.selectedTool = null;
    this.parameters = {};
    this.executionResult = null;
    this.cachedToolParameters = [];
  }

  async executeTool(event?: Event) {
    if (event) {
      event.preventDefault();
    }

    if (!this.selectedTool || this.executing) return;

    // Validate required parameters
    const requiredParams = this.selectedTool.inputSchema?.required || [];
    const missingParams = requiredParams.filter(param =>
      !this.parameters[param] ||
      (typeof this.parameters[param] === 'string' && this.parameters[param].trim() === '')
    );

    if (missingParams.length > 0) {
      this.executionResult = {
        success: false,
        error: `Missing required parameters: ${missingParams.join(', ')}`
      };
      return;
    }

    // Process parameters (parse JSON for arrays and objects)
    const processedParams = { ...this.parameters };
    const toolParams = this.cachedToolParameters;

    for (const param of toolParams) {
      const value = processedParams[param.name];
      if (value && typeof value === 'string') {
        if (param.type === 'array' || param.type === 'object') {
          try {
            processedParams[param.name] = JSON.parse(value);
          } catch (error) {
            this.executionResult = {
              success: false,
              error: `Invalid JSON in parameter '${param.name}': ${error}`
            };
            return;
          }
        } else if (param.type === 'number') {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            processedParams[param.name] = num;
          }
        }
      }
    }

    this.executing = true;
    this.executionResult = null;

    // Create a timeout to prevent hanging
    const executionTimeout = setTimeout(() => {
      if (this.executing) {
        this.executing = false;
        this.executionResult = {
          success: false,
          error: 'Request timed out after 30 seconds'
        };
      }
    }, 30000);

    try {
      const result = await this.mcpService.executeTool(this.selectedTool.name, processedParams);
      clearTimeout(executionTimeout);
      this.executionResult = { success: true, data: result };
    } catch (error: any) {
      clearTimeout(executionTimeout);
      this.executionResult = {
        success: false,
        error: error?.message || 'Unknown error occurred'
      };
    } finally {
      this.executing = false;
    }
  }


  getToolCategory(toolName: string): string {
    if (toolName.includes('create') || toolName.includes('update') || toolName.includes('checkout') ||
        toolName.includes('checkin') || toolName.includes('revise')) {
      return 'lifecycle';
    }
    if (toolName.includes('version') || toolName.includes('iteration')) {
      return 'version';
    }
    if (toolName.includes('content') || toolName.includes('attachment') || toolName.includes('upload') || toolName.includes('download')) {
      return 'content';
    }
    if (toolName.includes('reference') || toolName.includes('relationship')) {
      return 'relationship';
    }
    if (toolName.includes('search') || toolName.includes('find')) {
      return 'search';
    }
    if (toolName.includes('bulk')) {
      return 'bulk';
    }
    return 'other';
  }

  getParameterNames(schema: any): string[] {
    if (!schema?.properties) return [];
    return Object.keys(schema.properties);
  }

  // Use cached parameters from the selected tool
  getToolParameters(tool: Tool): any[] {
    if (this.selectedTool === tool && this.cachedToolParameters.length > 0) {
      return this.cachedToolParameters;
    }
    return this.computeToolParameters(tool);
  }

  // Compute tool parameters (only called when caching)
  private computeToolParameters(tool: Tool): any[] {
    if (!tool?.inputSchema?.properties) {
      return [];
    }

    return Object.entries(tool.inputSchema.properties).map(([name, config]: [string, any]) => ({
      name,
      type: config.type,
      description: config.description || ''
    }));
  }

  isRequired(tool: Tool, paramName: string): boolean {
    return tool.inputSchema?.required?.includes(paramName) || false;
  }

  async refreshTools() {
    await this.loadTools();
  }

  onSearchInput() {
    // Debounce search input to avoid excessive filtering
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.filterTools();
    }, 300);
  }

  onFilterChange() {
    this.filterTools();
  }

  // Safe JSON display to prevent circular reference issues and performance problems
  safeJsonDisplay(data: any): string {
    try {
      // Handle null/undefined
      if (data === null) return 'null';
      if (data === undefined) return 'undefined';

      // Handle primitives
      if (typeof data !== 'object') {
        return String(data);
      }

      // Use simplified JSON stringify with timeout protection
      const startTime = Date.now();
      const stringified = JSON.stringify(data, (key, value) => {
        // Performance timeout check
        if (Date.now() - startTime > 1000) {
          throw new Error('JSON processing timeout');
        }

        // Simple circular reference check
        if (typeof value === 'object' && value !== null) {
          if (value.__visited) {
            return '[Circular Reference]';
          }
          value.__visited = true;
        }

        return value;
      }, 2);

      // Clean up visited markers
      this.cleanupVisitedMarkers(data);

      // Size limit
      const maxLength = 5000; // Reduced to 5KB
      if (stringified.length > maxLength) {
        return stringified.substring(0, maxLength) + '\n\n... [Response truncated for performance]';
      }

      return stringified;
    } catch (error: any) {
      console.warn('JSON display error:', error);
      return `[Display Error: ${error?.message || 'Cannot format response'}]\n\nRaw data type: ${typeof data}`;
    }
  }

  private cleanupVisitedMarkers(obj: any, visited = new Set()) {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;

    visited.add(obj);
    delete obj.__visited;

    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        this.cleanupVisitedMarkers(value, visited);
      }
    }
  }

}