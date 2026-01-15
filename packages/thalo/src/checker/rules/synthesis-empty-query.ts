import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "instance";

const visitor: RuleVisitor = {
  visitSynthesisEntry(entry, ctx) {
    const title = entry.header.title.value;
    const sourcesMetadata = entry.metadata.find((m) => m.key.value === "sources");

    if (!sourcesMetadata) {
      // Missing sources is handled by synthesis-missing-sources rule
      return;
    }

    // Check if sources value is empty or just whitespace
    const sourcesValue = sourcesMetadata.value;
    if (sourcesValue.content.type === "quoted_value" && sourcesValue.content.value.trim() === "") {
      ctx.report({
        message: `Synthesis '${title}' has an empty query. Specify an entity type like 'lore', 'journal', 'opinion', or 'reference'.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { title },
      });
    }
  },
};

/**
 * Check that synthesis queries have at least an entity type
 *
 * Note: This rule validates the "sources:" metadata value exists and contains
 * valid query syntax. Query validation is simplified since the full query parsing
 * happens at a different layer.
 */
export const synthesisEmptyQueryRule: Rule = {
  code: "synthesis-empty-query",
  name: "Synthesis Empty Query",
  description: "A synthesis source query must specify an entity type",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry" },
  visitor,
};
