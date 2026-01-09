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

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "schema_entry") {
          continue;
        }
        if (entry.header.directive !== "alter-entity") {
          continue;
        }

        const removeFields = entry.removeMetadataBlock?.fields ?? [];
        if (removeFields.length === 0) {
          continue;
        }

        const entityName = entry.header.entityName.value;
        const schema = registry.get(entityName);
        if (!schema) {
          continue;
        } // Will be caught by alter-undefined-entity rule

        for (const removal of removeFields) {
          const fieldName = removal.name.value;
          if (!schema.fields.has(fieldName)) {
            ctx.report({
              message: `Cannot remove field '${fieldName}' from entity '${entityName}': field does not exist.`,
              file: model.file,
              location: removal.location,
              sourceMap: model.sourceMap,
              data: { fieldName, entityName },
            });
          }
        }
      }
    }
  },
};
