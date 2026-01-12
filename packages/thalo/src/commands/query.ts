/**
 * Query command - executes a query on a workspace and returns structured results.
 */

import type { Workspace } from "../model/workspace.js";
import type { Query, QueryCondition } from "../model/types.js";
import type { InstanceEntry } from "../ast/types.js";
import { executeQuery, formatQuery } from "../services/query.js";
import { findEntryFile, getEntrySourceText } from "../services/synthesis.js";
import { formatTimestamp } from "../formatters.js";

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
 * Result of running the query command.
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
 * Options for running the query command.
 */
export interface RunQueryOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Include raw source text in results */
  includeRawText?: boolean;
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
 * Parse query conditions from the "where" clause string.
 */
function parseConditions(conditionsStr: string): Query["conditions"] {
  const conditions: Query["conditions"] = [];
  const condParts = conditionsStr.split(/\s+and\s+/);

  for (const part of condParts) {
    const trimmed = part.trim();

    if (trimmed.startsWith("#")) {
      conditions.push({ kind: "tag", tag: trimmed.slice(1) });
      continue;
    }

    if (trimmed.startsWith("^")) {
      conditions.push({ kind: "link", link: trimmed.slice(1) });
      continue;
    }

    const fieldMatch = trimmed.match(/^(\S+)\s*=\s*(.+)$/);
    if (fieldMatch) {
      const [, field, value] = fieldMatch;
      conditions.push({ kind: "field", field, value });
    }
  }

  return conditions;
}

/**
 * Parse a query string into a Query object.
 * Uses regex-based parsing to work in both Node.js and browser environments.
 */
export function parseQueryString(queryStr: string): Query | null {
  const trimmed = queryStr.trim();

  if (!trimmed) {
    return null;
  }

  // Match: entity [where conditions]
  const queryMatch = trimmed.match(/^([a-z][a-z0-9-]*?)(?:\s+where\s+(.+))?$/i);

  if (!queryMatch) {
    return null;
  }

  const [, entity, conditionsStr] = queryMatch;
  const conditions = conditionsStr ? parseConditions(conditionsStr) : [];

  return { entity, conditions };
}

/**
 * Run the query command on a workspace.
 *
 * @param workspace - The workspace to query
 * @param queryString - The query string to parse and execute
 * @param options - Query options
 * @returns Structured query results, or null if query is invalid
 */
export function runQuery(
  workspace: Workspace,
  queryString: string,
  options: RunQueryOptions = {},
): QueryResult | null {
  const { limit, includeRawText = false } = options;

  // Parse the query
  const query = parseQueryString(queryString);
  if (!query) {
    return null;
  }

  // Execute the query
  const results = executeQuery(workspace, query);

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
    query,
    queryString: formatQuery(query),
    entries,
    totalCount: results.length,
  };
}
