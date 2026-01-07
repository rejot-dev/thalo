import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "schema";
import { TypeExpr } from "../../schema/types.js";

/**
 * Check that default values in field definitions match their declared types
 */
export const invalidDefaultValueRule: Rule = {
  code: "invalid-default-value",
  name: "Invalid Default Value",
  description: "Default value doesn't match field's declared type",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const entry of workspace.allSchemaEntries()) {
      for (const field of entry.fields) {
        if (field.defaultValue === null) {
          continue;
        }

        // Use typed default value matching
        if (!TypeExpr.matchesDefaultValue(field.defaultValue, field.type)) {
          ctx.report({
            message: `Invalid default value '${field.defaultValue.raw}' for field '${field.name}'. Expected ${TypeExpr.toString(field.type)}.`,
            file: entry.file,
            location: field.location ?? entry.location,
            data: {
              fieldName: field.name,
              defaultValue: field.defaultValue.raw,
              expectedType: TypeExpr.toString(field.type),
            },
          });
        }
      }
    }
  },
};
