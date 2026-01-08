import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check for missing required metadata fields in instance entries
 */
export const missingRequiredFieldRule: Rule = {
  code: "missing-required-field",
  name: "Missing Required Field",
  description: "Required metadata field not present",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

    for (const entry of workspace.allInstanceEntries()) {
      const schema = registry.get(entry.entity);
      if (!schema) {
        continue;
      } // Will be caught by unknown-entity rule

      for (const [fieldName, fieldSchema] of schema.fields) {
        if (fieldSchema.optional) {
          continue;
        }
        if (fieldSchema.defaultValue !== null) {
          continue;
        } // Has default, not required

        if (!entry.metadata.has(fieldName)) {
          ctx.report({
            message: `Missing required field '${fieldName}' for entity '${entry.entity}'.`,
            file: entry.file,
            location: entry.location,
            sourceMap: entry.sourceMap,
            data: { field: fieldName, entity: entry.entity },
          });
        }
      }
    }
  },
};
