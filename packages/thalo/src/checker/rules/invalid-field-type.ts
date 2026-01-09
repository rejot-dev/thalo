import type { Rule, RuleCategory } from "../types.js";
import { TypeExpr } from "../../schema/types.js";

const category: RuleCategory = "instance";

/**
 * Check that metadata values match their declared types
 */
export const invalidFieldTypeRule: Rule = {
  code: "invalid-field-type",
  name: "Invalid Field Type",
  description: "Metadata value doesn't match declared type",
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

          // Check if value matches the type using grammar-parsed content
          if (!TypeExpr.matchesContent(meta.value.content, fieldSchema.type)) {
            ctx.report({
              message: `Invalid value '${meta.value.raw}' for field '${fieldName}'. Expected ${TypeExpr.toString(fieldSchema.type)}.`,
              file: model.file,
              location: meta.value.location,
              sourceMap: model.sourceMap,
              data: {
                field: fieldName,
                value: meta.value.raw,
                expectedType: TypeExpr.toString(fieldSchema.type),
              },
            });
          }
        }
      }
    }
  },
};
