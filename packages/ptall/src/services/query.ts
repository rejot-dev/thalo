import type { Workspace } from "../model/workspace.js";
import type { ModelInstanceEntry, Query, QueryCondition } from "../model/types.js";

/**
 * Options for executing queries
 */
export interface QueryOptions {
  /**
   * Only return entries with timestamps after this value.
   * Useful for incremental updates.
   */
  afterTimestamp?: string | null;
}

/**
 * Check if a single entry matches a query condition.
 */
function matchCondition(entry: ModelInstanceEntry, condition: QueryCondition): boolean {
  switch (condition.kind) {
    case "field": {
      const value = entry.metadata.get(condition.field)?.raw;
      return value === condition.value;
    }
    case "tag": {
      return entry.tags.includes(condition.tag);
    }
    case "link": {
      // Check if entry has this link in header
      if (entry.linkId === condition.link) {
        return true;
      }
      // Also check metadata values for links
      for (const meta of entry.metadata.values()) {
        if (meta.linkId === condition.link) {
          return true;
        }
      }
      return false;
    }
  }
}

/**
 * Check if an entry matches a query.
 * All conditions are ANDed together.
 *
 * @param entry - The entry to check
 * @param query - The query to match against
 * @returns true if the entry matches all conditions
 */
export function entryMatchesQuery(entry: ModelInstanceEntry, query: Query): boolean {
  // Check entity type
  if (entry.entity !== query.entity) {
    return false;
  }

  // Check all conditions (ANDed together)
  return query.conditions.every((condition) => matchCondition(entry, condition));
}

/**
 * Execute a single query against the workspace.
 *
 * @param workspace - The workspace to query
 * @param query - The query to execute
 * @param options - Query options
 * @returns Matching entries sorted by timestamp
 */
export function executeQuery(
  workspace: Workspace,
  query: Query,
  options: QueryOptions = {},
): ModelInstanceEntry[] {
  return executeQueries(workspace, [query], options);
}

/**
 * Execute multiple queries against the workspace.
 * An entry is included if it matches ANY of the queries (OR).
 *
 * @param workspace - The workspace to query
 * @param queries - The queries to execute
 * @param options - Query options
 * @returns Matching entries sorted by timestamp (deduplicated)
 */
export function executeQueries(
  workspace: Workspace,
  queries: Query[],
  options: QueryOptions = {},
): ModelInstanceEntry[] {
  const { afterTimestamp } = options;
  const results: ModelInstanceEntry[] = [];
  const seen = new Set<string>(); // Track by file:timestamp to avoid duplicates

  for (const doc of workspace.allDocuments()) {
    for (const entry of doc.instanceEntries) {
      // Skip if we've already seen this entry
      const key = `${entry.file}:${entry.timestamp}`;
      if (seen.has(key)) {
        continue;
      }

      // Skip if entry is before the cutoff
      if (afterTimestamp && entry.timestamp <= afterTimestamp) {
        continue;
      }

      // Check if entry matches any of the queries
      for (const query of queries) {
        if (entryMatchesQuery(entry, query)) {
          results.push(entry);
          seen.add(key);
          break; // Entry matched, no need to check other queries
        }
      }
    }
  }

  // Sort by timestamp
  results.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return results;
}

/**
 * Format a query for display.
 *
 * @param query - The query to format
 * @returns Human-readable query string
 */
export function formatQuery(query: Query): string {
  let result = query.entity;

  if (query.conditions.length > 0) {
    const condStrs = query.conditions.map((c) => {
      switch (c.kind) {
        case "field":
          return `${c.field} = ${c.value}`;
        case "tag":
          return `#${c.tag}`;
        case "link":
          return `^${c.link}`;
      }
    });
    result += ` where ${condStrs.join(" and ")}`;
  }

  return result;
}
