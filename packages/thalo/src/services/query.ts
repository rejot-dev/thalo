import type { Workspace } from "../model/workspace.js";
import type { InstanceEntry, Timestamp } from "../ast/types.js";
import { isSyntaxError } from "../ast/types.js";
import type { Query, QueryCondition } from "../model/types.js";

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
 * Result entry with file context for sorting and deduplication
 */
interface QueryResultEntry {
  entry: InstanceEntry;
  file: string;
  timestampStr: string;
}

/**
 * Format a timestamp for comparison (includes timezone for correct sorting)
 */
function formatTimestamp(ts: Timestamp): string {
  const date = `${ts.date.year}-${String(ts.date.month).padStart(2, "0")}-${String(ts.date.day).padStart(2, "0")}`;
  const time = `${String(ts.time.hour).padStart(2, "0")}:${String(ts.time.minute).padStart(2, "0")}`;
  const tz = isSyntaxError(ts.timezone) ? "" : ts.timezone.value;
  return `${date}T${time}${tz}`;
}

/**
 * Get metadata value as string for a given key.
 * Returns the raw value (with quotes for quoted strings) to match query syntax.
 */
function getMetadataValue(entry: InstanceEntry, key: string): string | undefined {
  const meta = entry.metadata.find((m) => m.key.value === key);
  if (!meta) {
    return undefined;
  }

  // Return the raw value to match query syntax (which includes quotes)
  return meta.value.raw;
}

/**
 * Check if a single entry matches a query condition.
 */
function matchCondition(entry: InstanceEntry, condition: QueryCondition): boolean {
  switch (condition.kind) {
    case "field": {
      const value = getMetadataValue(entry, condition.field);
      return value === condition.value;
    }
    case "tag": {
      return entry.header.tags.some((t) => t.name === condition.tag);
    }
    case "link": {
      // Check if entry has this link in header
      if (entry.header.link?.id === condition.link) {
        return true;
      }
      // Also check metadata values for links
      for (const meta of entry.metadata) {
        const content = meta.value.content;
        if (content.type === "link_value" && content.link.id === condition.link) {
          return true;
        }
        if (content.type === "value_array") {
          for (const elem of content.elements) {
            if (elem.type === "link" && elem.id === condition.link) {
              return true;
            }
          }
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
export function entryMatchesQuery(entry: InstanceEntry, query: Query): boolean {
  // Check entity type
  if (entry.header.entity !== query.entity) {
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
): InstanceEntry[] {
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
): InstanceEntry[] {
  const { afterTimestamp } = options;
  const results: QueryResultEntry[] = [];
  const seen = new Set<string>(); // Track by file:timestamp to avoid duplicates

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (entry.type !== "instance_entry") {
        continue;
      }

      const timestampStr = formatTimestamp(entry.header.timestamp);
      const key = `${model.file}:${timestampStr}`;

      // Skip if we've already seen this entry
      if (seen.has(key)) {
        continue;
      }

      // Skip if entry is before the cutoff
      if (afterTimestamp && timestampStr <= afterTimestamp) {
        continue;
      }

      // Check if entry matches any of the queries
      for (const query of queries) {
        if (entryMatchesQuery(entry, query)) {
          results.push({ entry, file: model.file, timestampStr });
          seen.add(key);
          break; // Entry matched, no need to check other queries
        }
      }
    }
  }

  // Sort by timestamp
  results.sort((a, b) => a.timestampStr.localeCompare(b.timestampStr));

  return results.map((r) => r.entry);
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
