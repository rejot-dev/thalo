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
          const fieldSchema = schema.fields.get(fieldName);
          if (!fieldSchema) {
            continue;
          } // Will be caught by unknown-field rule

          // Check if the field is required and has an empty value
          if (!fieldSchema.optional && fieldSchema.defaultValue === null) {
            const rawValue = meta.value.raw.trim();
            // Check for empty or effectively empty values
            if (rawValue === "" || rawValue === '""') {
              ctx.report({
                message: `Required field '${fieldName}' has an empty value.`,
                file: model.file,
                location: meta.value.location,
                sourceMap: model.sourceMap,
                data: { fieldName, entity },
              });
            }
          }
        }
      }
    }
  },
};
