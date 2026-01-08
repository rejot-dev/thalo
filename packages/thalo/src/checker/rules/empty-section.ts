import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "content";

/**
 * Check for section headings that have no content
 *
 * Note: This rule requires access to the raw content to check for empty sections.
 * Currently, we only have section names extracted from the content.
 * A full implementation would need to analyze the content structure.
 *
 * For now, this is a placeholder that documents the intended behavior.
 */
export const emptySectionRule: Rule = {
  code: "empty-section",
  name: "Empty Section",
  description: "Section heading exists but has no content",
  category,
  defaultSeverity: "warning",

  check(ctx) {
    const { workspace } = ctx;

    // To properly detect empty sections, we'd need:
    // 1. Access to the raw content or AST with section boundaries
    // 2. Logic to determine where each section starts and ends
    //
    // Current limitation: We only have section names from entry.sections[],
    // not the full content structure to determine if sections are empty.
    //
    // This would require changes to the model to include:
    // - Section content or boundaries
    // - Or access to the original AST during checking

    for (const _entry of workspace.allInstanceEntries()) {
      // Placeholder - full implementation would check content between sections
    }
  },
};
