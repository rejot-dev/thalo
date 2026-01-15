import type { Workspace } from "../model/workspace.js";
import type {
  InstanceEntry,
  Query as AstQuery,
  QueryCondition as AstQueryCondition,
} from "../ast/ast-types.js";
import { formatTimestamp } from "../formatters.js";

// ===================
// Query Types
// ===================

/**
 * A parsed query for filtering entries
 * Example: "lore where subject = ^self and #career"
 */
export interface Query {
  /** The entity type to query (lore, opinion, etc.) */
  entity: string;
  /** Filter conditions (ANDed together) */
  conditions: QueryCondition[];
}

/**
 * A single condition in a query
 */
export type QueryCondition = FieldCondition | TagCondition | LinkCondition;

/**
 * A field equality condition: field = value
 */
export interface FieldCondition {
  kind: "field";
  field: string;
  value: string;
}

/**
 * A tag condition: #tag (entry must have this tag)
 */
export interface TagCondition {
  kind: "tag";
  tag: string;
}

/**
 * A link condition: ^link (entry must have this link)
 */
export interface LinkCondition {
  kind: "link";
  link: string;
}

// ===================
// Query Parsing
// ===================

/**
 * Convert an AST Query to a Model Query.
 * The AST Query comes from parsing, while Model Query is used for execution.
 */
export function astQueryToModelQuery(astQuery: AstQuery): Query {
  return {
    entity: astQuery.entity,
    conditions: astQuery.conditions.map((c: AstQueryCondition): QueryCondition => {
      switch (c.type) {
        case "field_condition":
          return { kind: "field", field: c.field, value: c.value };
        case "tag_condition":
          return { kind: "tag", tag: c.tag };
        case "link_condition":
          return { kind: "link", link: c.linkId };
      }
    }),
  };
}

/**
 * Parse query conditions from the "where" clause string.
 */
function parseConditions(conditionsStr: string): QueryCondition[] {
  const conditions: QueryCondition[] = [];
  const condParts = conditionsStr.split(/\s+and\s+/i);

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
 * Parse a single query from a string.
 * Returns null if the string is not a valid query.
 */
function parseSingleQuery(queryStr: string): Query | null {
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
 * Parse a query string into Query objects.
 * Supports both single queries and comma-separated multiple queries.
 * Uses regex-based parsing to work in both Node.js and browser environments.
 *
 * @example
 * parseQueryString("lore")                           // [{ entity: "lore", conditions: [] }]
 * parseQueryString("lore where #career")             // [{ entity: "lore", conditions: [...] }]
 * parseQueryString("lore, journal")                  // [{ entity: "lore", ... }, { entity: "journal", ... }]
 * parseQueryString("lore where #career, journal")    // [{ entity: "lore", ... }, { entity: "journal", ... }]
 *
 * @returns Array of Query objects, or null if the input is invalid
 */
export function parseQueryString(queryStr: string): Query[] | null {
  const trimmed = queryStr.trim();

  if (!trimmed) {
    return null;
  }

  // Split by comma to support multiple queries
  const parts = trimmed.split(/\s*,\s*/);
  const queries: Query[] = [];

  for (const part of parts) {
    const query = parseSingleQuery(part);
    if (!query) {
      return null; // If any part is invalid, the whole query is invalid
    }
    queries.push(query);
  }

  return queries.length > 0 ? queries : null;
}

// ===================
// Query Validation
// ===================

/**
 * Validate that all query entities exist in the schema registry.
 *
 * @param workspace - The workspace containing the schema registry
 * @param queries - The queries to validate
 * @returns Array of unknown entity names (empty if all are valid)
 */
export function validateQueryEntities(workspace: Workspace, queries: Query[]): string[] {
  const registry = workspace.schemaRegistry;
  const unknown: string[] = [];

  for (const query of queries) {
    if (!registry.has(query.entity)) {
      // Avoid duplicates
      if (!unknown.includes(query.entity)) {
        unknown.push(query.entity);
      }
    }
  }

  return unknown;
}

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
  // Track seen entries by file:position to avoid returning the same entry twice
  // (can happen when entry matches multiple queries). We use position rather than
  // semantic identity (timestamp+type) because query should return ALL physical entries.
  const seen = new Set<string>();

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (entry.type !== "instance_entry") {
        continue;
      }

      const timestampStr = formatTimestamp(entry.header.timestamp);
      const key = `${model.file}:${entry.location.startPosition.row}:${entry.location.startPosition.column}`;

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
