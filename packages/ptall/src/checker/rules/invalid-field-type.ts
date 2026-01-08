import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";
import { TypeExpr } from "../../schema/types.js";

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

    for (const entry of workspace.allInstanceEntries()) {
      const schema = registry.get(entry.entity);
      if (!schema) {
        continue;
      } // Will be caught by unknown-entity rule

      for (const [fieldName, value] of entry.metadata) {
        const fieldSchema = schema.fields.get(fieldName);
        if (!fieldSchema) {
          continue;
        } // Will be caught by unknown-field rule

        // Check if value matches the type using grammar-parsed content
        if (!TypeExpr.matchesContent(value.content, fieldSchema.type)) {
          ctx.report({
            message: `Invalid value '${value.raw}' for field '${fieldName}'. Expected ${TypeExpr.toString(fieldSchema.type)}.`,
            file: entry.file,
            location: value.location,
            sourceMap: entry.sourceMap,
            data: {
              field: fieldName,
              value: value.raw,
              expectedType: TypeExpr.toString(fieldSchema.type),
            },
          });
        }
      }
    }
  },
};
