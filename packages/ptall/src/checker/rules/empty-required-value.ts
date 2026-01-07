import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "metadata";

/**
 * Check for required fields that are present but have empty values
 */
export const emptyRequiredValueRule: Rule = {
  code: "empty-required-value",
  name: "Empty Required Value",
  description: "Required field has empty value",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

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

        // Check if the field is required and has an empty value
        if (!fieldSchema.optional && fieldSchema.defaultValue === null) {
          const trimmedValue = value.raw.trim();
          // Check for empty or effectively empty values
          if (trimmedValue === "" || trimmedValue === '""') {
            ctx.report({
              message: `Required field '${fieldName}' has an empty value.`,
              file: entry.file,
              location: value.location,
              data: { fieldName, entity: entry.entity },
            });
          }
        }
      }
    }
  },
};
