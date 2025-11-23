/**
 * @fileoverview Response Formatter Utilities for Token-Efficient MCP Responses
 *
 * This module provides utilities for formatting Windchill API responses in a
 * token-efficient manner for LLM consumption. It supports multiple output formats
 * (markdown/JSON), detail levels (concise/detailed), pagination, and truncation.
 *
 * Key features:
 * - Response format options (markdown for human-readable, JSON for programmatic)
 * - Detail levels (concise for token efficiency, detailed for complete data)
 * - Pagination metadata (has_more, next_offset, total_count)
 * - Character limit enforcement with graceful truncation
 * - Field selection for reducing response size
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum characters in a response before truncation */
export const CHARACTER_LIMIT = 25000;

/** Default number of items to return */
export const DEFAULT_LIMIT = 20;

/** Maximum allowed limit to prevent overwhelming responses */
export const MAX_LIMIT = 100;

/** Default fields to include in concise part responses */
export const PART_CONCISE_FIELDS = ['Number', 'Name', 'Type', 'State', 'Version'] as const;

/** Default fields to include in concise document responses */
export const DOCUMENT_CONCISE_FIELDS = ['Number', 'Name', 'Type', 'State', 'Version'] as const;

/** Default fields to include in concise change responses */
export const CHANGE_CONCISE_FIELDS = ['Number', 'Name', 'Type', 'State', 'Priority'] as const;

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Response format options
 * - markdown: Human-readable formatted text (default, token-efficient)
 * - json: Machine-readable structured data (complete)
 */
export enum ResponseFormat {
  MARKDOWN = 'markdown',
  JSON = 'json'
}

/**
 * Detail level options
 * - concise: Essential fields only (token-efficient, default)
 * - detailed: All available fields
 */
export enum DetailLevel {
  CONCISE = 'concise',
  DETAILED = 'detailed'
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Standard pagination parameters for list operations
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Standard response format parameters
 */
export interface FormatParams {
  response_format?: ResponseFormat | string;
  detail_level?: DetailLevel | string;
}

/**
 * Combined standard parameters for all list/search tools
 */
export interface StandardToolParams extends PaginationParams, FormatParams {}

/**
 * Pagination metadata included in responses
 */
export interface PaginationMetadata {
  total: number;
  count: number;
  offset: number;
  limit: number;
  has_more: boolean;
  next_offset?: number;
}

/**
 * Standard response structure for list operations
 */
export interface FormattedResponse<T = unknown> {
  data: T[];
  pagination: PaginationMetadata;
  truncated?: boolean;
  truncation_message?: string;
}

/**
 * Tool annotation hints for MCP clients
 */
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

// ============================================================================
// PAGINATION UTILITIES
// ============================================================================

/**
 * Normalize and validate pagination parameters
 *
 * @param params - Raw pagination parameters from tool input
 * @returns Normalized pagination with defaults applied
 */
export function normalizePagination(params: PaginationParams): Required<PaginationParams> {
  const limit = Math.min(Math.max(1, params.limit || DEFAULT_LIMIT), MAX_LIMIT);
  const offset = Math.max(0, params.offset || 0);
  return { limit, offset };
}

/**
 * Build pagination metadata from response data
 *
 * @param total - Total number of items available
 * @param items - Items in current response
 * @param offset - Current offset
 * @param limit - Current limit
 * @returns Pagination metadata object
 */
export function buildPaginationMetadata(
  total: number,
  items: unknown[],
  offset: number,
  limit: number
): PaginationMetadata {
  const count = items.length;
  const has_more = offset + count < total;

  return {
    total,
    count,
    offset,
    limit,
    has_more,
    ...(has_more ? { next_offset: offset + count } : {})
  };
}

/**
 * Build OData query parameters for pagination
 *
 * @param params - Pagination parameters
 * @returns URLSearchParams with $top and $skip
 */
export function buildODataPagination(params: PaginationParams): URLSearchParams {
  const { limit, offset } = normalizePagination(params);
  const queryParams = new URLSearchParams();

  queryParams.append('$top', limit.toString());
  if (offset > 0) {
    queryParams.append('$skip', offset.toString());
  }
  // Request count for pagination metadata
  queryParams.append('$count', 'true');

  return queryParams;
}

// ============================================================================
// RESPONSE FORMATTING
// ============================================================================

/**
 * Extract items from Windchill OData response
 *
 * @param response - Raw Windchill API response
 * @returns Array of items and total count
 */
export function extractODataItems(response: unknown): { items: Record<string, unknown>[]; total: number } {
  if (!response || typeof response !== 'object') {
    return { items: [], total: 0 };
  }

  const data = response as Record<string, unknown>;

  // Handle OData collection response
  if (Array.isArray(data.value)) {
    const total = typeof data['@odata.count'] === 'number'
      ? data['@odata.count']
      : data.value.length;
    return { items: data.value, total };
  }

  // Handle single item response
  if (data.ID || data.Number || data.Name) {
    return { items: [data], total: 1 };
  }

  return { items: [], total: 0 };
}

/**
 * Select specific fields from an object
 *
 * @param item - Source object
 * @param fields - Fields to include
 * @returns Object with only selected fields
 */
export function selectFields<T extends Record<string, unknown>>(
  item: T,
  fields: readonly string[]
): Partial<T> {
  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in item) {
      result[field as keyof T] = item[field as keyof T];
    }
  }
  return result;
}

