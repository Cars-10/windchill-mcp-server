/**
 * @fileoverview Document Agent - Token-Efficient MCP Tools for Windchill Documents
 *
 * Comprehensive document management with token-efficient responses.
 */

import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolDefinition, ToolAnnotations } from '../types/common.js';
import {
  ResponseFormat,
  STANDARD_LIST_SCHEMA_PROPS,
  FORMAT_SCHEMA_PROPS,
  buildListResponse,
  buildSingleItemResponse,
  buildErrorResponse,
  buildODataPagination,
  buildTextFilter,
  combineFilters,
  DEFAULT_LIMIT,
  MAX_LIMIT
} from '../utils/response-formatter.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const DOC_CONCISE_FIELDS = ['Number', 'Name', 'Type', 'State', 'Version'] as const;

const DOC_MARKDOWN_COLUMNS = {
  Number: 'Number',
  Name: 'Name',
  Type: 'Type',
  State: 'State',
  Version: 'Version'
};

// ============================================================================
// TOOL ANNOTATIONS
// ============================================================================

const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

const WRITE_OP: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true
};

const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true
};

// ============================================================================
// DOCUMENT AGENT
// ============================================================================

export class DocumentAgent extends BaseAgent {
  protected agentName = 'document';

  protected tools: ToolDefinition[] = [
    // === PRIORITY 1: CORE OPERATIONS ===
    {
      name: 'search',
      description: `Search documents by number, name, or type.

**Parameters:**
- number: Document number with wildcards (e.g., "DOC*", "*-001")
- name: Document name with wildcards
- type: Document type filter
- limit/offset: Pagination (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})
- response_format: 'markdown' (default) or 'json'
- detail_level: 'concise' (default) or 'detailed'

**Returns:** Document list with pagination info

**Examples:**
- { "number": "DOC*" }
- { "name": "*Manual*", "limit": 10 }`,
      inputSchema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Document number (wildcards: *)' },
          name: { type: 'string', description: 'Document name (wildcards: *)' },
          type: { type: 'string', description: 'Document type' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'Search Documents', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.number) filters.push(buildTextFilter('Number', params.number));
          if (params.name) filters.push(buildTextFilter('Name', params.name));
          if (params.type) filters.push(`Type eq '${params.type}'`);

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));

