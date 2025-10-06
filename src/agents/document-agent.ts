/**
 * Import the BaseAgent class that provides common functionality for all Windchill agents.
 * This abstract class handles API client injection and defines the contract for agent implementation.
 */
import { BaseAgent } from "./base-agent.js";

/**
 * Import the Windchill API endpoint configurations.
 * This module centralizes all API endpoint URLs and ensures consistency across agents.
 */
import { apiEndpoints } from "../config/windchill.js";

/**
 * The `DocumentAgent` class extends the `BaseAgent` to provide specialized tools for interacting with
 * document resources in the Windchill PLM system.
 *
 * This agent serves as a Model Context Protocol (MCP) resource that exposes document management
 * capabilities to external tools and applications. It provides a structured interface for common
 * document operations while handling the underlying API communication with Windchill.
 *
 * @remarks
 * This agent exposes comprehensive document management tools organized in three priority tiers:
 *
 * **Original Tools:**
 * - `search`: Basic document search by number, name, or type using OData filtering
 * - `get`: Retrieve detailed information for a specific document by its unique identifier
 * - `get_attributes`: Retrieve all attributes for a specific document by its objectID
 *
 * **Priority 1 - Core Document Lifecycle:**
 * - `create`: Create new documents with metadata and content
 * - `update`: Update document metadata and properties
 * - `checkout`: Check out documents for editing
 * - `checkin`: Check in documents after modifications
 * - `revise`: Create new document revisions
 * - `get_version_history`: Retrieve complete version/iteration history
 * - `get_iterations`: Get all iterations for a specific version
 * - `set_iteration_note`: Add notes to specific iterations
 *
 * **Priority 2 - Content & Relationship Management:**
 * - `upload_content`: Upload primary content files to documents
 * - `download_content`: Download document content files
 * - `get_content_info`: Get metadata about document content
 * - `add_attachment`: Add file attachments to documents
 * - `get_attachments`: List all document attachments
 * - `download_attachment`: Download specific attachments
 * - `add_reference`: Create reference links between documents
 * - `get_references`: Get documents referenced by this document
 * - `get_referencing`: Get documents that reference this document
 * - `remove_reference`: Remove document references
 *
 * **Priority 3 - Advanced Search & Bulk Operations:**
 * - `advanced_search`: Multi-criteria search with date ranges and lifecycle states
 * - `search_by_creator`: Search by creator/modifier with date filters
 * - `search_by_lifecycle`: Search by lifecycle state
 * - `search_by_date_range`: Search within specific date ranges
 * - `search_related`: Find related documents through references
 * - `bulk_update`: Update multiple documents with same changes
 * - `bulk_lifecycle_action`: Perform lifecycle actions on multiple documents
 *
 * Each tool defines its own input schema using JSON Schema format for validation and MCP client
 * integration. The agent uses an injected Windchill API client to communicate with the backend
 * endpoints defined in the apiEndpoints configuration.
 *
 * The agent follows the factory pattern where each tool is a self-contained unit with its own
 * schema definition and async handler function, making it easy to extend with additional tools.
 *
 * @example
 * ```typescript
 * // Example usage within an MCP server:
 * const agent = new DocumentAgent();
 *
 * // Original tools
 * const searchResults = await agent.tools.find(t => t.name === 'search')?.handler({ number: 'DOC-123' });
 * const documentDetails = await agent.tools.find(t => t.name === 'get')?.handler({ id: 'abc123' });
 * const attributes = await agent.tools.find(t => t.name === 'get_attributes')?.handler({ objectId: 'abc123' });
 *
 * // Priority 1: Core lifecycle operations
 * const newDoc = await agent.tools.find(t => t.name === 'create')?.handler({
 *   number: 'DOC-456', name: 'New Document', type: 'SPEC'
 * });
 * const updatedDoc = await agent.tools.find(t => t.name === 'update')?.handler({
 *   id: 'abc123', name: 'Updated Document Name'
 * });
 * await agent.tools.find(t => t.name === 'checkout')?.handler({ id: 'abc123', comment: 'Editing document' });
 * await agent.tools.find(t => t.name === 'checkin')?.handler({ id: 'abc123', comment: 'Completed edits' });
 *
 * // Priority 2: Content management
 * await agent.tools.find(t => t.name === 'upload_content')?.handler({
 *   id: 'abc123', filePath: '/path/to/file.pdf', fileName: 'document.pdf'
 * });
 * const content = await agent.tools.find(t => t.name === 'download_content')?.handler({ id: 'abc123' });
 *
 * // Priority 3: Advanced search
 * const advancedResults = await agent.tools.find(t => t.name === 'advanced_search')?.handler({
 *   name: 'specification', lifecycleState: 'RELEASED', limit: 50
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Example of how this agent might be used by an MCP client:
 * const response = await mcpClient.callTool('document', 'search', { name: 'specification' });
 * const newDoc = await mcpClient.callTool('document', 'create', {
 *   number: 'DOC-456', name: 'New Document', type: 'SPEC'
 * });
 * const related = await mcpClient.callTool('document', 'search_related', {
 *   id: 'abc123', direction: 'both'
 * });
 * ```
 */
