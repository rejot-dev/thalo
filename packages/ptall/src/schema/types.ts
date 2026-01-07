import type {
  ModelTypeExpression,
  ModelPrimitiveType,
  ModelLiteralType,
  ModelUnionType,
} from "../model/types.js";

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
        // Literal types require quoted values: "high" not high
        return isQuoted(value) && stripQuotes(value) === type.value;
      case "array":
        return matchesArray(value, type.elementType);
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
        // For union element types, wrap in parentheses
        if (type.elementType.kind === "union") {
          return `(${TypeExpr.toString(type.elementType)})[]`;
        }
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
 * Check if a value is quoted
 */
function isQuoted(value: string): boolean {
  return value.startsWith('"') && value.endsWith('"');
}

/**
 * Strip quotes from a string if present
 */
function stripQuotes(value: string): string {
  if (isQuoted(value)) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Check if a comma-separated value matches an array type
 * Array values are comma-separated: "^link1, ^link2" for link[]
 * Empty arrays are not allowed - use optional fields instead.
 */
function matchesArray(
  value: string,
  elementType: ModelPrimitiveType | ModelLiteralType | ModelUnionType,
): boolean {
  // Split by comma and trim whitespace
  const elements = value.split(",").map((e) => e.trim());

  // Empty arrays are not allowed - use optional fields and omit the field instead
  if (elements.length === 1 && elements[0] === "") {
    return false;
  }

  // Each element must match the element type
  return elements.every((element) => matchesElementType(element, elementType));
}

/**
 * Check if a single value matches an array element type
 */
function matchesElementType(
  value: string,
  elementType: ModelPrimitiveType | ModelLiteralType | ModelUnionType,
): boolean {
  switch (elementType.kind) {
    case "primitive":
      return matchesPrimitiveInArray(value, elementType.name);
    case "literal":
      // Literal types require quoted values
      return isQuoted(value) && stripQuotes(value) === elementType.value;
    case "union":
      return elementType.members.some((member) => {
        if (member.kind === "primitive") {
          return matchesPrimitiveInArray(value, member.name);
        } else if (member.kind === "literal") {
          return isQuoted(value) && stripQuotes(value) === member.value;
        } else {
          // Nested array types in union - not supported in element matching
          return false;
        }
      });
  }
}

/**
 * Check if a value matches a primitive type when used as an array element.
 * String values in arrays must be quoted to avoid ambiguity with commas.
 */
function matchesPrimitiveInArray(
  value: string,
  type: "string" | "date" | "date-range" | "link",
): boolean {
  switch (type) {
    case "string":
      // String elements in arrays must be quoted: "Jane Doe" not Jane Doe
      return isQuoted(value);
    case "date":
      return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value);
    case "date-range":
      return /^\d{4}(-\d{2}(-\d{2})?)?\s*~\s*\d{4}(-\d{2}(-\d{2})?)?$/.test(value);
    case "link":
      return value.startsWith("^");
  }
}
