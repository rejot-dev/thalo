import type { Query, QueryCondition } from "../model/types.js";

/**
 * @deprecated This module contains legacy regex-based query parsing.
 *
 * The Tree-Sitter grammar now parses queries directly into typed AST nodes:
 * - `query_list` → `query` → `query_conditions` → `query_condition`
 *
 * Use the grammar-parsed `ValueContent` from metadata values instead:
 * ```typescript
 * if (value.content.type === "query_list") {
 *   const queries = value.content.queries;
 * }
 * ```
 *
 * This module is kept for backwards compatibility but should be removed
 * once all callers migrate to the grammar-based approach.
 */

/**
 * Parse a sources value into an array of queries.
 * Format: "entity where conditions[, entity where conditions]*"
 *
 * @deprecated Use grammar-parsed query_list from ValueContent instead.
 *
 * Examples:
 * - "lore where subject = ^self"
 * - "lore where subject = ^self and #career"
 * - "lore where subject = ^self, journal where subject = ^self"
 */
export function parseSourcesValue(value: string): Query[] {
  const queries: Query[] = [];

  // Split by comma, but be careful not to split inside quoted strings
  const queryStrings = splitByComma(value);

  for (const queryStr of queryStrings) {
    const trimmed = queryStr.trim();
    if (trimmed) {
      const query = parseQuery(trimmed);
      if (query) {
        queries.push(query);
      }
    }
  }

  return queries;
}

/**
 * Parse a single query string.
 * Format: "entity where condition [and condition]*"
 *
 * @deprecated Use grammar-parsed query from ValueContent instead.
 */
export function parseQuery(queryStr: string): Query | null {
  // Match: entity where conditions
  const whereMatch = queryStr.match(/^(\w+)\s+where\s+(.+)$/i);
  if (!whereMatch) {
    // No "where" clause - just entity name, no conditions
    const entityOnly = queryStr.match(/^(\w+)$/);
    if (entityOnly) {
      return {
        entity: entityOnly[1],
        conditions: [],
      };
    }
    return null;
  }

  const entity = whereMatch[1];
  const conditionsStr = whereMatch[2];

  const conditions = parseConditions(conditionsStr);

  return {
    entity,
    conditions,
  };
}

/**
 * Parse conditions string into array of QueryConditions.
 * Format: "condition [and condition]*"
 */
function parseConditions(conditionsStr: string): QueryCondition[] {
  const conditions: QueryCondition[] = [];

  // Split by " and " (case insensitive)
  const parts = conditionsStr.split(/\s+and\s+/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const condition = parseCondition(trimmed);
    if (condition) {
      conditions.push(condition);
    }
  }

  return conditions;
}

/**
 * Parse a single condition.
 * Formats:
 * - "field = value" (field condition)
 * - "#tag" (tag condition)
 * - "^link" (link condition)
 */
function parseCondition(conditionStr: string): QueryCondition | null {
  const trimmed = conditionStr.trim();

  // Tag condition: #tag
  if (trimmed.startsWith("#")) {
    return {
      kind: "tag",
      tag: trimmed.slice(1),
    };
  }

  // Link condition: ^link
  if (trimmed.startsWith("^")) {
    return {
      kind: "link",
      link: trimmed.slice(1),
    };
  }

  // Field condition: field = value
  const fieldMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*(.+)$/);
  if (fieldMatch) {
    return {
      kind: "field",
      field: fieldMatch[1],
      value: fieldMatch[2].trim(),
    };
  }

  return null;
}

/**
 * Split a string by commas, respecting quoted strings.
 */
function splitByComma(str: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}