/**
 * Format items based on detail level
 *
 * @param items - Raw items from API
 * @param detailLevel - Concise or detailed
 * @param conciseFields - Fields to include in concise mode
 * @returns Formatted items
 */
export function formatItems<T extends Record<string, unknown>>(
  items: T[],
  detailLevel: DetailLevel | string,
  conciseFields: readonly string[]
): Partial<T>[] | T[] {
  if (detailLevel === DetailLevel.DETAILED) {
    return items;
  }

  return items.map(item => selectFields(item, conciseFields));
}

// ============================================================================
// MARKDOWN FORMATTING
// ============================================================================

/**
 * Format items as a markdown table
 *
 * @param items - Items to format
 * @param columns - Column definitions (field name -> display name)
 * @returns Markdown table string
 */
export function formatMarkdownTable(
  items: Record<string, unknown>[],
  columns: Record<string, string>
): string {
  if (items.length === 0) {
    return '*No items found*';
  }

  const columnKeys = Object.keys(columns);
  const headers = Object.values(columns);

  // Build header row
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

  // Build data rows
  const dataRows = items.map(item => {
    const values = columnKeys.map(key => {
      const value = item[key];
      if (value === null || value === undefined) return '-';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });
    return `| ${values.join(' | ')} |`;
  });

  return [headerRow, separatorRow, ...dataRows].join('\n');
}

/**
 * Format pagination info as markdown footer
 *
 * @param pagination - Pagination metadata
 * @returns Markdown string with pagination info
 */
export function formatPaginationMarkdown(pagination: PaginationMetadata): string {
  const lines: string[] = [];

  lines.push(`\n*Showing ${pagination.count} of ${pagination.total} items (offset: ${pagination.offset})*`);

  if (pagination.has_more) {
    lines.push(`\n> **More results available.** Use \`offset: ${pagination.next_offset}\` to see next page.`);
  }

  return lines.join('');
}

// ============================================================================
// TRUNCATION
// ============================================================================

/**
 * Check if response needs truncation and truncate if necessary
 *
 * @param response - Response object or string
 * @param items - Original items array (for truncation by items)
 * @returns Truncated response with metadata
 */
