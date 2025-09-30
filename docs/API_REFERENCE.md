# Windchill MCP Server API Reference

## Overview

This document provides comprehensive API reference for all tools available in the Windchill MCP Server. The server provides 42+ tools across 5 specialized agents, each designed to handle specific Windchill PLM operations.

## API Conventions

### Tool Naming Convention
All tools follow the pattern: `{agentName}_{toolName}`

Examples:
- `part_search` (PartAgent → search tool)
- `document_create` (DocumentAgent → create tool)
- `change_get` (ChangeAgent → get tool)

### Request Format (MCP JSON-RPC 2.0)
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      "param1": "value1",
      "param2": "value2"
    }
  }
}
```

### Response Format
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "JSON formatted result"
      }
    ]
  }
}
```

## Part Agent Tools (4 tools)

### `part_search`
Search for parts in Windchill by various criteria.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "number": {
      "type": "string",
      "description": "Part number to search for"
    },
    "name": {
      "type": "string",
      "description": "Part name to search for"
    },
    "state": {
      "type": "string",
      "description": "Part lifecycle state"
    }
  },
  "required": []
}
```

**Example Request:**
```json
{
  "name": "part_search",
  "arguments": {
    "number": "P12345",
    "state": "RELEASED"
  }
}
```

**Response:**
Returns OData collection of matching parts with metadata.

### `part_get`
Retrieve detailed information for a specific part by ID.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique part identifier"
    }
  },
  "required": ["id"]
}
```

### `part_create`
Create a new part in Windchill.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "number": {
      "type": "string",
      "description": "Part number"
    },
    "name": {
      "type": "string",
      "description": "Part name"
    },
    "description": {
      "type": "string",
      "description": "Part description"
    }
  },
  "required": ["number", "name"]
}
```

### `part_get_structure`
Get BOM structure for a part with configurable depth.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Part ID"
    },
    "levels": {
      "type": "number",
      "description": "Number of BOM levels to retrieve"
    }
  },
  "required": ["id"]
}
```

## Document Agent Tools (25 tools) ⭐

The Document Agent is the most comprehensive agent, providing tools across three priority tiers:

### Core Lifecycle Tools (Priority 1)

#### `document_search`
Search for documents by number, name, or type.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "number": {
      "type": "string",
      "description": "Document number (e.g., 'DOC-123', 'SPEC-001')"
    },
    "name": {
      "type": "string",
      "description": "Document name (e.g., 'User Manual', 'Technical Specification')"
    },
    "type": {
      "type": "string",
      "description": "Document type (e.g., 'CAD', 'SPEC', 'MANUAL')"
    }
  },
  "required": []
}
```

#### `document_get`
Retrieve detailed information for a specific document.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier (UUID or Windchill internal ID)"
    }
  },
  "required": ["id"]
}
```

#### `document_get_attributes`
Retrieve all attributes for a specific document.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "objectId": {
      "type": "string",
      "description": "Unique document object identifier"
    },
    "expand": {
      "type": "string",
      "description": "Optional: Comma-separated list of properties to expand"
    }
  },
  "required": ["objectId"]
}
```

#### `document_create`
Create a new document in Windchill.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "number": {
      "type": "string",
      "description": "Document number (e.g., 'DOC-123', 'SPEC-001')"
    },
    "name": {
      "type": "string",
      "description": "Document name/title"
    },
    "type": {
      "type": "string",
      "description": "Document type (e.g., 'CAD', 'SPEC', 'MANUAL')"
    },
    "description": {
      "type": "string",
      "description": "Document description"
    },
    "container": {
      "type": "string",
      "description": "Container/context where document should be created"
    },
    "folder": {
      "type": "string",
      "description": "Folder path where document should be placed"
    }
  },
  "required": ["number", "name", "type"]
}
```

