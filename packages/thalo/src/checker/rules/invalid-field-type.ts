import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor } from "../visitor.js";
import { TypeExpr } from "../../schema/types.js";

const category: RuleCategory = "instance";

const visitor: RuleVisitor = {
  visitInstanceEntry(entry, ctx) {
    const registry = ctx.workspace.schemaRegistry;
    const entity = entry.header.entity;
    const schema = registry.get(entity);

    if (!schema) {
      return; // Will be caught by unknown-entity rule
    }

    for (const meta of entry.metadata) {
      const fieldName = meta.key.value;
      const fieldSchema = schema.fields.get(fieldName);

      if (!fieldSchema) {
        continue; // Will be caught by unknown-field rule
      }

      // Check if value matches the type using grammar-parsed content
      if (!TypeExpr.matchesContent(meta.value.content, fieldSchema.type)) {
        ctx.report({
          message: `Invalid value '${meta.value.raw}' for field '${fieldName}'. Expected ${TypeExpr.toString(fieldSchema.type)}.`,
          file: ctx.file,
          location: meta.value.location,
          sourceMap: ctx.sourceMap,
          data: {
            field: fieldName,
            value: meta.value.raw,
            expectedType: TypeExpr.toString(fieldSchema.type),
          },
        });
      }
    }
  },
};

/**
 * Check that metadata values match their declared types
 */
export const invalidFieldTypeRule: Rule = {
  code: "invalid-field-type",
  name: "Invalid Field Type",
  description: "Metadata value doesn't match declared type",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
