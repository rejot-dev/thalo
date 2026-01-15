/**
 * Query command - executes a query on a workspace and returns structured results.
 */

import type { Workspace } from "../model/workspace.js";
import type { Query, QueryCondition } from "../services/query.js";
import type { InstanceEntry } from "../ast/ast-types.js";
import {
  parseQueryString as parseQueryStringService,
  validateQueryEntities,
  executeQueries,
  formatQuery,
} from "../services/query.js";
import { findEntryFile, getEntrySourceText } from "../services/synthesis.js";
import { formatTimestamp } from "../formatters.js";

// Re-export parseQueryString from service for backward compatibility
export { parseQueryString } from "../services/query.js";

// ===================
// Types
// ===================

/**
 * Information about a condition in a query.
 */
export interface QueryConditionInfo {
  kind: QueryCondition["kind"];
  /** For field conditions */
  field?: string;
  value?: string;
  /** For tag conditions */
  tag?: string;
  /** For link conditions */
  link?: string;
}

/**
 * Information about an entry that matched a query.
 */
export interface QueryEntryInfo {
  /** File path containing the entry */
  file: string;
  /** Formatted timestamp string */
  timestamp: string;
  /** Entity type (e.g., "lore", "opinion") */
  entity: string;
  /** Entry title */
  title: string;
  /** Link ID if present */
  linkId: string | null;
  /** Tags on the entry */
  tags: string[];
  /** 1-based start line */
  startLine: number;
  /** 1-based end line */
  endLine: number;
  /** Raw source text of the entry (optional, for "raw" format) */
  rawText?: string;
}

/**
 * Result of running the query command (single query).
 */
export interface QueryResult {
  /** The parsed query */
  query: Query;
  /** Formatted query string for display */
  queryString: string;
  /** Matching entries */
  entries: QueryEntryInfo[];
  /** Total count (may be more than entries.length if limited) */
  totalCount: number;
}

/**
 * Result of running queries (multiple queries).
 */
export interface QueriesResult {
  /** The parsed queries */
  queries: Query[];
  /** Formatted query string for display */
  queryString: string;
  /** Matching entries (deduplicated across all queries) */
  entries: QueryEntryInfo[];
  /** Total count (may be more than entries.length if limited) */
  totalCount: number;
}

/**
 * Error result when queries reference unknown entities.
 */
export interface QueryValidationError {
  kind: "unknown-entities";
  /** The unknown entity names */
  entities: string[];
  /** Human-readable error message */
  message: string;
}

/**
 * Options for running the query command.
 */
export interface RunQueryOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Include raw source text in results */
  includeRawText?: boolean;
  /** Whether to validate that queried entities exist (default: true) */
  validateEntities?: boolean;
}

/**
 * Convert an InstanceEntry to QueryEntryInfo.
 */
function toQueryEntryInfo(
  entry: InstanceEntry,
  file: string,
  workspace: Workspace,
  includeRawText: boolean,
): QueryEntryInfo {
  const info: QueryEntryInfo = {
    file,
    timestamp: formatTimestamp(entry.header.timestamp),
    entity: entry.header.entity,
    title: entry.header.title.value,
    linkId: entry.header.link?.id ?? null,
    tags: entry.header.tags.map((t) => t.name),
    startLine: entry.location.startPosition.row + 1,
    endLine: entry.location.endPosition.row + 1,
  };

  if (includeRawText) {
    const model = workspace.getModel(file);
    if (model) {
      info.rawText = getEntrySourceText(entry, model.source);
    }
  }

  return info;
}

/**
 * Run multiple queries on a workspace.
 * Supports comma-separated query syntax like "lore, journal where #career".
 *
 * @param workspace - The workspace to query
 * @param queryString - The query string to parse and execute (may contain multiple queries)
 * @param options - Query options
 * @returns Structured query results, validation error, or null if query syntax is invalid
 */
export function runQueries(
  workspace: Workspace,
  queryString: string,
  options: RunQueryOptions = {},
): QueriesResult | QueryValidationError | null {
  const { limit, includeRawText = false, validateEntities = true } = options;

  // Parse the queries
  const queries = parseQueryStringService(queryString);
  if (!queries) {
    return null;
  }

  // Validate entity names if requested
  if (validateEntities) {
    const unknownEntities = validateQueryEntities(workspace, queries);
    if (unknownEntities.length > 0) {
      return {
        kind: "unknown-entities",
        entities: unknownEntities,
        message: `Unknown entity type${unknownEntities.length > 1 ? "s" : ""}: ${unknownEntities.map((e) => `'${e}'`).join(", ")}. Define ${unknownEntities.length > 1 ? "them" : "it"} using 'define-entity'.`,
      };
    }
  }

  // Execute all queries
  const results = executeQueries(workspace, queries);

  // Convert to QueryEntryInfo
  const entries: QueryEntryInfo[] = [];
  const limitedResults = limit && limit > 0 ? results.slice(0, limit) : results;

  for (const entry of limitedResults) {
    const file = findEntryFile(workspace, entry);
    if (file) {
      entries.push(toQueryEntryInfo(entry, file, workspace, includeRawText));
    }
  }

  return {
    queries,
    queryString: queries.map(formatQuery).join(", "),
    entries,
    totalCount: results.length,
  };
}

/**
 * Run the query command on a workspace.
 * For backward compatibility, this only supports a single query.
 * Use `runQueries` for multiple queries or comma-separated syntax.
 *
 * @param workspace - The workspace to query
 * @param queryString - The query string to parse and execute
 * @param options - Query options
 * @returns Structured query results, validation error, or null if query is invalid
 */
export function runQuery(
  workspace: Workspace,
  queryString: string,
  options: RunQueryOptions = {},
): QueryResult | QueryValidationError | null {
  const result = runQueries(workspace, queryString, options);

  if (!result) {
    return null;
  }

  // Return validation errors as-is
  if ("kind" in result) {
    return result;
  }

  // For backward compatibility, return single query format
  // If multiple queries were parsed, use the first one
  return {
    query: result.queries[0],
    queryString: result.queryString,
    entries: result.entries,
    totalCount: result.totalCount,
  };
}

/**
 * Type guard to check if a query result is a validation error.
 */
export function isQueryValidationError(
  result: QueryResult | QueriesResult | QueryValidationError | null,
): result is QueryValidationError {
  return result !== null && "kind" in result && result.kind === "unknown-entities";
}