          const response = await this.api.get(`${apiEndpoints.documents}?${queryParams.toString()}`);
          return buildListResponse(response.data, params, {
            title: `Documents Search: "${params.number || params.name || 'all'}"`,
            conciseFields: DOC_CONCISE_FIELDS,
            markdownColumns: DOC_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'document search', suggestion: 'Check filter syntax.' });
        }
      }
    },

    {
      name: 'get',
      description: `Get detailed document information by ID.

**Parameters:**
- id (required): Document identifier
- response_format/detail_level: Output options

**Example:** { "id": "VR:wt.doc.WTDocument:12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Get Document', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.documents}('${params.id}')`);
          return buildSingleItemResponse(response.data, params, {
            title: `Document: ${response.data?.Number || params.id}`,
            conciseFields: DOC_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'get document', suggestion: 'Use search to find valid IDs.' });
        }
      }
    },

    {
      name: 'get_attributes',
      description: `Get all attributes for a document.

**Parameters:**
- objectId (required): Document object ID
- response_format/detail_level: Output options

**Example:** { "objectId": "VR:wt.doc.WTDocument:12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'Document object ID' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['objectId']
      },
      annotations: { title: 'Get Document Attributes', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.documents}('${params.objectId}')`);
          return buildSingleItemResponse(response.data, params, {
            title: `Document Attributes: ${params.objectId}`,
            conciseFields: DOC_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'get attributes' });
        }
      }
    },

    {
      name: 'create',
      description: `Create a new document.

**Parameters:**
- number (required): Document number
- name (required): Document name
- type (required): Document type
- description: Document description
- container: Container/context
- folder: Folder path

**Example:** { "number": "DOC-001", "name": "User Manual", "type": "SPEC" }`,
      inputSchema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Document number' },
          name: { type: 'string', description: 'Document name' },
          type: { type: 'string', description: 'Document type' },
          description: { type: 'string', description: 'Description' },
          container: { type: 'string', description: 'Container' },
          folder: { type: 'string', description: 'Folder path' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['number', 'name', 'type']
      },
      annotations: { title: 'Create Document', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(apiEndpoints.documents, {
            Number: params.number,
            Name: params.name,
            Type: params.type,
            Description: params.description || '',
            Container: params.container,
            Folder: params.folder
          });
          return buildSingleItemResponse(response.data, params, {
            title: `Created Document: ${params.number}`,
            conciseFields: DOC_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'create document', suggestion: 'Check for duplicate numbers.' });
        }
      }
    },

    {
      name: 'update',
      description: `Update document metadata.

**Parameters:**
- id (required): Document identifier
- name: Updated name
- description: Updated description
- attributes: Custom attributes object

**Example:** { "id": "12345", "name": "Updated Name" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          name: { type: 'string', description: 'Updated name' },
          description: { type: 'string', description: 'Updated description' },
          attributes: { type: 'object', description: 'Custom attributes' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Update Document', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const updateData: any = {};
          if (params.name) updateData.Name = params.name;
          if (params.description) updateData.Description = params.description;
          if (params.attributes) Object.assign(updateData, params.attributes);

          const response = await this.api.patch(`${apiEndpoints.documents}('${params.id}')`, updateData);
          return buildSingleItemResponse(response.data, params, {
            title: `Updated Document: ${params.id}`,
            conciseFields: DOC_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'update document' });
        }
      }
    },

    {
      name: 'checkout',
      description: `Check out a document for editing.

**Parameters:**
- id (required): Document identifier
- comment: Checkout comment

**Example:** { "id": "12345", "comment": "Editing content" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          comment: { type: 'string', description: 'Checkout comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Checkout Document', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(`${apiEndpoints.documents}('${params.id}')/checkout`, {
            comment: params.comment || ''
          });
          return buildSingleItemResponse(response.data, params, {
            title: `Checked Out: ${params.id}`,
            conciseFields: DOC_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'checkout', suggestion: 'Document may already be checked out.' });
        }
      }
    },

    {
      name: 'checkin',
      description: `Check in a document after editing.

**Parameters:**
- id (required): Document identifier
- comment: Check-in comment

**Example:** { "id": "12345", "comment": "Updated content" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          comment: { type: 'string', description: 'Check-in comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Checkin Document', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(`${apiEndpoints.documents}('${params.id}')/checkin`, {
            comment: params.comment || ''
          });
          return buildSingleItemResponse(response.data, params, {
            title: `Checked In: ${params.id}`,
            conciseFields: DOC_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'checkin', suggestion: 'Document must be checked out to you.' });
        }
      }
    },

    {
      name: 'revise',
      description: `Create a new document revision.

**Parameters:**
- id (required): Document identifier
- comment: Revision comment

**Example:** { "id": "12345", "comment": "Rev B" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          comment: { type: 'string', description: 'Revision comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Revise Document', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(`${apiEndpoints.documents}('${params.id}')/revise`, {
            comment: params.comment || ''
          });
          return buildSingleItemResponse(response.data, params, {
            title: `New Revision: ${params.id}`,
            conciseFields: DOC_CONCISE_FIELDS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'revise' });
        }
      }
    },

    {
      name: 'get_version_history',
      description: `Get version/iteration history.

**Parameters:**
- id (required): Document identifier
- response_format/detail_level: Output options

**Example:** { "id": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Get Version History', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.documents}('${params.id}')?$expand=Versions`);
          return buildSingleItemResponse(response.data, params, {
            title: `Version History: ${params.id}`,
            conciseFields: ['Version', 'State', 'ModifiedBy', 'ModifiedOn']
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'get version history' });
        }
      }
    },

    {
      name: 'get_iterations',
      description: `Get iterations for a specific version.

**Parameters:**
- id (required): Document identifier
- version (required): Version (e.g., "A", "B")

**Example:** { "id": "12345", "version": "A" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          version: { type: 'string', description: 'Version (e.g., "A")' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id', 'version']
      },
      annotations: { title: 'Get Iterations', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.documents}('${params.id}')/iterations?version=${params.version}`);
          return buildListResponse(response.data, params, {
            title: `Iterations: ${params.id} v${params.version}`,
            conciseFields: ['Iteration', 'State', 'ModifiedBy', 'ModifiedOn'],
            markdownColumns: { Iteration: 'Iter', State: 'State', ModifiedBy: 'Modified By', ModifiedOn: 'Date' }
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'get iterations' });
        }
      }
    },

    {
      name: 'set_iteration_note',
      description: `Add note to a document iteration.

**Parameters:**
- id (required): Document identifier
- iteration (required): Iteration (e.g., "A.1")
- note (required): Note content

**Example:** { "id": "12345", "iteration": "A.1", "note": "Initial draft" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          iteration: { type: 'string', description: 'Iteration (e.g., "A.1")' },
          note: { type: 'string', description: 'Note content' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id', 'iteration', 'note']
      },
      annotations: { title: 'Set Iteration Note', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(`${apiEndpoints.documents}('${params.id}')/setIterationNote`, {
            iteration: params.iteration,
            note: params.note
          });
          const fmt = params.response_format || ResponseFormat.MARKDOWN;
          if (fmt === ResponseFormat.MARKDOWN) {
            return `**Note added to ${params.id} iteration ${params.iteration}**`;
          }
          return JSON.stringify(response.data, null, 2);
        } catch (error) {
          return buildErrorResponse(error, { operation: 'set iteration note' });
        }
      }
    },

    // === PRIORITY 2: CONTENT MANAGEMENT ===
    {
      name: 'upload_content',
      description: `Upload primary content file to a document.

**Parameters:**
- id (required): Document identifier
- filePath (required): Local file path
- fileName (required): File name
- description: Content description

**Example:** { "id": "12345", "filePath": "/path/file.pdf", "fileName": "manual.pdf" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          filePath: { type: 'string', description: 'Local file path' },
          fileName: { type: 'string', description: 'File name' },
          description: { type: 'string', description: 'Content description' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id', 'filePath', 'fileName']
      },
      annotations: { title: 'Upload Content', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const formData = new FormData();
          formData.append('file', params.filePath);
          formData.append('fileName', params.fileName);
          formData.append('description', params.description || '');

          const response = await this.api.post(`${apiEndpoints.documents}('${params.id}')/uploadContent`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          const fmt = params.response_format || ResponseFormat.MARKDOWN;
          if (fmt === ResponseFormat.MARKDOWN) {
            return `**Uploaded ${params.fileName} to document ${params.id}**`;
          }
          return JSON.stringify(response.data, null, 2);
        } catch (error) {
          return buildErrorResponse(error, { operation: 'upload content' });
        }
      }
    },

    {
      name: 'download_content',
      description: `Download primary content from a document.

**Parameters:**
- id (required): Document identifier
- fileName: Name for downloaded file

**Example:** { "id": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          fileName: { type: 'string', description: 'Name for downloaded file' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Download Content', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.documents}('${params.id}')/downloadContent`, {
            responseType: 'blob'
          });
          return { data: response.data, fileName: params.fileName || `document_${params.id}_content` };
        } catch (error) {
          return buildErrorResponse(error, { operation: 'download content' });
        }
      }
    },

    {
      name: 'get_content_info',
      description: `Get metadata about document content.

**Parameters:**
- id (required): Document identifier

**Example:** { "id": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Get Content Info', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.documents}('${params.id}')?$expand=ContentHolder`);
          return buildSingleItemResponse(response.data, params, {
            title: `Content Info: ${params.id}`,
            conciseFields: ['FileName', 'FileSize', 'MimeType', 'CreatedOn']
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'get content info' });
        }
      }
    },

    {
      name: 'add_attachment',
      description: `Add file attachment to a document.

**Parameters:**
- id (required): Document identifier
- filePath (required): Local file path
- fileName (required): Attachment name
- description: Attachment description

**Example:** { "id": "12345", "filePath": "/path/spec.pdf", "fileName": "spec.pdf" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          filePath: { type: 'string', description: 'Local file path' },
          fileName: { type: 'string', description: 'Attachment name' },
          description: { type: 'string', description: 'Description' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id', 'filePath', 'fileName']
      },
      annotations: { title: 'Add Attachment', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const formData = new FormData();
          formData.append('file', params.filePath);
          formData.append('fileName', params.fileName);
          formData.append('description', params.description || '');

          const response = await this.api.post(`${apiEndpoints.documents}('${params.id}')/addAttachment`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          const fmt = params.response_format || ResponseFormat.MARKDOWN;
          if (fmt === ResponseFormat.MARKDOWN) {
            return `**Added attachment ${params.fileName} to document ${params.id}**`;
          }
          return JSON.stringify(response.data, null, 2);
        } catch (error) {
          return buildErrorResponse(error, { operation: 'add attachment' });
        }
      }
    },

    {
      name: 'get_attachments',
      description: `List all attachments for a document.

**Parameters:**
- id (required): Document identifier

**Example:** { "id": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Get Attachments', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.documents}('${params.id}')/attachments`);
          return buildListResponse(response.data, params, {
            title: `Attachments: ${params.id}`,
            conciseFields: ['FileName', 'FileSize', 'MimeType', 'CreatedOn'],
            markdownColumns: { FileName: 'File', FileSize: 'Size', MimeType: 'Type', CreatedOn: 'Created' }
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'get attachments' });
        }
      }
    },

    {
      name: 'download_attachment',
      description: `Download a specific attachment.

**Parameters:**
- id (required): Document identifier
- attachmentId (required): Attachment identifier
- fileName: Name for downloaded file

**Example:** { "id": "12345", "attachmentId": "67890" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          attachmentId: { type: 'string', description: 'Attachment identifier' },
          fileName: { type: 'string', description: 'Name for downloaded file' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id', 'attachmentId']
      },
      annotations: { title: 'Download Attachment', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.documents}('${params.id}')/downloadAttachment/${params.attachmentId}`, {
            responseType: 'blob'
          });
          return { data: response.data, fileName: params.fileName || `attachment_${params.attachmentId}` };
        } catch (error) {
          return buildErrorResponse(error, { operation: 'download attachment' });
        }
      }
    },

    // === PRIORITY 2: RELATIONSHIP MANAGEMENT ===
    {
      name: 'add_reference',
      description: `Create reference link between documents.

**Parameters:**
- sourceId (required): Source document ID
- targetId (required): Target document ID
- referenceType (required): Type (e.g., "RELATED", "DEPENDS_ON")
- description: Reference description

**Example:** { "sourceId": "123", "targetId": "456", "referenceType": "RELATED" }`,
      inputSchema: {
        type: 'object',
        properties: {
          sourceId: { type: 'string', description: 'Source document ID' },
          targetId: { type: 'string', description: 'Target document ID' },
          referenceType: { type: 'string', description: 'Reference type' },
          description: { type: 'string', description: 'Description' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['sourceId', 'targetId', 'referenceType']
      },
      annotations: { title: 'Add Reference', ...WRITE_OP },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(`${apiEndpoints.documents}('${params.sourceId}')/addReference`, {
            targetId: params.targetId,
            referenceType: params.referenceType,
            description: params.description || ''
          });
          const fmt = params.response_format || ResponseFormat.MARKDOWN;
          if (fmt === ResponseFormat.MARKDOWN) {
            return `**Created ${params.referenceType} reference from ${params.sourceId} to ${params.targetId}**`;
          }
          return JSON.stringify(response.data, null, 2);
        } catch (error) {
          return buildErrorResponse(error, { operation: 'add reference' });
        }
      }
    },

    {
      name: 'get_references',
      description: `Get documents referenced by this document.

**Parameters:**
- id (required): Document identifier

**Example:** { "id": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Get References', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.documents}('${params.id}')/references`);
          return buildListResponse(response.data, params, {
            title: `References from: ${params.id}`,
            conciseFields: DOC_CONCISE_FIELDS,
            markdownColumns: DOC_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'get references' });
        }
      }
    },

    {
      name: 'get_referencing',
      description: `Get documents that reference this document.

**Parameters:**
- id (required): Document identifier

**Example:** { "id": "12345" }`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document identifier' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['id']
      },
      annotations: { title: 'Get Referencing Documents', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const response = await this.api.get(`${apiEndpoints.documents}('${params.id}')/referencing`);
          return buildListResponse(response.data, params, {
            title: `Documents referencing: ${params.id}`,
            conciseFields: DOC_CONCISE_FIELDS,
            markdownColumns: DOC_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'get referencing' });
        }
      }
    },

    {
      name: 'remove_reference',
      description: `Remove reference link between documents.

**Parameters:**
- sourceId (required): Source document ID
- targetId (required): Target document ID
- referenceType: Type of reference to remove

**Example:** { "sourceId": "123", "targetId": "456" }`,
      inputSchema: {
        type: 'object',
        properties: {
          sourceId: { type: 'string', description: 'Source document ID' },
          targetId: { type: 'string', description: 'Target document ID' },
          referenceType: { type: 'string', description: 'Reference type' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['sourceId', 'targetId']
      },
      annotations: { title: 'Remove Reference', ...DESTRUCTIVE },
      handler: async (params: any) => {
        try {
          const response = await this.api.post(`${apiEndpoints.documents}('${params.sourceId}')/removeReference`, {
            targetId: params.targetId,
            referenceType: params.referenceType || 'REFERENCE'
          });
          const fmt = params.response_format || ResponseFormat.MARKDOWN;
          if (fmt === ResponseFormat.MARKDOWN) {
            return `**Removed reference from ${params.sourceId} to ${params.targetId}**`;
          }
          return JSON.stringify(response.data, null, 2);
        } catch (error) {
          return buildErrorResponse(error, { operation: 'remove reference' });
        }
      }
    },

    // === PRIORITY 3: ADVANCED SEARCH ===
    {
      name: 'advanced_search',
      description: `Multi-criteria search with date ranges and lifecycle states.

**Parameters:**
- number, name, type: Basic filters
- lifecycleState: State filter
- creator: Created by user
- createdAfter/Before: Date range (ISO)
- modifiedAfter/Before: Date range (ISO)
- container: Container filter
- limit/offset: Pagination

**Example:** { "name": "*spec*", "lifecycleState": "RELEASED", "limit": 50 }`,
      inputSchema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Document number' },
          name: { type: 'string', description: 'Document name' },
          type: { type: 'string', description: 'Document type' },
          lifecycleState: { type: 'string', description: 'Lifecycle state' },
          creator: { type: 'string', description: 'Created by user' },
          createdAfter: { type: 'string', description: 'Created after (ISO)' },
          createdBefore: { type: 'string', description: 'Created before (ISO)' },
          modifiedAfter: { type: 'string', description: 'Modified after (ISO)' },
          modifiedBefore: { type: 'string', description: 'Modified before (ISO)' },
          container: { type: 'string', description: 'Container' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: []
      },
      annotations: { title: 'Advanced Search', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          if (params.number) filters.push(`Number eq '${params.number}'`);
          if (params.name) filters.push(`contains(Name,'${params.name}')`);
          if (params.type) filters.push(`Type eq '${params.type}'`);
          if (params.lifecycleState) filters.push(`State eq '${params.lifecycleState}'`);
          if (params.creator) filters.push(`CreatedBy eq '${params.creator}'`);
          if (params.container) filters.push(`Container eq '${params.container}'`);
          if (params.createdAfter) filters.push(`CreatedOn gt ${params.createdAfter}`);
          if (params.createdBefore) filters.push(`CreatedOn lt ${params.createdBefore}`);
          if (params.modifiedAfter) filters.push(`ModifiedOn gt ${params.modifiedAfter}`);
          if (params.modifiedBefore) filters.push(`ModifiedOn lt ${params.modifiedBefore}`);

          const queryParams = buildODataPagination(params);
          if (filters.length > 0) queryParams.append('$filter', combineFilters(filters));

          const response = await this.api.get(`${apiEndpoints.documents}?${queryParams.toString()}`);
          return buildListResponse(response.data, params, {
            title: 'Advanced Search Results',
            conciseFields: DOC_CONCISE_FIELDS,
            markdownColumns: DOC_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'advanced search' });
        }
      }
    },

    {
      name: 'search_by_date_range',
      description: `Search documents within a date range.

**Parameters:**
- startDate (required): Start date (ISO)
- endDate (required): End date (ISO)
- dateField (required): "CreatedOn" or "ModifiedOn"
- type: Document type filter
- limit/offset: Pagination

**Example:** { "startDate": "2024-01-01", "endDate": "2024-12-31", "dateField": "CreatedOn" }`,
      inputSchema: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date (ISO)' },
          endDate: { type: 'string', description: 'End date (ISO)' },
          dateField: { type: 'string', enum: ['CreatedOn', 'ModifiedOn'], description: 'Date field' },
          type: { type: 'string', description: 'Document type' },
          ...STANDARD_LIST_SCHEMA_PROPS
        },
        required: ['startDate', 'endDate', 'dateField']
      },
      annotations: { title: 'Search by Date Range', ...READ_ONLY },
      handler: async (params: any) => {
        try {
          const filters: string[] = [];
          filters.push(`${params.dateField} ge ${params.startDate}`);
          filters.push(`${params.dateField} le ${params.endDate}`);
          if (params.type) filters.push(`Type eq '${params.type}'`);

          const queryParams = buildODataPagination(params);
          queryParams.append('$filter', combineFilters(filters));

          const response = await this.api.get(`${apiEndpoints.documents}?${queryParams.toString()}`);
          return buildListResponse(response.data, params, {
            title: `Documents ${params.dateField}: ${params.startDate} to ${params.endDate}`,
            conciseFields: DOC_CONCISE_FIELDS,
            markdownColumns: DOC_MARKDOWN_COLUMNS
          });
        } catch (error) {
          return buildErrorResponse(error, { operation: 'search by date range' });
        }
      }
    },

    // === PRIORITY 3: BULK OPERATIONS ===
    {
      name: 'bulk_update',
      description: `Update multiple documents with same changes.

**Parameters:**
- documentIds (required): Array of document IDs
- updates (required): Fields to update

**Example:** { "documentIds": ["123", "456"], "updates": { "Description": "Updated" } }`,
      inputSchema: {
        type: 'object',
        properties: {
          documentIds: { type: 'array', items: { type: 'string' }, description: 'Document IDs' },
          updates: { type: 'object', description: 'Fields to update' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['documentIds', 'updates']
      },
      annotations: { title: 'Bulk Update', ...WRITE_OP },
      handler: async (params: any) => {
        const results: Array<{ id: string; success: boolean; error?: string }> = [];

        for (const docId of params.documentIds) {
          try {
            await this.api.patch(`${apiEndpoints.documents}('${docId}')`, params.updates);
            results.push({ id: docId, success: true });
          } catch (error: any) {
            results.push({ id: docId, success: false, error: error?.message || 'Unknown error' });
          }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        const fmt = params.response_format || ResponseFormat.MARKDOWN;
        if (fmt === ResponseFormat.MARKDOWN) {
          const lines = [`## Bulk Update Results`, '', `- **Total:** ${results.length}`, `- **Successful:** ${successful}`, `- **Failed:** ${failed}`];
          if (failed > 0) {
            lines.push('', '**Failures:**');
            results.filter(r => !r.success).forEach(r => lines.push(`- ${r.id}: ${r.error}`));
          }
          return lines.join('\n');
        }
        return JSON.stringify({ totalProcessed: results.length, successful, failed, results }, null, 2);
      }
    },

    {
      name: 'bulk_lifecycle_action',
      description: `Perform lifecycle action on multiple documents.

**Parameters:**
- documentIds (required): Array of document IDs
- action (required): Action (e.g., "APPROVE", "SUBMIT")
- comment: Action comment

**Example:** { "documentIds": ["123", "456"], "action": "APPROVE" }`,
      inputSchema: {
        type: 'object',
        properties: {
          documentIds: { type: 'array', items: { type: 'string' }, description: 'Document IDs' },
          action: { type: 'string', description: 'Lifecycle action' },
          comment: { type: 'string', description: 'Action comment' },
          ...FORMAT_SCHEMA_PROPS
        },
        required: ['documentIds', 'action']
      },
      annotations: { title: 'Bulk Lifecycle Action', ...WRITE_OP },
      handler: async (params: any) => {
        const results: Array<{ id: string; success: boolean; error?: string }> = [];

        for (const docId of params.documentIds) {
          try {
            await this.api.post(`${apiEndpoints.documents}('${docId}')/lifecycleAction`, {
              action: params.action,
              comment: params.comment || ''
            });
            results.push({ id: docId, success: true });
          } catch (error: any) {
            results.push({ id: docId, success: false, error: error?.message || 'Unknown error' });
          }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        const fmt = params.response_format || ResponseFormat.MARKDOWN;
        if (fmt === ResponseFormat.MARKDOWN) {
          const lines = [`## Bulk ${params.action} Results`, '', `- **Total:** ${results.length}`, `- **Successful:** ${successful}`, `- **Failed:** ${failed}`];
          if (failed > 0) {
            lines.push('', '**Failures:**');
            results.filter(r => !r.success).forEach(r => lines.push(`- ${r.id}: ${r.error}`));
          }
          return lines.join('\n');
        }
        return JSON.stringify({ action: params.action, totalProcessed: results.length, successful, failed, results }, null, 2);
      }
    }
  ];
}
