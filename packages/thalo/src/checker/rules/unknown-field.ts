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

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "instance_entry") {
          continue;
        }

        const entity = entry.header.entity;
        const schema = registry.get(entity);
        if (!schema) {
          continue;
        } // Will be caught by unknown-entity rule

        for (const meta of entry.metadata) {
          const fieldName = meta.key.value;
          if (!schema.fields.has(fieldName)) {
            ctx.report({
              message: `Unknown field '${fieldName}' for entity '${entity}'.`,
              file: model.file,
              // Use key.location to point to the field name, not the leading indent
              location: meta.key.location,
              sourceMap: model.sourceMap,
              data: { field: fieldName, entity },
            });
          }
        }
      }
    }
  },
};
