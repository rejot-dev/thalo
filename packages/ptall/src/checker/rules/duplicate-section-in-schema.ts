import type { Rule } from "../types.js";

/**
 * Check for duplicate section names within a single schema entry
 */
export const duplicateSectionInSchemaRule: Rule = {
  code: "duplicate-section-in-schema",
  name: "Duplicate Section in Schema",
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
            data: { sectionName: section.name, firstLine: existingLine },
          });
        } else {
          seenSections.set(section.name, sectionLine + 1);
        }
      }
    }
  },
};
