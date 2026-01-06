import type { Rule } from "../types.js";

/**
 * Check that date field values match the expected format (YYYY, YYYY-MM, or YYYY-MM-DD)
 */
export const invalidDateValueRule: Rule = {
  code: "invalid-date-value",
  name: "Invalid Date Value",
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

    const datePattern = /^\d{4}(-\d{2}(-\d{2})?)?$/;

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

        // Check if this field expects a date type
        if (!isDateType(fieldSchema.type)) {
          continue;
        }

        // Validate the date format
        const trimmedValue = value.raw.trim();
        if (trimmedValue && !datePattern.test(trimmedValue)) {
          ctx.report({
            message: `Invalid date format '${trimmedValue}' for field '${fieldName}'. Expected YYYY, YYYY-MM, or YYYY-MM-DD.`,
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
 * Check if a type expression is or contains a date type
 */
function isDateType(type: {
  kind: string;
  name?: string;
  members?: Array<{ kind: string; name?: string }>;
}): boolean {
  if (type.kind === "primitive" && type.name === "date") {
    return true;
  }
  if (type.kind === "union" && type.members) {
    return type.members.some((m) => m.kind === "primitive" && m.name === "date");
  }
  return false;
}
