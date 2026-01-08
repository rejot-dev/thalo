import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "schema";

/**
 * Check for alter-entity trying to remove fields that don't exist in the schema
 */
export const removeUndefinedFieldRule: Rule = {
  code: "remove-undefined-field",
  name: "Remove Undefined Field",
  description: "# Remove Metadata references nonexistent field",
  category,
  defaultSeverity: "warning",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

    for (const entry of workspace.allSchemaEntries()) {
      if (entry.directive !== "alter-entity" || entry.removeFields.length === 0) {
        continue;
      }

      // Get the schema as it was BEFORE this alter-entity
      // We need to check what fields existed at the time
      const schema = registry.get(entry.entityName);
      if (!schema) {
        continue; // Will be caught by alter-undefined-entity rule
      }

      for (const fieldName of entry.removeFields) {
        // Check if this field exists in the current resolved schema
        // Note: This is a simplification - ideally we'd check the state before this alter
        if (!schema.fields.has(fieldName)) {
          ctx.report({
            message: `Cannot remove field '${fieldName}' from entity '${entry.entityName}': field does not exist.`,
            file: entry.file,
            location: entry.location,
            sourceMap: entry.sourceMap,
            data: { fieldName, entityName: entry.entityName },
          });
        }
      }
    }
  },
};
