import type {
  ModelTypeExpression,
  ModelPrimitiveType,
  ModelLiteralType,
  ModelUnionType,
} from "../model/types.js";
import type { ValueContent, Link, QuotedValue } from "../ast/types.js";

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
 * Type checking utilities for type expressions.
 * Uses the grammar-parsed ValueContent for type validation.
 */
export const TypeExpr = {
  /**
   * Check if a value content matches a type expression.
   * This uses the grammar-parsed structure for reliable type checking.
   */
  matchesContent(content: ValueContent, type: ModelTypeExpression): boolean {
    switch (type.kind) {
      case "primitive":
        return matchesPrimitiveContent(content, type.name);
      case "literal":
        return matchesLiteralContent(content, type.value);
      case "array":
        return matchesArrayContent(content, type.elementType);
      case "union":
        return type.members.some((member) => TypeExpr.matchesContent(content, member));
    }
  },

  /**
   * Legacy: Check if a raw value string matches a type expression.
   * @deprecated Use matchesContent with parsed ValueContent instead
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

// ===================
// Content-based matching (using grammar-parsed structure)
// ===================

/**
 * Check if content matches a primitive type
 */
function matchesPrimitiveContent(
  content: ValueContent,
  type: "string" | "date" | "date-range" | "link",
): boolean {
  switch (type) {
    case "string":
      // Any content matches string type
      return true;
    case "link":
      // Must be a link value
      return content.type === "link_value";
    case "date-range":
      // Grammar identifies date ranges by the ~ separator
      return content.type === "date_range";
    case "date":
      // Dates are parsed as plain_value, need to validate the format
      if (content.type === "plain_value") {
        return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(content.text);
      }
      return false;
  }
}

/**
 * Check if content matches a literal type
 */
function matchesLiteralContent(content: ValueContent, expectedValue: string): boolean {
  // Literal types require quoted values
  if (content.type === "quoted_value") {
    return content.value === expectedValue;
  }
  return false;
}

/**
 * Check if content matches an array type.
 * Arrays can be:
 * 1. A value_array (comma-separated: ^ref1, ^ref2)
 * 2. A single value that matches the element type
 */
function matchesArrayContent(
  content: ValueContent,
  elementType: ModelPrimitiveType | ModelLiteralType | ModelUnionType,
): boolean {
  // If it's a value_array, validate each element
  if (content.type === "value_array") {
    // Empty arrays are not allowed
    if (content.elements.length === 0) {
      return false;
    }
    // Each element must match the element type
    return content.elements.every((element) => matchesArrayElementContent(element, elementType));
  }

  // Single value - check if it matches the element type directly
  return matchesSingleValueAsArrayElement(content, elementType);
}

/**
 * Check if a single (non-array) value matches an array element type
 */
function matchesSingleValueAsArrayElement(
  content: ValueContent,
  elementType: ModelPrimitiveType | ModelLiteralType | ModelUnionType,
): boolean {
  // Reject empty values (grammar may parse empty as quoted_value)
  if (content.type === "quoted_value" && content.value === "") {
    return false;
  }
  if (content.type === "plain_value" && content.text === "") {
    return false;
  }

  switch (elementType.kind) {
    case "primitive":
      return matchesSingleValueAsPrimitive(content, elementType.name);
    case "literal":
      // Must be a quoted value with matching content
      if (content.type === "quoted_value") {
        return content.value === elementType.value;
      }
      return false;
    case "union":
      return elementType.members.some((member) => {
        if (member.kind === "primitive") {
          return matchesSingleValueAsPrimitive(content, member.name);
        } else if (member.kind === "literal") {
          return content.type === "quoted_value" && content.value === member.value;
        }
        return false;
      });
  }
}

/**
 * Check if a single value matches a primitive type (for single-element arrays)
 */
function matchesSingleValueAsPrimitive(
  content: ValueContent,
  type: "string" | "date" | "date-range" | "link",
): boolean {
  switch (type) {
    case "string":
      // String in array must be quoted and non-empty
      return content.type === "quoted_value" && content.value.length > 0;
    case "link":
      return content.type === "link_value";
    case "date-range":
      return content.type === "date_range";
    case "date":
      // Date should be plain value matching date format
      if (content.type === "plain_value") {
        return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(content.text);
      }
      return false;
  }
}

/**
 * Check if an array element matches the expected element type
 */
function matchesArrayElementContent(
  element: Link | QuotedValue,
  elementType: ModelPrimitiveType | ModelLiteralType | ModelUnionType,
): boolean {
  switch (elementType.kind) {
    case "primitive":
      return matchesArrayPrimitiveContent(element, elementType.name);
    case "literal":
      // Must be a quoted value with matching content
      if (element.type === "quoted_value") {
        return element.value === elementType.value;
      }
      return false;
    case "union":
      return elementType.members.some((member) => {
        if (member.kind === "primitive") {
          return matchesArrayPrimitiveContent(element, member.name);
        } else if (member.kind === "literal") {
          return element.type === "quoted_value" && element.value === member.value;
        }
        // Nested arrays not supported
        return false;
      });
  }
}

/**
 * Check if an array element matches a primitive type
 */
function matchesArrayPrimitiveContent(
  element: Link | QuotedValue,
  type: "string" | "date" | "date-range" | "link",
): boolean {
  switch (type) {
    case "string":
      // Strings in arrays must be quoted
      return element.type === "quoted_value";
    case "link":
      return element.type === "link";
    case "date":
      // Dates in arrays should be quoted for clarity
      if (element.type === "quoted_value") {
        return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(element.value);
      }
      return false;
    case "date-range":
      // Date ranges in arrays should be quoted
      if (element.type === "quoted_value") {
        return /^\d{4}(-\d{2}(-\d{2})?)?\s*~\s*\d{4}(-\d{2}(-\d{2})?)?$/.test(element.value);
      }
      return false;
  }
}

// ===================
// Legacy string-based matching (for backwards compatibility)
// ===================

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
 */
function matchesArray(
  value: string,
  elementType: ModelPrimitiveType | ModelLiteralType | ModelUnionType,
): boolean {
  const elements = value.split(",").map((e) => e.trim());

  if (elements.length === 1 && elements[0] === "") {
    return false;
  }

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
      return isQuoted(value) && stripQuotes(value) === elementType.value;
    case "union":
      return elementType.members.some((member) => {
        if (member.kind === "primitive") {
          return matchesPrimitiveInArray(value, member.name);
        } else if (member.kind === "literal") {
          return isQuoted(value) && stripQuotes(value) === member.value;
        }
        return false;
      });
  }
}

/**
 * Check if a value matches a primitive type in array context
 */
function matchesPrimitiveInArray(
  value: string,
  type: "string" | "date" | "date-range" | "link",
): boolean {
  switch (type) {
    case "string":
      return isQuoted(value);
    case "date":
      return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value);
    case "date-range":
      return /^\d{4}(-\d{2}(-\d{2})?)?\s*~\s*\d{4}(-\d{2}(-\d{2})?)?$/.test(value);
    case "link":
      return value.startsWith("^");
  }
}
