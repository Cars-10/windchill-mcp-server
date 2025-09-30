/**
 * @fileoverview Base Agent Class
 *
 * This file defines the abstract base class for all Windchill MCP agents.
 * It provides common functionality and enforces a consistent structure
 * for implementing specific agent types (Document, Part, Change, etc.).
 */

import { windchillAPI } from "../services/windchill-api.js";

/**
 * Abstract base class for all Windchill MCP agents.
 *
 * This class serves as the foundation for implementing specific agent types
 * that interact with different Windchill object types (documents, parts, changes, etc.).
 * It provides shared functionality and enforces a consistent interface.
 *
 * @abstract
 * @class BaseAgent
 *
 * @example
 * ```typescript
 * export class DocumentAgent extends BaseAgent {
 *   protected agentName = 'document';
 *
 *   protected tools = [
 *     {
 *       name: 'document_search',
 *       description: 'Search for documents',
 *       inputSchema: { type: 'object', properties: { ... } },
 *       handler: async (params) => { ... }
 *     }
 *   ];
 * }
 * ```
 */
export abstract class BaseAgent {
  /**
   * Windchill API service instance.
   *
   * This protected property provides access to the Windchill API service
   * for making HTTP requests to the Windchill system. All derived agent
   * classes can use this to interact with Windchill.
   *
   * @protected
   * @type {typeof windchillAPI}
   */
  protected api = windchillAPI;

  /**
   * The name of this agent type.
   *
   * This abstract property must be implemented by derived classes to specify
   * the agent type (e.g., 'document', 'part', 'change', 'workflow', 'project').
   * The agent name is used for identification and routing purposes in the MCP server.
   *
   * @protected
   * @abstract
   * @type {string}
   */
  protected abstract agentName: string;

  /**
   * Array of tools provided by this agent.
   *
   * This abstract property defines the complete set of tools (functions/capabilities)
   * that this agent exposes to the MCP server. Each tool has a name, description,
   * input schema for validation, and a handler function that implements the tool's logic.
   *
   * @protected
   * @abstract
   * @type {Array<{
   *   name: string;
   *   description: string;
   *   inputSchema: any;
   *   handler: (params: any) => Promise<any>;
   * }>}
   *
   * @example
   * ```typescript
   * protected tools = [
   *   {
   *     name: 'document_search',
   *     description: 'Search for documents by various criteria',
   *     inputSchema: {
   *       type: 'object',
   *       properties: {
   *         number: { type: 'string', description: 'Document number' },
   *         name: { type: 'string', description: 'Document name' },
   *         type: { type: 'string', description: 'Document type' }
   *       }
   *     },
   *     handler: async (params) => {
   *       // Implementation for searching documents
   *       return await this.api.searchDocuments(params);
   *     }
   *   }
   * ];
   * ```
   */
  protected abstract tools: Array<{
    /**
     * Unique identifier for the tool within this agent.
     * Tool names should follow the pattern: `{agentName}_{toolAction}`
     */
    name: string;

    /**
     * Human-readable description of what the tool does.
     * This description is exposed to MCP clients for tool discovery.
     */
    description: string;

    /**
     * JSON Schema defining the expected input parameters for this tool.
     * Used for validation and documentation of the tool's interface.
     */
    inputSchema: any;

    /**
     * Async function that implements the tool's core functionality.
     *
     * @param params - Input parameters conforming to the inputSchema
     * @returns Promise resolving to the tool's result
     */
    handler: (params: any) => Promise<any>;
  }>;
}
