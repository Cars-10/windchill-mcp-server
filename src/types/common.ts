/**
 * Common type definitions for Windchill MCP Server
 */

/**
 * Tool definition for MCP agents
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: ToolHandler;
}

/**
 * JSON Schema for tool input validation
 * Using flexible any type to match MCP SDK expectations
 */
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  enum?: any[];
  [key: string]: any;
}

/**
 * JSON Schema property definition
 */
export interface JSONSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: any[];
  items?: any;
  properties?: Record<string, any>;
  [key: string]: any;
}

/**
 * Tool handler function signature
 */
export type ToolHandler = (params: ToolParams) => Promise<ToolResult>;

/**
 * Generic tool parameters
 */
export interface ToolParams {
  [key: string]: string | number | boolean | object | undefined;
}

/**
 * Generic tool result
 */
export type ToolResult = WindchillResponse | BulkOperationResult | any;

/**
 * Windchill OData response structure
 */
export interface WindchillResponse {
  '@odata.context'?: string;
  '@odata.count'?: number;
  value?: WindchillObject[];
  [key: string]: any;
}

/**
 * Base Windchill object
 */
export interface WindchillObject {
  ID?: string;
  Number?: string;
  Name?: string;
  Type?: string;
  State?: string;
  Version?: string;
  CreatedBy?: string;
  CreatedOn?: string;
  ModifiedBy?: string;
  ModifiedOn?: string;
  [key: string]: any;
}

/**
 * Part-specific interface
 */
export interface WindchillPart extends WindchillObject {
  View?: string;
  Source?: string;
  DefaultUnit?: string;
}

/**
 * Document-specific interface
 */
export interface WindchillDocument extends WindchillObject {
  DocumentType?: string;
  PrimaryContent?: string;
  SecondaryContent?: string[];
}

/**
 * Change request interface
 */
export interface WindchillChange extends WindchillObject {
  Priority?: string;
  Reason?: string;
  AffectedObjects?: string[];
  ResultingObjects?: string[];
}

/**
 * Workflow task interface
 */
export interface WindchillWorkflowTask extends WindchillObject {
  Assignee?: string;
  ProcessName?: string;
  ProcessId?: string;
  DueDate?: string;
  CompletedOn?: string;
}

/**
 * Project interface
 */
export interface WindchillProject extends WindchillObject {
  Manager?: string;
  StartDate?: string;
  EndDate?: string;
  TeamMembers?: string[];
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  results: BulkOperationItem[];
  totalProcessed: number;
  successful: number;
  failed: number;
  [key: string]: any;
}

/**
 * Single item in bulk operation
 */
export interface BulkOperationItem {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Search parameters for parts
 */
export interface PartSearchParams {
  number?: string;
  name?: string;
  state?: string;
  type?: string;
  limit?: number;
}

/**
 * Search parameters for documents
 */
export interface DocumentSearchParams {
  number?: string;
  name?: string;
  type?: string;
  lifecycleState?: string;
  creator?: string;
  createdAfter?: string;
  createdBefore?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  container?: string;
  limit?: number;
}

/**
 * BOM structure parameters
 */
export interface BOMParams {
  id: string;
  levels?: number | 'max';
  expandPart?: boolean;
  selectFields?: string;
}

/**
 * File upload parameters
 */
export interface FileUploadParams {
  id: string;
  filePath: string;
  fileName: string;
  description?: string;
}

/**
 * Reference link parameters
 */
export interface ReferenceLinkParams {
  sourceId: string;
  targetId: string;
  referenceType: string;
  description?: string;
}

/**
 * Windchill error response
 */
export interface WindchillError {
  error: {
    code: string;
    message: string;
    innererror?: {
      message?: string;
      type?: string;
      stacktrace?: string;
    };
  };
}

/**
 * MCP tool error
 */
export class MCPToolError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'TOOL_ERROR',
    public readonly details?: any
  ) {
    super(message);
    this.name = 'MCPToolError';
  }
}

/**
 * Windchill API error
 */
export class WindchillAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: any
  ) {
    super(message);
    this.name = 'WindchillAPIError';
  }
}

/**
 * Tool status - indicates if a tool is working, experimental, or broken
 */
export enum ToolStatus {
  WORKING = 'working',
  EXPERIMENTAL = 'experimental',
  BROKEN = 'broken',
  DEPRECATED = 'deprecated'
}

/**
 * Tool metadata for tracking status
 */
export interface ToolMetadata {
  status: ToolStatus;
  notes?: string;
  windchillVersion?: string;
  lastTested?: string;
}
