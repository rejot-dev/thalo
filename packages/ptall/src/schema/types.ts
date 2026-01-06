import type { ModelTypeExpression } from "../model/types.js";

/**
 * A resolved entity schema (after applying all define-entity and alter-entity entries)
 */
export interface EntitySchema {
  /** The entity name */
  name: string;
  /** Description from the define-entity entry */
  description: string;
  /** Field definitions */
  fields: Map<string, FieldSchema>;
  /** Section definitions */
  sections: Map<string, SectionSchema>;
  /** Timestamp of the define-entity that created this schema */
  definedAt: string;
  /** File where this schema was defined */
  definedIn: string;
}

/**
 * A field schema in an entity definition
 */
export interface FieldSchema {
  /** Field name */
  name: string;
  /** Whether the field is optional */
  optional: boolean;
  /** The type expression */
  type: ModelTypeExpression;
  /** Default value (if any) */
  defaultValue: string | null;
  /** Description (if any) */
  description: string | null;
}

/**
 * A section schema in an entity definition
 */
export interface SectionSchema {
  /** Section name (PascalCase) */
  name: string;
  /** Whether the section is optional */
  optional: boolean;
  /** Description (if any) */
  description: string | null;
}

/**
 * Type checking utilities for type expressions
 */
export const TypeExpr = {
  /**
   * Check if a value matches a type expression
   */
  matches(value: string, type: ModelTypeExpression): boolean {
    switch (type.kind) {
      case "primitive":
        return matchesPrimitive(value, type.name);
      case "literal":
        return value === type.value || stripQuotes(value) === type.value;
      case "array":
        // Arrays in metadata are not directly supported - this would need special handling
        return false;
      case "union":
        return type.members.some((member) => TypeExpr.matches(value, member));
    }
  },

  /**
   * Get a human-readable string for a type expression
   */
  toString(type: ModelTypeExpression): string {
    switch (type.kind) {
      case "primitive":
        return type.name;
      case "literal":
        return `"${type.value}"`;
      case "array":
        return `${TypeExpr.toString(type.elementType)}[]`;
      case "union":
        return type.members.map((m) => TypeExpr.toString(m)).join(" | ");
    }
  },
};

/**
 * Check if a value matches a primitive type
 */
function matchesPrimitive(value: string, type: "string" | "date" | "date-range" | "link"): boolean {
  switch (type) {
    case "string":
      // Any string value matches
      return true;
    case "date":
      // Date format: YYYY, YYYY-MM, or YYYY-MM-DD
      return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value);
    case "date-range":
      // Date range format: DATE ~ DATE
      return /^\d{4}(-\d{2}(-\d{2})?)?\s*~\s*\d{4}(-\d{2}(-\d{2})?)?$/.test(value);
    case "link":
      // Link format: ^identifier
      return value.startsWith("^");
  }
}

/**
 * Strip quotes from a string if present
 */
function stripQuotes(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}
