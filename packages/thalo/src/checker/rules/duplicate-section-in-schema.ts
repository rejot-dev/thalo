import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "schema";

const visitor: RuleVisitor = {
  visitSchemaEntry(entry, ctx) {
    const sections = entry.sectionsBlock?.sections ?? [];
    const seenSections = new Map<string, number>();

    for (const section of sections) {
      const sectionName = section.name.value;
      const sectionLine = section.location?.startPosition.row ?? 0;
      const existingLine = seenSections.get(sectionName);

      if (existingLine !== undefined) {
        ctx.report({
          message: `Duplicate section '${sectionName}' in schema entry. First defined at line ${existingLine}.`,
          file: ctx.file,
          location: section.location,
          sourceMap: ctx.sourceMap,
          data: { sectionName, firstLine: existingLine },
        });
      } else {
        seenSections.set(sectionName, sectionLine + 1);
      }
    }
  },
};

/**
 * Check for duplicate section names within a single schema entry
 */
export const duplicateSectionInSchemaRule: Rule = {
  code: "duplicate-section-in-schema",
  name: "Duplicate Section in Schema",
  description: "Same section defined twice in a schema entry",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry" },
  visitor,
};