#### `document_update`
Update document metadata and properties.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    },
    "name": {
      "type": "string",
      "description": "Updated document name"
    },
    "description": {
      "type": "string",
      "description": "Updated document description"
    },
    "attributes": {
      "type": "object",
      "description": "Custom attributes to update (key-value pairs)"
    }
  },
  "required": ["id"]
}
```

#### `document_checkout`
Check out a document for editing.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    },
    "comment": {
      "type": "string",
      "description": "Optional checkout comment"
    }
  },
  "required": ["id"]
}
```

#### `document_checkin`
Check in a document after editing.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    },
    "comment": {
      "type": "string",
      "description": "Check-in comment describing changes"
    }
  },
  "required": ["id"]
}
```

#### `document_revise`
Create a new revision of an existing document.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    },
    "comment": {
      "type": "string",
      "description": "Revision comment"
    }
  },
  "required": ["id"]
}
```

### Version Management Tools

#### `document_get_version_history`
Retrieve complete version and iteration history.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    }
  },
  "required": ["id"]
}
```

#### `document_get_iterations`
Get all iterations for a specific version.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    },
    "version": {
      "type": "string",
      "description": "Version identifier (e.g., 'A', 'B', '1')"
    }
  },
  "required": ["id", "version"]
}
```

#### `document_set_iteration_note`
Add or update a note for a specific document iteration.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    },
    "iteration": {
      "type": "string",
      "description": "Iteration identifier (e.g., 'A.1', 'B.2')"
    },
    "note": {
      "type": "string",
      "description": "Note content to add to the iteration"
    }
  },
  "required": ["id", "iteration", "note"]
}
```

### Content Management Tools (Priority 2)

#### `document_upload_content`
Upload primary content file to a document.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    },
    "filePath": {
      "type": "string",
      "description": "Local file path to upload"
    },
    "fileName": {
      "type": "string",
      "description": "Name for the uploaded file"
    },
    "description": {
      "type": "string",
      "description": "Description of the content"
    }
  },
  "required": ["id", "filePath", "fileName"]
}
```

#### `document_download_content`
Download primary content from a document.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    },
    "fileName": {
      "type": "string",
      "description": "Name for the downloaded file"
    }
  },
  "required": ["id"]
}
```

#### `document_get_content_info`
Get metadata about document content and attachments.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    }
  },
  "required": ["id"]
}
```

### Attachment Management Tools

#### `document_add_attachment`
Add a file attachment to a document.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    },
    "filePath": {
      "type": "string",
      "description": "Local file path to attach"
    },
    "fileName": {
      "type": "string",
      "description": "Name for the attachment"
    },
    "description": {
      "type": "string",
      "description": "Description of the attachment"
    }
  },
  "required": ["id", "filePath", "fileName"]
}
```

#### `document_get_attachments`
List all attachments for a document.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    }
  },
  "required": ["id"]
}
```

#### `document_download_attachment`
Download a specific attachment from a document.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    },
    "attachmentId": {
      "type": "string",
      "description": "Unique attachment identifier"
    },
    "fileName": {
      "type": "string",
      "description": "Name for the downloaded file"
    }
  },
  "required": ["id", "attachmentId"]
}
```

### Reference Management Tools

#### `document_add_reference`
Create a reference link between documents.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "sourceId": {
      "type": "string",
      "description": "Source document identifier"
    },
    "targetId": {
      "type": "string",
      "description": "Target document identifier"
    },
    "referenceType": {
      "type": "string",
      "description": "Type of reference (e.g., 'RELATED', 'REFERENCE', 'DEPENDS_ON')"
    },
    "description": {
      "type": "string",
      "description": "Description of the reference relationship"
    }
  },
  "required": ["sourceId", "targetId", "referenceType"]
}
```

#### `document_get_references`
Get all documents referenced by this document.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    }
  },
  "required": ["id"]
}
```

#### `document_get_referencing`
Get all documents that reference this document.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier"
    }
  },
  "required": ["id"]
}
```