export class DocumentAgent extends BaseAgent {
  /**
   * Unique identifier for this agent within the MCP ecosystem.
   * This name is used for tool registration and discovery.
   *
   * @protected
   * @type {string}
   */
  protected agentName = "document";

  /**
   * Defines the collection of tools available through this agent.
   * Each tool is a complete, self-contained unit with its own schema and handler.
   *
   * @protected
   * @type {Array<{name: string, description: string, inputSchema: any, handler: Function}>}
   */
  protected tools = [
    {
      /**
       * Tool for searching documents in the Windchill system.
       * Supports filtering by document number, name, or type using OData query syntax.
       *
       * @type {string}
       */
      name: "search",

      /**
       * Human-readable description of the search tool's purpose.
       * Used for MCP tool discovery and documentation.
       *
       * @type {string}
       */
      description:
        "Search for documents by number, name, or type in the Windchill system",

      /**
       * JSON Schema definition for validating search tool inputs.
       * Defines the structure and constraints for search parameters.
       *
       * @type {object}
       */
      inputSchema: {
        type: "object",
        properties: {
          /**
           * Optional document number filter.
           * Uses OData equality filter: "Number eq 'value'"
           *
           * @type {string}
           */
          number: {
            type: "string",
            description:
              "Document number to search for (e.g., 'DOC-123', 'SPEC-001')",
          },

          /**
           * Optional document name filter.
           * Uses OData equality filter: "Name eq 'value'"
           *
           * @type {string}
           */
          name: {
            type: "string",
            description:
              "Document name to search for (e.g., 'User Manual', 'Technical Specification')",
          },

          /**
           * Optional document type filter.
           * Note: This parameter is defined in schema but not implemented in handler.
           * Could be extended to support type-based filtering in the future.
           *
           * @type {string}
           */
          type: {
            type: "string",
            description:
              "Document type to filter by (e.g., 'CAD', 'SPEC', 'MANUAL')",
          },
        },

        /**
         * No properties are required - all search parameters are optional.
         * Users can search with any combination of number, name, or type.
         *
         * @type {string[]}
         */
        required: [],
      },

      /**
       * Async handler function that implements the document search logic.
       * Builds OData query parameters and executes the search against Windchill API.
       *
       * @param {any} params - Search parameters matching the inputSchema
       * @returns {Promise<any>} Search results from Windchill API
       *
       * @async
       */
      handler: async (params: any) => {
        /**
         * URLSearchParams object to build OData query string.
         * Each search parameter is converted to an OData $filter clause.
         *
         * @type {URLSearchParams}
         */
        const queryParams = new URLSearchParams();

        /**
         * Add document number filter if provided.
         * Uses OData syntax: "$filter=Number eq 'DOC-123'"
         * Note: Multiple filters would be AND-ed together if all parameters are provided.
         */
        if (params.number) {
          queryParams.append("$filter", `Number eq '${params.number}'`);
        }

        /**
         * Add document name filter if provided.
         * Uses OData syntax: "$filter=contains(Name,'User Manual')" for partial matching
         * Note: If both number and name are provided, both filters are applied (AND operation).
         */
        if (params.name) {
          queryParams.append("$filter", `contains(Name,'${params.name}')`);
        }

        /**
         * Note: Document type filtering is not implemented in this version.
         * The schema includes it for future extensibility, but the handler doesn't process it.
         * To implement: if (params.type) queryParams.append("$filter", `Type eq '${params.type}'`);
         */

        /**
         * Execute the search request against the Windchill documents endpoint.
         * The query parameters are appended to the base documents URL.
         *
         * @example
         * // If number='DOC-123' is provided:
         * // GET /Windchill/servlet/odata/DocMgmt/Documents?$filter=Number eq 'DOC-123'
         */
        const response = await this.api.get(
          `${apiEndpoints.documents}?${queryParams.toString()}`
        );

        /**
         * Return the raw response data from the Windchill API.
         * The response typically includes an array of matching documents with their metadata.
         *
         * @returns {any} Document search results
         */
        return response.data;
      },
    },
    {
      /**
       * Tool for retrieving detailed information about a specific document.
       * Fetches complete document metadata using the document's unique identifier.
       *
       * @type {string}
       */
      name: "get",

      /**
       * Human-readable description of the get tool's purpose.
       * Used for MCP tool discovery and documentation.
       *
       * @type {string}
       */
      description:
        "Retrieve detailed information for a specific document by its unique ID",

      /**
       * JSON Schema definition for validating get tool inputs.
       * Defines the required structure for document retrieval requests.
       *
       * @type {object}
       */
      inputSchema: {
        type: "object",
        properties: {
          /**
           * The unique identifier for the document to retrieve.
           * This is typically a UUID or internal Windchill identifier.
           *
           * @type {string}
           * @example "VR:wt.doc.WTDocument:123456"
           * @example "OR:wt.doc.WTDocument:789012"
           */
          id: {
            type: "string",
            description:
              "Unique document identifier (UUID or Windchill internal ID)",
          },
        },

        /**
         * The document ID is mandatory for this operation.
         * Without it, the API request cannot be constructed.
         *
         * @type {string[]}
         */
        required: ["id"],
      },

      /**
       * Async handler function that implements the document retrieval logic.
       * Makes a direct API call to get a single document's complete information.
       *
       * @param {any} params - Document ID parameter matching the inputSchema
       * @returns {Promise<any>} Complete document details from Windchill API
       *
       * @async
       */
      handler: async (params: any) => {
        /**
         * Construct the Windchill OData endpoint URL for a specific document.
         * Uses OData entity syntax: /EntitySet('key')
         *
         * The document ID is wrapped in single quotes as per OData specification.
         * This creates a URL like: /Documents('VR:wt.doc.WTDocument:123456')
         *
         * @example
         * // Input: { id: 'VR:wt.doc.WTDocument:123456' }
         * // Result URL: /Windchill/servlet/odata/DocMgmt/Documents('VR:wt.doc.WTDocument:123456')
         */
        const response = await this.api.get(
          `${apiEndpoints.documents}('${params.id}')`
        );

        /**
         * Return the complete document data from the Windchill API response.
         * This typically includes all document metadata such as:
         * - Basic properties (name, number, type)
         * - Version information
         * - Lifecycle state
         * - Creator and modification details
         * - File attachments (if any)
         * - Custom attributes
         *
         * @returns {any} Complete document object with all available properties
         */
        return response.data;
      },
    },
    {
      /**
       * Tool for retrieving all attributes and properties for a specific document.
       * Attempts to get comprehensive document information, though limited by Windchill OData constraints.
       *
       * @type {string}
       */
      name: "get_attributes",

      /**
       * Human-readable description of the get_attributes tool's purpose.
       * Used for MCP tool discovery and documentation.
       *
       * @type {string}
       */
      description:
        "Retrieve all attributes and properties for a specific document by its object ID",

      /**
       * JSON Schema definition for validating get_attributes tool inputs.
       * Defines the structure for document attribute retrieval requests.
       *
       * @type {object}
       */
      inputSchema: {
        type: "object",
        properties: {
          /**
           * The unique object identifier for the document whose attributes are being requested.
           * This is typically the same as the 'id' parameter used in the 'get' tool.
           *
           * @type {string}
           * @example "VR:wt.doc.WTDocument:123456"
           * @example "OR:wt.doc.WTDocument:789012"
           */
          objectId: {
            type: "string",
            description:
              "Unique document object identifier (UUID or Windchill internal ID)",
          },

          /**
           * Optional parameter for specifying which related properties to expand in the response.
           * This parameter is included for API completeness but has limited functionality
           * due to Windchill OData implementation constraints.
           *
           * @type {string}
           * @example "Attributes,Relationships"
           * @example "Creator,Modifier,Attachments"
           */
          expand: {
            type: "string",
            description:
              "Optional: Comma-separated list of related properties to expand in the response (e.g., 'Attributes,Relationships')",
          },
        },

        /**
         * The objectId is mandatory for this operation.
         * The expand parameter is optional and may not function as expected.
         *
         * @type {string[]}
         */
        required: ["objectId"],
      },

      /**
       * Async handler function that implements the document attributes retrieval logic.
       * Currently limited by Windchill's OData implementation constraints regarding attribute expansion.
       *
       * @param {any} params - Document objectId and optional expand parameters
       * @returns {Promise<any>} Document data with available properties from Windchill API
       *
       * @async
       */
      handler: async (params: any) => {
        /**
         * IMPORTANT IMPLEMENTATION NOTE:
         * This Windchill OData implementation has significant limitations regarding attribute expansion.
         * The $expand parameter is not fully supported for document attributes, which restricts
         * the tool's ability to retrieve custom attributes and relationships.
         *
         * Current behavior:
         * - Returns all standard document properties that are available
         * - Does NOT expand custom attributes as the parameter name suggests
         * - Does NOT expand relationships or related objects
         *
         * Future improvements could include:
         * - Custom API endpoints for attribute retrieval
         * - Separate tool for relationship expansion
         * - Workarounds using Windchill's Info*Engine or custom services
         */

        /**
         * Execute the document retrieval request using the same endpoint as the 'get' tool.
         * The expand parameter is currently ignored due to Windchill OData limitations.
         *
         * Note: Even though this uses the same endpoint as the 'get' tool, it's kept separate
         * to maintain API consistency and allow for future implementation of attribute expansion.
         *
         * @example
         * // Input: { objectId: 'VR:wt.doc.WTDocument:123456', expand: 'Attributes' }
         * // Actual URL: /Windchill/servlet/odata/DocMgmt/Documents('VR:wt.doc.WTDocument:123456')
         * // Note: expand parameter is ignored by current Windchill implementation
         */
        const response = await this.api.get(
          `${apiEndpoints.documents}('${params.objectId}')`
        );

        /**
         * Return the document data from the Windchill API response.
         *
         * Current limitations:
         * - Only standard OData properties are included
         * - Custom attributes defined in Windchill Type Manager are not accessible
         * - Document relationships and references are not expanded
         * - File attachments metadata may be limited
         *
         * The response typically includes:
         * - Basic document properties (name, number, type, version)
         * - Standard Windchill metadata (created by, modified date, etc.)
         * - Available standard attributes
         * - Basic lifecycle information
         *
         * For complete attribute access, consider using:
         * - Windchill's Info*Engine APIs
         * - Custom web services
         * - Direct database queries (not recommended)
         *
         * @returns {any} Document object with available standard properties
         */
        return response.data;
      },
    },
    // === PRIORITY 1: CORE DOCUMENT LIFECYCLE OPERATIONS ===
    {
      name: "create",
      description: "Create a new document in the Windchill system",
      inputSchema: {
        type: "object",
        properties: {
          number: {
            type: "string",
            description: "Document number (e.g., 'DOC-123', 'SPEC-001')"
          },
          name: {
            type: "string",
            description: "Document name/title"
          },
          type: {
            type: "string",
            description: "Document type (e.g., 'CAD', 'SPEC', 'MANUAL')"
          },
          description: {
            type: "string",
            description: "Document description"
          },
          container: {
            type: "string",
            description: "Container/context where document should be created"
          },
          folder: {
            type: "string",
            description: "Folder path where document should be placed"
          }
        },
        required: ["number", "name", "type"]
      },
      handler: async (params: any) => {
        const createData = {
          Number: params.number,
          Name: params.name,
          Type: params.type,
          Description: params.description || "",
          Container: params.container,
          Folder: params.folder
        };

        const response = await this.api.post(
          apiEndpoints.documents,
          createData
        );

        return response.data;
      }
    },
    {
      name: "update",
      description: "Update document metadata and properties",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          },
          name: {
            type: "string",
            description: "Updated document name"
          },
          description: {
            type: "string",
            description: "Updated document description"
          },
          attributes: {
            type: "object",
            description: "Custom attributes to update (key-value pairs)"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        const updateData: any = {};

        if (params.name) updateData.Name = params.name;
        if (params.description) updateData.Description = params.description;
        if (params.attributes) {
          Object.assign(updateData, params.attributes);
        }

        const response = await this.api.patch(
          `${apiEndpoints.documents}('${params.id}')`,
          updateData
        );

        return response.data;
      }
    },
    {
      name: "checkout",
      description: "Check out a document for editing",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          },
          comment: {
            type: "string",
            description: "Optional checkout comment"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.documents}('${params.id}')/checkout`,
          {
            comment: params.comment || ""
          }
        );

        return response.data;
      }
    },
    {
      name: "checkin",
      description: "Check in a document after editing",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          },
          comment: {
            type: "string",
            description: "Check-in comment describing changes"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.documents}('${params.id}')/checkin`,
          {
            comment: params.comment || ""
          }
        );

        return response.data;
      }
    },
    {
      name: "revise",
      description: "Create a new revision of an existing document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          },
          comment: {
            type: "string",
            description: "Revision comment"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.documents}('${params.id}')/revise`,
          {
            comment: params.comment || ""
          }
        );

        return response.data;
      }
    },
    // === PRIORITY 1: DOCUMENT VERSION MANAGEMENT ===
    {
      name: "get_version_history",
      description: "Retrieve complete version and iteration history for a document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        // Windchill 13.0.2 doesn't support /versionHistory navigation property
        // Use $expand=Versions instead
        const response = await this.api.get(
          `${apiEndpoints.documents}('${params.id}')?$expand=Versions`
        );

        return response.data;
      }
    },
    {
      name: "get_iterations",
      description: "Get all iterations for a specific version of a document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          },
          version: {
            type: "string",
            description: "Version identifier (e.g., 'A', 'B', '1')"
          }
        },
        required: ["id", "version"]
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.documents}('${params.id}')/iterations?version=${params.version}`
        );

        return response.data;
      }
    },
    {
      name: "set_iteration_note",
      description: "Add or update a note for a specific document iteration",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          },
          iteration: {
            type: "string",
            description: "Iteration identifier (e.g., 'A.1', 'B.2')"
          },
          note: {
            type: "string",
            description: "Note content to add to the iteration"
          }
        },
        required: ["id", "iteration", "note"]
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.documents}('${params.id}')/setIterationNote`,
          {
            iteration: params.iteration,
            note: params.note
          }
        );

        return response.data;
      }
    },
    // === PRIORITY 2: CONTENT MANAGEMENT ===
    {
      name: "upload_content",
      description: "Upload primary content file to a document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          },
          filePath: {
            type: "string",
            description: "Local file path to upload"
          },
          fileName: {
            type: "string",
            description: "Name for the uploaded file"
          },
          description: {
            type: "string",
            description: "Description of the content"
          }
        },
        required: ["id", "filePath", "fileName"]
      },
      handler: async (params: any) => {
        const formData = new FormData();
        formData.append('file', params.filePath);
        formData.append('fileName', params.fileName);
        formData.append('description', params.description || '');

        const response = await this.api.post(
          `${apiEndpoints.documents}('${params.id}')/uploadContent`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        return response.data;
      }
    },
    {
      name: "download_content",
      description: "Download primary content from a document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          },
          fileName: {
            type: "string",
            description: "Name for the downloaded file"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.documents}('${params.id}')/downloadContent`,
          {
            responseType: 'blob'
          }
        );

        return {
          data: response.data,
          fileName: params.fileName || `document_${params.id}_content`
        };
      }
    },
    {
      name: "get_content_info",
      description: "Get metadata about document content and attachments",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        // Windchill 13.0.2 doesn't support /contentInfo navigation property
        // Use $expand=ContentHolder to get content information
        const response = await this.api.get(
          `${apiEndpoints.documents}('${params.id}')?$expand=ContentHolder`
        );

        return response.data;
      }
    },
    {
      name: "add_attachment",
      description: "Add a file attachment to a document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          },
          filePath: {
            type: "string",
            description: "Local file path to attach"
          },
          fileName: {
            type: "string",
            description: "Name for the attachment"
          },
          description: {
            type: "string",
            description: "Description of the attachment"
          }
        },
        required: ["id", "filePath", "fileName"]
      },
      handler: async (params: any) => {
        const formData = new FormData();
        formData.append('file', params.filePath);
        formData.append('fileName', params.fileName);
        formData.append('description', params.description || '');

        const response = await this.api.post(
          `${apiEndpoints.documents}('${params.id}')/addAttachment`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        return response.data;
      }
    },
    {
      name: "get_attachments",
      description: "List all attachments for a document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.documents}('${params.id}')/attachments`
        );

        return response.data;
      }
    },
    {
      name: "download_attachment",
      description: "Download a specific attachment from a document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          },
          attachmentId: {
            type: "string",
            description: "Unique attachment identifier"
          },
          fileName: {
            type: "string",
            description: "Name for the downloaded file"
          }
        },
        required: ["id", "attachmentId"]
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.documents}('${params.id}')/downloadAttachment/${params.attachmentId}`,
          {
            responseType: 'blob'
          }
        );

        return {
          data: response.data,
          fileName: params.fileName || `attachment_${params.attachmentId}`
        };
      }
    },
    // === PRIORITY 2: RELATIONSHIP MANAGEMENT ===
    {
      name: "add_reference",
      description: "Create a reference link between documents",
      inputSchema: {
        type: "object",
        properties: {
          sourceId: {
            type: "string",
            description: "Source document identifier"
          },
          targetId: {
            type: "string",
            description: "Target document identifier"
          },
          referenceType: {
            type: "string",
            description: "Type of reference (e.g., 'RELATED', 'REFERENCE', 'DEPENDS_ON')"
          },
          description: {
            type: "string",
            description: "Description of the reference relationship"
          }
        },
        required: ["sourceId", "targetId", "referenceType"]
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.documents}('${params.sourceId}')/addReference`,
          {
            targetId: params.targetId,
            referenceType: params.referenceType,
            description: params.description || ""
          }
        );

        return response.data;
      }
    },
    {
      name: "get_references",
      description: "Get all documents referenced by this document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.documents}('${params.id}')/references`
        );

        return response.data;
      }
    },
    {
      name: "get_referencing",
      description: "Get all documents that reference this document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique document identifier"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        const response = await this.api.get(
          `${apiEndpoints.documents}('${params.id}')/referencing`
        );

        return response.data;
      }
    },
    {
      name: "remove_reference",
      description: "Remove a reference link between documents",
      inputSchema: {
        type: "object",
        properties: {
          sourceId: {
            type: "string",
            description: "Source document identifier"
          },
          targetId: {
            type: "string",
            description: "Target document identifier"
          },
          referenceType: {
            type: "string",
            description: "Type of reference to remove"
          }
        },
        required: ["sourceId", "targetId"]
      },
      handler: async (params: any) => {
        const response = await this.api.post(
          `${apiEndpoints.documents}('${params.sourceId}')/removeReference`,
          {
            targetId: params.targetId,
            referenceType: params.referenceType || "REFERENCE"
          }
        );

        return response.data;
      }
    },
    // === PRIORITY 3: ENHANCED SEARCH ===
    {
      name: "advanced_search",
      description: "Advanced multi-criteria document search with date ranges and lifecycle states",
      inputSchema: {
        type: "object",
        properties: {
          number: {
            type: "string",
            description: "Document number filter"
          },
          name: {
            type: "string",
            description: "Document name filter (partial match)"
          },
          type: {
            type: "string",
            description: "Document type filter"
          },
          lifecycleState: {
            type: "string",
            description: "Lifecycle state filter"
          },
          creator: {
            type: "string",
            description: "Created by user filter"
          },
          createdAfter: {
            type: "string",
            description: "Created after date (ISO format)"
          },
          createdBefore: {
            type: "string",
            description: "Created before date (ISO format)"
          },
          modifiedAfter: {
            type: "string",
            description: "Modified after date (ISO format)"
          },
          modifiedBefore: {
            type: "string",
            description: "Modified before date (ISO format)"
          },
          container: {
            type: "string",
            description: "Container filter"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return"
          }
        },
        required: []
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();

        // Build filter conditions
        const filters = [];

        if (params.number) filters.push(`Number eq '${params.number}'`);
        if (params.name) filters.push(`contains(Name,'${params.name}')`);
        if (params.type) filters.push(`Type eq '${params.type}'`);
        if (params.lifecycleState) filters.push(`State eq '${params.lifecycleState}'`);
        if (params.creator) filters.push(`CreatedBy eq '${params.creator}'`);
        if (params.container) filters.push(`Container eq '${params.container}'`);

        // Date range filters
        if (params.createdAfter) filters.push(`CreatedOn gt ${params.createdAfter}`);
        if (params.createdBefore) filters.push(`CreatedOn lt ${params.createdBefore}`);
        if (params.modifiedAfter) filters.push(`ModifiedOn gt ${params.modifiedAfter}`);
        if (params.modifiedBefore) filters.push(`ModifiedOn lt ${params.modifiedBefore}`);

        if (filters.length > 0) {
          queryParams.append("$filter", filters.join(" and "));
        }

        // Add limit
        if (params.limit) {
          queryParams.append("$top", params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.documents}?${queryParams.toString()}`
        );

        return response.data;
      }
    },
    {
      name: "search_by_creator",
      description: "Search for documents by creator or modifier",
      inputSchema: {
        type: "object",
        properties: {
          creator: {
            type: "string",
            description: "Username of the document creator"
          },
          modifier: {
            type: "string",
            description: "Username of the last modifier"
          },
          createdAfter: {
            type: "string",
            description: "Created after date (ISO format)"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return"
          }
        },
        required: []
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        const filters = [];

        if (params.creator) filters.push(`CreatedBy eq '${params.creator}'`);
        if (params.modifier) filters.push(`ModifiedBy eq '${params.modifier}'`);
        if (params.createdAfter) filters.push(`CreatedOn gt ${params.createdAfter}`);

        if (filters.length > 0) {
          queryParams.append("$filter", filters.join(" and "));
        }

        if (params.limit) {
          queryParams.append("$top", params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.documents}?${queryParams.toString()}`
        );

        return response.data;
      }
    },
    {
      name: "search_by_lifecycle",
      description: "Search for documents (Note: Windchill 13.0.2 does not support lifecycle state filtering via OData)",
      inputSchema: {
        type: "object",
        properties: {
          state: {
            type: "string",
            description: "Lifecycle state (ignored - not supported in Windchill 13.0.2 OData)"
          },
          name: {
            type: "string",
            description: "Document name filter (partial match)"
          },
          number: {
            type: "string",
            description: "Document number filter"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return"
          }
        },
        required: []
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        const filters = [];

        // State and Container properties not available in Windchill 13.0.2 OData
        // Using Name and Number filters instead
        if (params.name) filters.push(`contains(Name,'${params.name}')`);
        if (params.number) filters.push(`Number eq '${params.number}'`);

        if (filters.length > 0) {
          queryParams.append("$filter", filters.join(' and '));
        }

        if (params.limit) {
          queryParams.append("$top", params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.documents}?${queryParams.toString()}`
        );

        return response.data;
      }
    },
    {
      name: "search_by_date_range",
      description: "Search for documents within a specific date range",
      inputSchema: {
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description: "Start date for search (ISO format)"
          },
          endDate: {
            type: "string",
            description: "End date for search (ISO format)"
          },
          dateField: {
            type: "string",
            description: "Date field to search by (CreatedOn, ModifiedOn)",
            enum: ["CreatedOn", "ModifiedOn"]
          },
          type: {
            type: "string",
            description: "Document type filter"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return"
          }
        },
        required: ["startDate", "endDate", "dateField"]
      },
      handler: async (params: any) => {
        const queryParams = new URLSearchParams();
        const filters = [];

        filters.push(`${params.dateField} ge ${params.startDate}`);
        filters.push(`${params.dateField} le ${params.endDate}`);

        if (params.type) {
          filters.push(`Type eq '${params.type}'`);
        }

        queryParams.append("$filter", filters.join(" and "));

        if (params.limit) {
          queryParams.append("$top", params.limit.toString());
        }

        const response = await this.api.get(
          `${apiEndpoints.documents}?${queryParams.toString()}`
        );

        return response.data;
      }
    },
    {
      name: "search_related",
      description: "Find documents related to a specific document through references",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Source document identifier"
          },
          relationshipType: {
            type: "string",
            description: "Type of relationship to follow"
          },
          direction: {
            type: "string",
            description: "Direction to search (references, referencing, both)",
            enum: ["references", "referencing", "both"]
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return"
          }
        },
        required: ["id"]
      },
      handler: async (params: any) => {
        const results = [];

        if (params.direction === "references" || params.direction === "both") {
          const references = await this.api.get(
            `${apiEndpoints.documents}('${params.id}')/references`
          );
          results.push(...references.data.value);
        }

        if (params.direction === "referencing" || params.direction === "both") {
          const referencing = await this.api.get(
            `${apiEndpoints.documents}('${params.id}')/referencing`
          );
          results.push(...referencing.data.value);
        }

        // Apply limit if specified
        const limitedResults = params.limit ? results.slice(0, params.limit) : results;

        return {
          relatedDocuments: limitedResults,
          totalCount: results.length,
          relationshipType: params.relationshipType || "ALL"
        };
      }
    },
    // === PRIORITY 3: BULK OPERATIONS ===
    {
      name: "bulk_update",
      description: "Update multiple documents with the same changes",
      inputSchema: {
        type: "object",
        properties: {
          documentIds: {
            type: "array",
            description: "Array of document identifiers to update",
            items: {
              type: "string"
            }
          },
          updates: {
            type: "object",
            description: "Fields to update on all documents"
          },
          filter: {
            type: "object",
            description: "Optional filter to select documents for bulk update"
          }
        },
        required: ["updates"]
      },
      handler: async (params: any) => {
        const results = [];

        if (params.documentIds && params.documentIds.length > 0) {
          // Update specific documents
          for (const docId of params.documentIds) {
            try {
              const response = await this.api.patch(
                `${apiEndpoints.documents}('${docId}')`,
                params.updates
              );
              results.push({
                id: docId,
                success: true,
                data: response.data
              });
            } catch (error: any) {
              results.push({
                id: docId,
                success: false,
                error: error?.message || 'Unknown error occurred'
              });
            }
          }
        } else if (params.filter) {
          // First search for documents matching filter
          const searchParams = new URLSearchParams();

          if (params.filter.number) searchParams.append("$filter", `Number eq '${params.filter.number}'`);
          if (params.filter.name) searchParams.append("$filter", `contains(Name,'${params.filter.name}')`);
          if (params.filter.type) searchParams.append("$filter", `Type eq '${params.filter.type}'`);

          const searchResponse = await this.api.get(
            `${apiEndpoints.documents}?${searchParams.toString()}`
          );

          // Update found documents
          for (const doc of searchResponse.data.value) {
            try {
              const response = await this.api.patch(
                `${apiEndpoints.documents}('${doc.ID}')`,
                params.updates
              );
              results.push({
                id: doc.ID,
                success: true,
                data: response.data
              });
            } catch (error: any) {
              results.push({
                id: doc.ID,
                success: false,
                error: error?.message || 'Unknown error occurred'
              });
            }
          }
        }

        return {
          results,
          totalProcessed: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        };
      }
    },
    {
      name: "bulk_lifecycle_action",
      description: "Perform lifecycle actions on multiple documents",
      inputSchema: {
        type: "object",
        properties: {
          documentIds: {
            type: "array",
            description: "Array of document identifiers",
            items: {
              type: "string"
            }
          },
          action: {
            type: "string",
            description: "Lifecycle action to perform (e.g., 'APPROVE', 'REJECT', 'SUBMIT')"
          },
          comment: {
            type: "string",
            description: "Comment for the lifecycle action"
          },
          filter: {
            type: "object",
            description: "Optional filter to select documents"
          }
        },
        required: ["action"]
      },
      handler: async (params: any) => {
        const results = [];

        if (params.documentIds && params.documentIds.length > 0) {
          // Process specific documents
          for (const docId of params.documentIds) {
            try {
              const response = await this.api.post(
                `${apiEndpoints.documents}('${docId}')/lifecycleAction`,
                {
                  action: params.action,
                  comment: params.comment || ""
                }
              );
              results.push({
                id: docId,
                success: true,
                data: response.data
              });
            } catch (error: any) {
              results.push({
                id: docId,
                success: false,
                error: error?.message || 'Unknown error occurred'
              });
            }
          }
        } else if (params.filter) {
          // First search for documents matching filter
          const searchParams = new URLSearchParams();

          if (params.filter.state) searchParams.append("$filter", `State eq '${params.filter.state}'`);
          if (params.filter.type) searchParams.append("$filter", `Type eq '${params.filter.type}'`);

          const searchResponse = await this.api.get(
            `${apiEndpoints.documents}?${searchParams.toString()}`
          );

          // Process found documents
          for (const doc of searchResponse.data.value) {
            try {
              const response = await this.api.post(
                `${apiEndpoints.documents}('${doc.ID}')/lifecycleAction`,
                {
                  action: params.action,
                  comment: params.comment || ""
                }
              );
              results.push({
                id: doc.ID,
                success: true,
                data: response.data
              });
            } catch (error: any) {
              results.push({
                id: doc.ID,
                success: false,
                error: error?.message || 'Unknown error occurred'
              });
            }
          }
        }

        return {
          results,
          totalProcessed: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          action: params.action
        };
      }
    }
  ];
}
