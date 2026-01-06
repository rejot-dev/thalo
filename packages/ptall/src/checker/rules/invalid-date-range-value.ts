import type { Rule } from "../types.js";

/**
 * Check that date-range field values match the expected format (DATE ~ DATE)
 */
export const invalidDateRangeValueRule: Rule = {
  code: "invalid-date-range-value",
  name: "Invalid Date Range Value",
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

    // Date range format: DATE ~ DATE where DATE is YYYY, YYYY-MM, or YYYY-MM-DD
    const dateRangePattern = /^\d{4}(-\d{2}(-\d{2})?)?\s*~\s*\d{4}(-\d{2}(-\d{2})?)?$/;

    for (const entry of workspace.allInstanceEntries()) {
      const schema = registry.get(entry.entity);
      if (!schema) {
        continue; // Will be caught by unknown-entity rule
      }

      for (const [fieldName, value] of entry.metadata) {
        const fieldSchema = schema.fields.get(fieldName);
        if (!fieldSchema) {
          continue; // Will be caught by unknown-field rule
        }

        // Check if this field expects a date-range type
        if (!isDateRangeType(fieldSchema.type)) {
          continue;
        }

        // Validate the date-range format
        const trimmedValue = value.raw.trim();
        if (trimmedValue && !dateRangePattern.test(trimmedValue)) {
          ctx.report({
            message: `Invalid date range format '${trimmedValue}' for field '${fieldName}'. Expected 'DATE ~ DATE' where DATE is YYYY, YYYY-MM, or YYYY-MM-DD.`,
            file: entry.file,
            location: value.location,
            data: { fieldName, value: trimmedValue },
          });
        }
      }
    }
  },
};

/**
 * Check if a type expression is or contains a date-range type
 */
function isDateRangeType(type: {
  kind: string;
  name?: string;
  members?: Array<{ kind: string; name?: string }>;
}): boolean {
  if (type.kind === "primitive" && type.name === "date-range") {
    return true;
  }
  if (type.kind === "union" && type.members) {
    return type.members.some((m) => m.kind === "primitive" && m.name === "date-range");
  }
  return false;
}
