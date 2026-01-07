import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check for metadata fields not defined in the entity schema
 */
export const unknownFieldRule: Rule = {
  code: "unknown-field",
  name: "Unknown Field",
  description: "Metadata field not defined in entity schema",
  category,
  defaultSeverity: "warning",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

    for (const entry of workspace.allInstanceEntries()) {
      const schema = registry.get(entry.entity);
      if (!schema) {
        continue;
      } // Will be caught by unknown-entity rule

      for (const [fieldName, value] of entry.metadata) {
        if (!schema.fields.has(fieldName)) {
          ctx.report({
            message: `Unknown field '${fieldName}' for entity '${entry.entity}'.`,
            file: entry.file,
            location: value.location,
            data: { field: fieldName, entity: entry.entity },
          });
        }
      }
    }
  },
};
