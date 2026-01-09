import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "content";

/**
 * Check for section headings that have no content
 *
 * Note: This rule is a placeholder. Detecting empty sections requires access to
 * section boundaries in the AST, which isn't currently available.
 */
export const emptySectionRule: Rule = {
  code: "empty-section",
  name: "Empty Section",
  description: "Section heading exists but has no content",
  category,
  defaultSeverity: "warning",
  dependencies: { scope: "entry" },
  visitor: {},
};
