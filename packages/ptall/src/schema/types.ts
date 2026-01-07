import type {
  ModelTypeExpression,
  ModelPrimitiveType,
  ModelLiteralType,
  ModelUnionType,
  ModelDefaultValue,
} from "../model/types.js";
import type {
  ValueContent,
  Link,
  QuotedValue,
  DatetimeValue,
  DateRangeValue,
  Query,
} from "../ast/types.js";

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
  defaultValue: ModelDefaultValue | null;
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
   * Check if a default value matches a type expression.
   * Default values can only be quoted strings, links, or datetimes.
   */
  matchesDefaultValue(defaultValue: ModelDefaultValue, type: ModelTypeExpression): boolean {
    switch (type.kind) {
      case "primitive":
        return matchesDefaultPrimitive(defaultValue, type.name);
      case "literal":
        // Literal types require quoted values with matching content
        return defaultValue.kind === "quoted" && defaultValue.value === type.value;
      case "array":
        // Default values can't be arrays (grammar doesn't support it)
        // But a single value can match an array type as a single-element array
        return matchesDefaultAsArrayElement(defaultValue, type.elementType);
      case "union":
        return type.members.some((member) => TypeExpr.matchesDefaultValue(defaultValue, member));
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
  type: "string" | "datetime" | "date-range" | "link",
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
    case "datetime":
      // Date must be datetime_value without time component (YYYY-MM-DD only)
      if (content.type === "datetime_value") {
        return !content.value.includes("T");
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
  type: "string" | "datetime" | "date-range" | "link",
): boolean {
  switch (type) {
    case "string":
      // String in array must be quoted and non-empty
      return content.type === "quoted_value" && content.value.length > 0;
    case "link":
      return content.type === "link_value";
    case "date-range":
      return content.type === "date_range";
    case "datetime":
      // Date must be datetime_value without time component (YYYY-MM-DD only)
      if (content.type === "datetime_value") {
        return !content.value.includes("T");
      }
      return false;
  }
}

/**
 * Check if an array element matches the expected element type
 */
function matchesArrayElementContent(
  element: Link | QuotedValue | DatetimeValue | DateRangeValue | Query,
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
  element: Link | QuotedValue | DatetimeValue | DateRangeValue | Query,
  type: "string" | "datetime" | "date-range" | "link",
): boolean {
  switch (type) {
    case "string":
      // Strings in arrays must be quoted
      return element.type === "quoted_value";
    case "link":
      return element.type === "link";
    case "datetime":
      // Date in arrays must be datetime_value without time (YYYY-MM-DD only)
      if (element.type === "datetime_value") {
        return !element.value.includes("T");
      }
      return false;
    case "date-range":
      // Date ranges parsed by grammar are valid
      if (element.type === "date_range") {
        return true;
      }
      // Also accept quoted date ranges
      if (element.type === "quoted_value") {
        return /^\d{4}(-\d{2}(-\d{2})?)?\s*~\s*\d{4}(-\d{2}(-\d{2})?)?$/.test(element.value);
      }
      return false;
  }
}

// ===================
// Default value matching
// ===================

/**
 * Check if a default value matches a primitive type
 */
function matchesDefaultPrimitive(
  defaultValue: ModelDefaultValue,
  type: "string" | "datetime" | "date-range" | "link",
): boolean {
  switch (type) {
    case "string":
      // Any default value can be coerced to string
      return true;
    case "link":
      return defaultValue.kind === "link";
    case "datetime":
      // Date must be datetime without time component (YYYY-MM-DD only)
      if (defaultValue.kind === "datetime") {
        return !defaultValue.value.includes("T");
      }
      return false;
    case "date-range":
      // Default values can't be date ranges (grammar doesn't support it)
      return false;
  }
}

/**
 * Check if a default value matches as a single array element
 */
function matchesDefaultAsArrayElement(
  defaultValue: ModelDefaultValue,
  elementType: ModelPrimitiveType | ModelLiteralType | ModelUnionType,
): boolean {
  switch (elementType.kind) {
    case "primitive":
      return matchesDefaultAsPrimitive(defaultValue, elementType.name);
    case "literal":
      return defaultValue.kind === "quoted" && defaultValue.value === elementType.value;
    case "union":
      return elementType.members.some((member) => {
        if (member.kind === "primitive") {
          return matchesDefaultAsPrimitive(defaultValue, member.name);
        } else if (member.kind === "literal") {
          return defaultValue.kind === "quoted" && defaultValue.value === member.value;
        }
        return false;
      });
  }
}

/**
 * Check if a default value matches a primitive type as array element
 */
function matchesDefaultAsPrimitive(
  defaultValue: ModelDefaultValue,
  type: "string" | "datetime" | "date-range" | "link",
): boolean {
  switch (type) {
    case "string":
      // String in array context requires quoted value
      return defaultValue.kind === "quoted" && defaultValue.value.length > 0;
    case "link":
      return defaultValue.kind === "link";
    case "datetime":
      if (defaultValue.kind === "datetime") {
        return !defaultValue.value.includes("T");
      }
      return false;
    case "date-range":
      // Default values can't be date ranges
      return false;
  }
}
