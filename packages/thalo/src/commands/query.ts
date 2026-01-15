/**
 * Query command - executes a query on a workspace and returns structured results.
 */

import type { Workspace } from "../model/workspace.js";
import type { Query, QueryCondition } from "../services/query.js";
import type { InstanceEntry, Timestamp } from "../ast/ast-types.js";
import {
  parseQueryString as parseQueryStringService,
  validateQueryEntities,
  executeQueries,
  formatQuery,
} from "../services/query.js";
import { findEntryFile, getEntrySourceText } from "../services/synthesis.js";
import { formatTimestamp } from "../formatters.js";
import {
  parseCheckpoint,
  type ChangeMarker,
  type ChangeTracker,
} from "../services/change-tracker/change-tracker.js";

/**
 * Convert a timestamp to epoch milliseconds for correct comparison across timezones
 */
function timestampToEpoch(ts: Timestamp): number {
  const isoStr = formatTimestamp(ts);
  return Date.parse(isoStr);
}

/**
 * Parse an ISO timestamp string to epoch milliseconds
 */
function parseTimestampToEpoch(isoStr: string): number {
  return Date.parse(isoStr);
}

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
  /**
   * Only return entries since this checkpoint.
   * Format: "ts:2026-01-10T15:00Z" for timestamp-based filtering.
   * Format: "git:abc123" for git-based filtering (requires tracker option).
   */
  since?: string;
  /**
   * Change tracker for git-based filtering.
   * Required when using git checkpoints (git:...).
   */
  tracker?: ChangeTracker;
}

/**
 * Error result when a checkpoint is invalid or missing required options.
 */
export interface CheckpointError {
  kind: "invalid-checkpoint";
  /** Human-readable error message */
  message: string;
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
 * @returns Structured query results, validation error, checkpoint error, or null if query syntax is invalid
 */
export async function runQueries(
  workspace: Workspace,
  queryString: string,
  options: RunQueryOptions = {},
): Promise<QueriesResult | QueryValidationError | CheckpointError | null> {
  const { limit, includeRawText = false, validateEntities = true, since, tracker } = options;

  // Parse and validate the since checkpoint if provided
  let sinceMarker: ChangeMarker | null = null;

  if (since) {
    sinceMarker = parseCheckpoint(since);
    if (!sinceMarker) {
      return {
        kind: "invalid-checkpoint",
        message: `Invalid checkpoint format: '${since}'. Use 'ts:2026-01-10T15:00Z' for timestamps or 'git:abc123' for git commits.`,
      };
    }

    // Git checkpoints require a tracker
    if (sinceMarker.type === "git" && !tracker) {
      return {
        kind: "invalid-checkpoint",
        message: `Git checkpoints require a change tracker. Provide a tracker option or use timestamp checkpoints (ts:...).`,
      };
    }
  }

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

  let results: InstanceEntry[];

  if (sinceMarker?.type === "git" && tracker) {
    // Use change tracker for git-based filtering
    const changedResult = await tracker.getChangedEntries(workspace, queries, sinceMarker);
    results = changedResult.entries;
  } else {
    // Execute all queries
    results = executeQueries(workspace, queries);

    // Filter by since timestamp if provided
    if (sinceMarker?.type === "ts") {
      const sinceEpoch = parseTimestampToEpoch(sinceMarker.value);
      results = results.filter((entry) => {
        const entryEpoch = timestampToEpoch(entry.header.timestamp);
        return entryEpoch > sinceEpoch;
      });
    }
  }

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
 * @returns Structured query results, validation error, checkpoint error, or null if query is invalid
 */
export async function runQuery(
  workspace: Workspace,
  queryString: string,
  options: RunQueryOptions = {},
): Promise<QueryResult | QueryValidationError | CheckpointError | null> {
  const result = await runQueries(workspace, queryString, options);

  if (!result) {
    return null;
  }

  // Return errors as-is
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
  result: QueryResult | QueriesResult | QueryValidationError | CheckpointError | null,
): result is QueryValidationError {
  return result !== null && "kind" in result && result.kind === "unknown-entities";
}

/**
 * Type guard to check if a query result is a checkpoint error.
 */
export function isCheckpointError(
  result: QueryResult | QueriesResult | QueryValidationError | CheckpointError | null,
): result is CheckpointError {
  return result !== null && "kind" in result && result.kind === "invalid-checkpoint";
}

/**
 * Type guard to check if a query result is any error type.
 */
export function isQueryError(
  result: QueryResult | QueriesResult | QueryValidationError | CheckpointError | null,
): result is QueryValidationError | CheckpointError {
  return result !== null && "kind" in result;
}

/**
 * Type guard to check if a query result is a successful result (not an error).
 */
export function isQuerySuccess(
  result: QueryResult | QueryValidationError | CheckpointError | null,
): result is QueryResult {
  return result !== null && !("kind" in result);
}

/**
 * Type guard to check if a queries result is a successful result (not an error).
 */
export function isQueriesSuccess(
  result: QueriesResult | QueryValidationError | CheckpointError | null,
): result is QueriesResult {
  return result !== null && !("kind" in result);
}
