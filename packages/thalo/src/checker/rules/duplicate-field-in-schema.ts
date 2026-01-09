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

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "schema_entry") {
          continue;
        }

        const fields = entry.metadataBlock?.fields ?? [];
        const seenFields = new Map<string, number>();

        for (const field of fields) {
          const fieldName = field.name.value;
          const fieldLine = field.location?.startPosition.row ?? 0;
          const existingLine = seenFields.get(fieldName);

          if (existingLine !== undefined) {
            ctx.report({
              message: `Duplicate field '${fieldName}' in schema entry. First defined at line ${existingLine}.`,
              file: model.file,
              location: field.location,
              sourceMap: model.sourceMap,
              data: { fieldName, firstLine: existingLine },
            });
          } else {
            seenFields.set(fieldName, fieldLine + 1);
          }
        }
      }
    }
  },
};