#### `document_remove_reference`
Remove a reference link between documents.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "sourceId": {
      "type": "string",
      "description": "Source document identifier"
    },
    "targetId": {
      "type": "string",
      "description": "Target document identifier"
    },
    "referenceType": {
      "type": "string",
      "description": "Type of reference to remove"
    }
  },
  "required": ["sourceId", "targetId"]
}
```

### Advanced Search Tools (Priority 3)

#### `document_advanced_search`
Advanced multi-criteria document search with date ranges and lifecycle states.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "number": {
      "type": "string",
      "description": "Document number filter"
    },
    "name": {
      "type": "string",
      "description": "Document name filter (partial match)"
    },
    "type": {
      "type": "string",
      "description": "Document type filter"
    },
    "lifecycleState": {
      "type": "string",
      "description": "Lifecycle state filter"
    },
    "creator": {
      "type": "string",
      "description": "Created by user filter"
    },
    "createdAfter": {
      "type": "string",
      "description": "Created after date (ISO format)"
    },
    "createdBefore": {
      "type": "string",
      "description": "Created before date (ISO format)"
    },
    "modifiedAfter": {
      "type": "string",
      "description": "Modified after date (ISO format)"
    },
    "modifiedBefore": {
      "type": "string",
      "description": "Modified before date (ISO format)"
    },
    "container": {
      "type": "string",
      "description": "Container filter"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results to return"
    }
  },
  "required": []
}
```

#### `document_search_by_creator`
Search for documents by creator or modifier.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "creator": {
      "type": "string",
      "description": "Username of the document creator"
    },
    "modifier": {
      "type": "string",
      "description": "Username of the last modifier"
    },
    "createdAfter": {
      "type": "string",
      "description": "Created after date (ISO format)"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results to return"
    }
  },
  "required": []
}
```

#### `document_search_by_lifecycle`
Search for documents by lifecycle state.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "state": {
      "type": "string",
      "description": "Lifecycle state to search for"
    },
    "container": {
      "type": "string",
      "description": "Container filter"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results to return"
    }
  },
  "required": ["state"]
}
```

#### `document_search_by_date_range`
Search for documents within a specific date range.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "startDate": {
      "type": "string",
      "description": "Start date for search (ISO format)"
    },
    "endDate": {
      "type": "string",
      "description": "End date for search (ISO format)"
    },
    "dateField": {
      "type": "string",
      "description": "Date field to search by (CreatedOn, ModifiedOn)",
      "enum": ["CreatedOn", "ModifiedOn"]
    },
    "type": {
      "type": "string",
      "description": "Document type filter"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results to return"
    }
  },
  "required": ["startDate", "endDate", "dateField"]
}
```

#### `document_search_related`
Find documents related to a specific document through references.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Source document identifier"
    },
    "relationshipType": {
      "type": "string",
      "description": "Type of relationship to follow"
    },
    "direction": {
      "type": "string",
      "description": "Direction to search (references, referencing, both)",
      "enum": ["references", "referencing", "both"]
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results to return"
    }
  },
  "required": ["id"]
}
```

### Bulk Operations Tools (Priority 3)

#### `document_bulk_update`
Update multiple documents with the same changes.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "documentIds": {
      "type": "array",
      "description": "Array of document identifiers to update",
      "items": {
        "type": "string"
      }
    },
    "updates": {
      "type": "object",
      "description": "Fields to update on all documents"
    },
    "filter": {
      "type": "object",
      "description": "Optional filter to select documents for bulk update"
    }
  },
  "required": ["updates"]
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "doc-id",
      "success": true,
      "data": { /* updated document data */ }
    }
  ],
  "totalProcessed": 10,
  "successful": 8,
  "failed": 2
}
```

#### `document_bulk_lifecycle_action`
Perform lifecycle actions on multiple documents.

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "documentIds": {
      "type": "array",
      "description": "Array of document identifiers",
      "items": {
        "type": "string"
      }
    },
    "action": {
      "type": "string",
      "description": "Lifecycle action to perform (e.g., 'APPROVE', 'REJECT', 'SUBMIT')"
    },
    "comment": {
      "type": "string",
      "description": "Comment for the lifecycle action"
    },
    "filter": {
      "type": "object",
      "description": "Optional filter to select documents"
    }
  },
  "required": ["action"]
}
```

