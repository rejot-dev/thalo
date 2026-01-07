import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "content";

/**
 * Check for duplicate section headings within a single entry's content
 */
export const duplicateSectionHeadingRule: Rule = {
  code: "duplicate-section-heading",
  name: "Duplicate Section Heading",
  description: "Same # Section appears twice in entry content",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const entry of workspace.allInstanceEntries()) {
      const seenSections = new Map<string, number>();

      for (let i = 0; i < entry.sections.length; i++) {
        const sectionName = entry.sections[i];
        const existingIndex = seenSections.get(sectionName);

        if (existingIndex !== undefined) {
          ctx.report({
            message: `Duplicate section heading '# ${sectionName}' in entry content.`,
            file: entry.file,
            location: entry.location, // Ideally we'd have the section's location
            data: { sectionName },
          });
        } else {
          seenSections.set(sectionName, i);
        }
      }
    }
  },
};
