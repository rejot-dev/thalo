import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "schema";

const visitor: RuleVisitor = {
  visitSchemaEntry(entry, ctx) {
    const fields = entry.metadataBlock?.fields ?? [];
    const seenFields = new Map<string, number>();

    for (const field of fields) {
      const fieldName = field.name.value;
      const fieldLine = field.location?.startPosition.row ?? 0;
      const existingLine = seenFields.get(fieldName);

      if (existingLine !== undefined) {
        ctx.report({
          message: `Duplicate field '${fieldName}' in schema entry. First defined at line ${existingLine}.`,
          file: ctx.file,
          location: field.location,
          sourceMap: ctx.sourceMap,
          data: { fieldName, firstLine: existingLine },
        });
      } else {
        seenFields.set(fieldName, fieldLine + 1);
      }
    }
  },
};

/**
 * Check for duplicate field names within a single schema entry
 */
export const duplicateFieldInSchemaRule: Rule = {
  code: "duplicate-field-in-schema",
  name: "Duplicate Field in Schema",
  description: "Same field defined twice in a schema entry",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry" },
  visitor,
};