## Change Agent Tools

### `change_search`
Search for change requests by various criteria.

### `change_get`
Get detailed change request information.

### `change_create`
Create new change requests.

### `change_update`
Update change request properties.

## Workflow Agent Tools

### `workflow_search`
Search for workflow items.

### `workflow_get`
Get workflow item details.

### `workflow_complete`
Complete workflow tasks.

## Project Agent Tools

### `project_search`
Search for projects.

### `project_get`
Get project details.

### `project_create`
Create new projects.

## Error Handling

### Standard Error Response
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "error": {
    "code": -32603,
    "message": "Detailed error message",
    "data": {
      "details": "Additional error context"
    }
  }
}
```

### Common Error Codes
- `-32700`: Parse error
- `-32600`: Invalid Request
- `-32601`: Method not found (tool not found)
- `-32602`: Invalid params
- `-32603`: Internal error

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid JSON-RPC)
- `401`: Unauthorized (Windchill authentication failed)
- `404`: Not Found (tool not found)
- `500`: Internal Server Error

## Rate Limiting & Performance

### Recommended Usage Patterns
- **Batch Operations**: Use bulk tools when updating multiple items
- **Pagination**: Use `limit` parameters for large result sets
- **Filtering**: Use specific filters to reduce data transfer
- **Caching**: Cache frequently accessed data client-side

### Performance Considerations
- Document searches with broad criteria may be slow
- File uploads/downloads have size limitations
- Bulk operations are processed sequentially

## Authentication & Security

### Required Environment Variables
```env
WINDCHILL_URL=http://your-windchill-server/Windchill
WINDCHILL_USER=your-username
WINDCHILL_PASSWORD=your-password
```

### Security Features
- Basic Authentication with Base64 encoding
- HTTPS support (when configured)
- Session management per request
- Input validation via JSON Schema
- Comprehensive logging for audit trails

## Usage Examples

### Basic Document Search
```json
{
  "jsonrpc": "2.0",
  "id": "req_001",
  "method": "tools/call",
  "params": {
    "name": "document_search",
    "arguments": {
      "name": "specification"
    }
  }
}
```

### Advanced Document Search with Date Range
```json
{
  "jsonrpc": "2.0",
  "id": "req_002",
  "method": "tools/call",
  "params": {
    "name": "document_advanced_search",
    "arguments": {
      "type": "SPEC",
      "lifecycleState": "RELEASED",
      "createdAfter": "2024-01-01T00:00:00Z",
      "createdBefore": "2024-12-31T23:59:59Z",
      "limit": 50
    }
  }
}
```

### Create New Document
```json
{
  "jsonrpc": "2.0",
  "id": "req_003",
  "method": "tools/call",
  "params": {
    "name": "document_create",
    "arguments": {
      "number": "DOC-2024-001",
      "name": "Product Specification",
      "type": "SPEC",
      "description": "Technical specification for new product",
      "container": "Product Development"
    }
  }
}
```

### Bulk Update Documents
```json
{
  "jsonrpc": "2.0",
  "id": "req_004",
  "method": "tools/call",
  "params": {
    "name": "document_bulk_update",
    "arguments": {
      "documentIds": ["doc1", "doc2", "doc3"],
      "updates": {
        "Description": "Updated by bulk operation",
        "CustomAttribute": "NewValue"
      }
    }
  }
}
```

This API reference provides comprehensive documentation for integrating with the Windchill MCP Server and utilizing its extensive tool set for PLM operations.