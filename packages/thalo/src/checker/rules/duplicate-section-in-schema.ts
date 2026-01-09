import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "schema";

/**
 * Check for duplicate section names within a single schema entry
 */
export const duplicateSectionInSchemaRule: Rule = {
  code: "duplicate-section-in-schema",
  name: "Duplicate Section in Schema",
  description: "Same section defined twice in a schema entry",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "schema_entry") {
          continue;
        }

        const sections = entry.sectionsBlock?.sections ?? [];
        const seenSections = new Map<string, number>();

        for (const section of sections) {
          const sectionName = section.name.value;
          const sectionLine = section.location?.startPosition.row ?? 0;
          const existingLine = seenSections.get(sectionName);

          if (existingLine !== undefined) {
            ctx.report({
              message: `Duplicate section '${sectionName}' in schema entry. First defined at line ${existingLine}.`,
              file: model.file,
              location: section.location,
              sourceMap: model.sourceMap,
              data: { sectionName, firstLine: existingLine },
            });
          } else {
            seenSections.set(sectionName, sectionLine + 1);
          }
        }
      }
    }
  },
};
