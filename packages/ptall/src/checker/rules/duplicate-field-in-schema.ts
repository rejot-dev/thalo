import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "schema";

/**
 * Check for duplicate field names within a single schema entry
 */
export const duplicateFieldInSchemaRule: Rule = {
  code: "duplicate-field-in-schema",
  name: "Duplicate Field in Schema",
  description: "Same field defined twice in a schema entry",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const entry of workspace.allSchemaEntries()) {
      const seenFields = new Map<string, number>();

      for (const field of entry.fields) {
        const fieldLine = field.location?.startPosition.row ?? 0;
        const existingLine = seenFields.get(field.name);
        if (existingLine !== undefined) {
          ctx.report({
            message: `Duplicate field '${field.name}' in schema entry. First defined at line ${existingLine}.`,
            file: entry.file,
            location: field.location ?? entry.location,
            data: { fieldName: field.name, firstLine: existingLine },
          });
        } else {
          seenFields.set(field.name, fieldLine + 1);
        }
      }
    }
  },
};
