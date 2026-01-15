import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "metadata";

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

      // Check if the field is required and has an empty value
      if (!fieldSchema.optional && fieldSchema.defaultValue === null) {
        const rawValue = meta.value.raw.trim();
        // Check for empty or effectively empty values
        if (rawValue === "" || rawValue === '""') {
          ctx.report({
            message: `Required field '${fieldName}' has an empty value.`,
            file: ctx.file,
            location: meta.value.location,
            sourceMap: ctx.sourceMap,
            data: { fieldName, entity },
          });
        }
      }
    }
  },
};

/**
 * Check for required fields that are present but have empty values
 */
export const emptyRequiredValueRule: Rule = {
  code: "empty-required-value",
  name: "Empty Required Value",
  description: "Required field has empty value",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
