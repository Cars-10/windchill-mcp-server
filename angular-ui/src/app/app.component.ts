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
    this.loadFilterPreferences();
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

      // Apply saved filter preferences after tools are loaded
      setTimeout(() => {
        this.filterTools();
      }, 100);
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

      console.log('Modal opened successfully:', {
        selectedTool: this.selectedTool?.name,
        showExecutionModal: this.showExecutionModal,
        parametersCount: this.cachedToolParameters?.length || 0,
        toolParams: this.cachedToolParameters?.map(p => ({ name: p.name, type: p.type, required: this.isRequired(tool, p.name) })) || []
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

    console.log('executeTool called', {
      selectedTool: this.selectedTool?.name,
      executing: this.executing,
      parameters: this.parameters
    });

    if (!this.selectedTool || this.executing) {
      console.log('Early return: no selected tool or already executing');
      return;
    }

    // Check if at least one parameter is provided (for document agent tools)
    const allParams = this.cachedToolParameters || [];
    const currentParams = this.parameters || {};

    const providedParams = allParams.filter(param =>
      currentParams[param.name] !== undefined &&
      currentParams[param.name] !== null &&
      (typeof currentParams[param.name] !== 'string' || currentParams[param.name].trim() !== '')
    );

    console.log('Parameter analysis:', {
      totalParams: allParams.length,
      providedParams: providedParams.length,
      providedParamNames: providedParams.map(p => p.name),
      parameters: currentParams,
      cachedToolParametersExists: !!this.cachedToolParameters,
      parametersExists: !!this.parameters
    });

    // For document agent tools, allow execution if at least one parameter is provided
    if (this.selectedTool?.agent === 'document' && providedParams.length === 0) {
      console.log('Document agent: No parameters provided');
      this.executionResult = {
        success: false,
        error: 'Please provide at least one search parameter (number, name, or type)'
      };
      return;
    }

    // Validate required parameters for non-document agents
    if (this.selectedTool?.agent !== 'document') {
      const requiredParams = this.selectedTool.inputSchema?.required || [];
      const missingParams = requiredParams.filter(param =>
        !this.parameters[param] ||
        (typeof this.parameters[param] === 'string' && this.parameters[param].trim() === '')
      );

      if (missingParams.length > 0) {
        console.log('Missing required parameters:', missingParams);
        this.executionResult = {
          success: false,
          error: `Missing required parameters: ${missingParams.join(', ')}`
        };
        return;
      }
    }

    console.log('Starting tool execution...', {
      toolName: this.selectedTool?.name,
      agent: this.selectedTool?.agent,
      providedParams: providedParams.map(p => ({ name: p.name, value: currentParams[p.name] }))
    });

    // Process parameters (parse JSON for arrays and objects)
    const processedParams = { ...currentParams };
    const toolParams = this.cachedToolParameters || [];

    console.log('=== PARAMETER PROCESSING DEBUG ===');
    console.log('Original Parameters (from form):', currentParams);
    console.log('Tool Parameter Schema:', toolParams.map(p => ({
      name: p.name,
      type: p.type,
      description: p.description
    })));

    console.log('Parameter Processing Steps:');
    for (const param of toolParams) {
      const originalValue = currentParams[param.name];
      console.log(`Processing ${param.name} (${param.type}):`, {
        originalValue: originalValue,
        originalType: typeof originalValue,
        willProcess: originalValue && typeof originalValue === 'string' && (param.type === 'array' || param.type === 'object' || param.type === 'number')
      });
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
      console.log('=== DETAILED TOOL EXECUTION DEBUG ===');
      console.log('Tool Name:', this.selectedTool.name);
      console.log('Tool Agent:', this.selectedTool.agent);
      console.log('Tool Description:', this.selectedTool.description);

      console.log('Processed Parameters (before sending):');
      Object.entries(processedParams).forEach(([key, value]) => {
        console.log(`  ${key}:`, {
          value: value,
          type: typeof value,
          isEmpty: !value || (typeof value === 'string' && value.trim() === ''),
          length: typeof value === 'string' ? value.length : 'N/A'
        });
      });

      console.log('Parameter Summary:', {
        totalParameters: Object.keys(processedParams).length,
        parameterNames: Object.keys(processedParams),
        parameterTypes: Object.entries(processedParams).map(([k, v]) => ({ [k]: typeof v })),
        nonEmptyParams: Object.entries(processedParams).filter(([k, v]) =>
          v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '')
        ).length
      });

      console.log('Calling MCP service executeTool with:', {
        toolName: this.selectedTool.name,
        processedParams: processedParams,
        paramCount: Object.keys(processedParams).length,
        url: '/api',
        method: 'POST',
        contentType: 'application/json'
      });

      const result = await this.mcpService.executeTool(this.selectedTool.name, processedParams);

      console.log('=== TOOL EXECUTION SUCCESSFUL ===');
      console.log('Tool:', this.selectedTool?.name);
      console.log('Result Type:', typeof result);

      if (result !== undefined && result !== null) {
        const resultJson = JSON.stringify(result);
        console.log('Result Size (bytes):', resultJson.length);
        console.log('Result Preview:', resultJson.substring(0, 500) + (resultJson.length > 500 ? '...' : ''));
        console.log('Result Keys:', typeof result === 'object' ? Object.keys(result || {}) : 'Not an object');
      } else {
        console.log('Result is undefined or null');
      }

      clearTimeout(executionTimeout);
      this.executionResult = { success: true, data: result };
    } catch (error: any) {
      console.error('=== TOOL EXECUTION FAILED ===');
      console.error('Tool:', this.selectedTool?.name);
      console.error('Error Message:', error?.message);
      console.error('Error Status:', error?.status);
      console.error('Error Status Text:', error?.statusText);
      console.error('Error Stack:', error?.stack);
      console.error('Error Details:', {
        name: error?.name,
        message: error?.message,
        status: error?.status,
        statusText: error?.statusText,
        url: error?.url,
        data: error?.data || error?.error,
        headers: error?.headers
      });

      clearTimeout(executionTimeout);
      this.executionResult = {
        success: false,
        error: error?.message || 'Unknown error occurred'
      };
    } finally {
      console.log('Tool execution completed:', {
        toolName: this.selectedTool?.name,
        success: this.executionResult?.success,
        hasResult: !!this.executionResult
      });
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
    if (this.selectedTool === tool && this.cachedToolParameters?.length > 0) {
      return this.cachedToolParameters || [];
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

  /**
   * Get count of required parameters for current tool
   */
  getRequiredParameterCount(): number {
    if (!this.selectedTool?.inputSchema?.required) return 0;
    return this.selectedTool.inputSchema.required.length;
  }

  /**
   * Get count of optional parameters for current tool
   */
  getOptionalParameterCount(): number {
    const totalParams = this.cachedToolParameters?.length || 0;
    const requiredParams = this.getRequiredParameterCount();
    return Math.max(0, totalParams - requiredParams);
  }

  async refreshTools() {
    await this.loadTools();
  }

  /**
   * Clear all filter preferences and reset to defaults
   */
  clearAllFilters() {
    this.selectedAgent = '';
    this.selectedCategory = '';
    this.searchTerm = '';
    this.showSchemas = false;

    this.filterTools();
    this.clearFilterPreferences();

    console.log('All filters cleared and preferences removed');
  }

  /**
   * Check if any filters are currently active
   */
  hasActiveFilters(): boolean {
    return !!(this.selectedAgent || this.selectedCategory || this.searchTerm || this.showSchemas);
  }

  onSearchInput() {
    // Debounce search input to avoid excessive filtering
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.filterTools();
      this.saveFilterPreferences();
    }, 300);
  }

  onFilterChange() {
    this.filterTools();
    this.saveFilterPreferences();
  }

  /**
   * Save current filter preferences to localStorage
   */
  private saveFilterPreferences() {
    try {
      const preferences = {
        selectedAgent: this.selectedAgent,
        selectedCategory: this.selectedCategory,
        showSchemas: this.showSchemas,
        searchTerm: this.searchTerm,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem('windchill-mcp-filter-preferences', JSON.stringify(preferences));
      console.log('Filter preferences saved:', preferences);
    } catch (error) {
      console.warn('Failed to save filter preferences:', error);
    }
  }

  /**
   * Load filter preferences from localStorage
   */
  private loadFilterPreferences() {
    try {
      const saved = localStorage.getItem('windchill-mcp-filter-preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        console.log('Loading filter preferences:', preferences);

        // Only restore if preferences are not too old (24 hours)
        const saveTime = new Date(preferences.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - saveTime.getTime()) / (1000 * 60 * 60);

        if (hoursDiff < 24) {
          this.selectedAgent = preferences.selectedAgent || '';
          this.selectedCategory = preferences.selectedCategory || '';
          this.showSchemas = preferences.showSchemas || false;
          this.searchTerm = preferences.searchTerm || '';
        } else {
          console.log('Filter preferences expired, using defaults');
          this.clearFilterPreferences();
        }
      }
    } catch (error) {
      console.warn('Failed to load filter preferences:', error);
      this.clearFilterPreferences();
    }
  }

  /**
   * Clear filter preferences from localStorage
   */
  private clearFilterPreferences() {
    try {
      localStorage.removeItem('windchill-mcp-filter-preferences');
      console.log('Filter preferences cleared');
    } catch (error) {
      console.warn('Failed to clear filter preferences:', error);
    }
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