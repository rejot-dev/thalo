import type { Rule, RuleCategory } from "../rules/rules.js";

const category: RuleCategory = "metadata";

/**
 * Check for duplicate metadata keys within a single instance entry
 *
 * Note: This rule is a placeholder. The parser collapses duplicate keys into a Map,
 * so detection would require AST-level checking before model extraction.
 */
export const duplicateMetadataKeyRule: Rule = {
  code: "duplicate-metadata-key",
  name: "Duplicate Metadata Key",
  description: "Same metadata key appears twice in an entry",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry" },
  visitor: {},
};