export function applyTruncation<T>(
  response: string,
  items: T[]
): { content: string; truncated: boolean; truncation_message?: string; truncatedItems?: T[] } {
  if (response.length <= CHARACTER_LIMIT) {
    return { content: response, truncated: false };
  }

  // Calculate how many items we can fit
  const avgItemSize = response.length / items.length;
  const targetItems = Math.max(1, Math.floor(CHARACTER_LIMIT / avgItemSize * 0.8)); // 80% to be safe

  const truncatedItems = items.slice(0, targetItems);
  const truncation_message =
    `Response truncated from ${items.length} to ${truncatedItems.length} items ` +
    `(exceeded ${CHARACTER_LIMIT} character limit). ` +
    `Use 'limit' and 'offset' parameters or add filters to see more results.`;

  return {
    content: '', // Caller should regenerate with truncated items
    truncated: true,
    truncation_message,
    truncatedItems
  };
}

// ============================================================================
// COMPLETE RESPONSE BUILDER
// ============================================================================

/**
 * Build a complete, token-efficient response for list operations
 *
 * @param rawResponse - Raw Windchill API response
 * @param params - Tool parameters including format options
 * @param options - Additional formatting options
 * @returns Formatted response string
 */
export function buildListResponse(
  rawResponse: unknown,
  params: StandardToolParams,
  options: {
    title: string;
    conciseFields: readonly string[];
    markdownColumns: Record<string, string>;
  }
): string {
  const { limit, offset } = normalizePagination(params);
  const responseFormat = (params.response_format || ResponseFormat.MARKDOWN) as ResponseFormat;
  const detailLevel = (params.detail_level || DetailLevel.CONCISE) as DetailLevel;

  // Extract items from OData response
  const { items, total } = extractODataItems(rawResponse);

  // Build pagination metadata
  const pagination = buildPaginationMetadata(total, items, offset, limit);

  // Format items based on detail level
  const formattedItems = formatItems(items, detailLevel, options.conciseFields);

  // Generate response based on format
  let response: string;

  if (responseFormat === ResponseFormat.MARKDOWN) {
    const lines: string[] = [];
    lines.push(`## ${options.title}`);
    lines.push('');
    lines.push(formatMarkdownTable(formattedItems as Record<string, unknown>[], options.markdownColumns));
    lines.push(formatPaginationMarkdown(pagination));
    response = lines.join('\n');
  } else {
    // JSON format
    const jsonResponse: FormattedResponse = {
      data: formattedItems,
      pagination
    };
    response = JSON.stringify(jsonResponse, null, 2);
  }

  // Apply truncation if needed
  const truncationResult = applyTruncation(response, formattedItems);

  if (truncationResult.truncated && truncationResult.truncatedItems) {
    // Regenerate response with truncated items
    const truncatedPagination = buildPaginationMetadata(total, truncationResult.truncatedItems, offset, limit);

    if (responseFormat === ResponseFormat.MARKDOWN) {
      const lines: string[] = [];
      lines.push(`## ${options.title}`);
      lines.push('');
      lines.push(`> **Note:** ${truncationResult.truncation_message}`);
      lines.push('');
      lines.push(formatMarkdownTable(truncationResult.truncatedItems as Record<string, unknown>[], options.markdownColumns));
      lines.push(formatPaginationMarkdown(truncatedPagination));
      return lines.join('\n');
    } else {
      const jsonResponse: FormattedResponse = {
        data: truncationResult.truncatedItems,
        pagination: truncatedPagination,
        truncated: true,
        truncation_message: truncationResult.truncation_message
      };
      return JSON.stringify(jsonResponse, null, 2);
    }
  }

  return response;
}

/**
 * Build a response for single item operations (get, create, update)
 *
 * @param rawResponse - Raw Windchill API response
 * @param params - Tool parameters including format options
 * @param options - Additional formatting options
 * @returns Formatted response string
 */
