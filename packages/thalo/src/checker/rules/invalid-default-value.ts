import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";
import type { DefaultValue, TypeExpression } from "../../ast/ast-types.js";
import { isSyntaxError } from "../../ast/ast-types.js";
import type { ModelDefaultValue, ModelTypeExpression } from "../../model/workspace.js";
import { TypeExpr } from "../../schema/registry.js";

const category: RuleCategory = "schema";

const visitor: RuleVisitor = {
  visitSchemaEntry(entry, ctx) {
    const fields = entry.metadataBlock?.fields ?? [];

    for (const field of fields) {
      if (!field.defaultValue) {
        continue;
      }

      // Skip fields with unknown types - they'll be reported as syntax errors
      if (isSyntaxError(field.typeExpr)) {
        continue;
      }

      // Convert AST default value to model default value format for type checking
      const defaultValue = convertDefaultValue(field.defaultValue);
      const fieldType = convertTypeExpression(field.typeExpr);

      // Use typed default value matching
      if (!TypeExpr.matchesDefaultValue(defaultValue, fieldType)) {
        ctx.report({
          message: `Invalid default value '${field.defaultValue.raw}' for field '${field.name.value}'. Expected ${TypeExpr.toString(fieldType)}.`,
          file: ctx.file,
          location: field.defaultValue.location,
          sourceMap: ctx.sourceMap,
          data: {
            fieldName: field.name.value,
            defaultValue: field.defaultValue.raw,
            expectedType: TypeExpr.toString(fieldType),
          },
        });
      }
    }
  },
};

/**
 * Check that default values in field definitions match their declared types
 */
export const invalidDefaultValueRule: Rule = {
  code: "invalid-default-value",
  name: "Invalid Default Value",
  description: "Default value doesn't match field's declared type",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry" },
  visitor,
};

function convertDefaultValue(dv: DefaultValue): ModelDefaultValue {
  const raw = dv.raw;
  switch (dv.content.type) {
    case "quoted_value":
      return { kind: "quoted", value: dv.content.value, raw };
    case "link":
      return { kind: "link", id: dv.content.id, raw };
    case "datetime_value":
      return { kind: "datetime", value: dv.content.value, raw };
    case "number_value":
      return { kind: "number", value: dv.content.value, raw };
  }
}

function convertTypeExpression(expr: TypeExpression): ModelTypeExpression {
  switch (expr.type) {
    case "primitive_type":
      return { kind: "primitive", name: expr.name };
    case "literal_type":
      return { kind: "literal", value: expr.value };
    case "array_type":
      // Safe: array element types cannot be arrays or unions per grammar
      return {
        kind: "array",
        elementType: convertTypeExpression(expr.elementType) as Exclude<
          ModelTypeExpression,
          { kind: "array" | "union" }
        >,
      };
    case "union_type":
      // Safe: union members cannot be unions per grammar
      return {
        kind: "union",
        members: expr.members.map(
          (m) => convertTypeExpression(m) as Exclude<ModelTypeExpression, { kind: "union" }>,
        ),
      };
  }
}
