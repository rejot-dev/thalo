import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";
import type { ModelTypeExpression } from "../../model/workspace.js";

const category: RuleCategory = "metadata";

// Date range format: DATE ~ DATE where DATE is YYYY, YYYY-MM, or YYYY-MM-DD
const dateRangePattern = /^\d{4}(-\d{2}(-\d{2})?)?\s*~\s*\d{4}(-\d{2}(-\d{2})?)?$/;

/**
 * Check if a type expression is strictly a daterange type (not a union containing daterange).
 * Union types like `datetime | daterange` are handled by the invalid-field-type rule
 * which correctly validates that the value matches ANY member of the union.
 */
function isStrictDateRangeType(type: ModelTypeExpression): boolean {
  return type.kind === "primitive" && type.name === "daterange";
}

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

      // Check if this field expects a strict date-range type (not a union)
      if (!isStrictDateRangeType(fieldSchema.type)) {
        continue;
      }

      // Validate the daterange format
      const content = meta.value.content;

      // For daterange content type, it's already validated by the parser
      if (content.type === "daterange") {
        continue;
      }

      // For quoted values, extract and validate
      let rangeValue = meta.value.raw.trim();
      if (content.type === "quoted_value") {
        rangeValue = content.value;
      }

      if (rangeValue && !dateRangePattern.test(rangeValue)) {
        ctx.report({
          message: `Invalid date range format '${rangeValue}' for field '${fieldName}'. Expected 'DATE ~ DATE' where DATE is YYYY, YYYY-MM, or YYYY-MM-DD.`,
          file: ctx.file,
          location: meta.value.location,
          sourceMap: ctx.sourceMap,
          data: { fieldName, value: rangeValue },
        });
      }
    }
  },
};

/**
 * Check that date-range field values match the expected format (DATE ~ DATE)
 */
export const invalidDateRangeValueRule: Rule = {
  code: "invalid-date-range-value",
  name: "Invalid Date Range Value",
  description: "Date range doesn't match DATE ~ DATE format",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