export function buildSingleItemResponse(
  rawResponse: unknown,
  params: FormatParams,
  options: {
    title: string;
    conciseFields: readonly string[];
  }
): string {
  const responseFormat = (params.response_format || ResponseFormat.MARKDOWN) as ResponseFormat;
  const detailLevel = (params.detail_level || DetailLevel.CONCISE) as DetailLevel;

  if (!rawResponse || typeof rawResponse !== 'object') {
    return responseFormat === ResponseFormat.MARKDOWN
      ? '*No data returned*'
      : JSON.stringify({ error: 'No data returned' });
  }

  const item = rawResponse as Record<string, unknown>;
  const formattedItem = detailLevel === DetailLevel.DETAILED
    ? item
    : selectFields(item, options.conciseFields);

  if (responseFormat === ResponseFormat.MARKDOWN) {
    const lines: string[] = [];
    lines.push(`## ${options.title}`);
    lines.push('');

    for (const [key, value] of Object.entries(formattedItem)) {
      if (value !== null && value !== undefined) {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        lines.push(`- **${key}**: ${displayValue}`);
      }
    }

    return lines.join('\n');
  } else {
    return JSON.stringify(formattedItem, null, 2);
  }
}

// ============================================================================
// ERROR RESPONSE BUILDER
// ============================================================================

/**
 * Build a standardized error response
 *
 * @param error - Error object or message
 * @param context - Additional context for the error
 * @returns Formatted error response
 */
export function buildErrorResponse(
  error: unknown,
  context?: {
    operation?: string;
    suggestion?: string;
  }
): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  const lines: string[] = [];
  lines.push(`**Error${context?.operation ? ` in ${context.operation}` : ''}:** ${errorMessage}`);

  if (context?.suggestion) {
    lines.push('');
    lines.push(`> **Suggestion:** ${context.suggestion}`);
  }

  return lines.join('\n');
}

// ============================================================================
// FILTER BUILDING UTILITIES
// ============================================================================

/**
 * Build OData filter for text field with wildcard support
 *
 * @param fieldName - OData field name
 * @param value - Filter value (may contain * wildcards)
 * @returns OData filter expression
 */
export function buildTextFilter(fieldName: string, value: string): string {
  if (!value.includes('*')) {
    // Exact match
    return `${fieldName} eq '${escapeODataString(value)}'`;
  }

  const cleanValue = value.replace(/\*/g, '');
  const escapedValue = escapeODataString(cleanValue);

  if (value.endsWith('*') && !value.startsWith('*')) {
    // Prefix match: "abc*"
    return `startswith(${fieldName},'${escapedValue}')`;
  } else if (value.startsWith('*') && !value.endsWith('*')) {
    // Suffix match: "*abc"
    return `endswith(${fieldName},'${escapedValue}')`;
  } else {
    // Contains match: "*abc*" or "*abc" or "abc*"
    return `contains(${fieldName},'${escapedValue}')`;
  }
}

/**
 * Escape special characters in OData string values
 *
 * @param value - Raw string value
 * @returns Escaped string safe for OData queries
 */
export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Combine multiple OData filters with AND
 *
 * @param filters - Array of filter expressions
 * @returns Combined filter string
 */
export function combineFilters(filters: string[]): string {
  return filters.filter(f => f).join(' and ');
}

// ============================================================================
// STANDARD INPUT SCHEMA FRAGMENTS
// ============================================================================

/**
 * Standard pagination schema properties
 */
export const PAGINATION_SCHEMA_PROPS = {
  limit: {
    type: 'number',
    description: `Maximum results to return (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})`,
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT
  },
  offset: {
    type: 'number',
    description: 'Number of results to skip for pagination (default: 0)',
    minimum: 0,
    default: 0
  }
} as const;

/**
 * Standard response format schema properties
 */
export const FORMAT_SCHEMA_PROPS = {
  response_format: {
    type: 'string',
    enum: ['markdown', 'json'],
    description: "Output format: 'markdown' (default, token-efficient) or 'json' (complete data)",
    default: 'markdown'
  },
  detail_level: {
    type: 'string',
    enum: ['concise', 'detailed'],
    description: "Detail level: 'concise' (default, essential fields) or 'detailed' (all fields)",
    default: 'concise'
  }
} as const;

/**
 * Combined standard schema properties for list/search tools
 */
export const STANDARD_LIST_SCHEMA_PROPS = {
  ...PAGINATION_SCHEMA_PROPS,
  ...FORMAT_SCHEMA_PROPS
} as const;
