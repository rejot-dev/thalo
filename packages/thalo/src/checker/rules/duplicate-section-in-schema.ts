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

    for (const entry of workspace.allSchemaEntries()) {
      const seenSections = new Map<string, number>();

      for (const section of entry.sections) {
        const sectionLine = section.location?.startPosition.row ?? 0;
        const existingLine = seenSections.get(section.name);
        if (existingLine !== undefined) {
          ctx.report({
            message: `Duplicate section '${section.name}' in schema entry. First defined at line ${existingLine}.`,
            file: entry.file,
            location: section.location ?? entry.location,
            sourceMap: entry.sourceMap,
            data: { sectionName: section.name, firstLine: existingLine },
          });
        } else {
          seenSections.set(section.name, sectionLine + 1);
        }
      }
    }
  },
};
