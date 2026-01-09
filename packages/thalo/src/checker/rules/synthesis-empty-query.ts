import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

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

  check(ctx) {
    const { workspace } = ctx;

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "synthesis_entry") {
          continue;
        }

        const title = entry.header.title.value;
        const sourcesMetadata = entry.metadata.find((m) => m.key.value === "sources");

        if (!sourcesMetadata) {
          // Missing sources is handled by synthesis-missing-sources rule
          continue;
        }

        // Check if sources value is empty or just whitespace
        const sourcesValue = sourcesMetadata.value;
        if (
          sourcesValue.content.type === "quoted_value" &&
          sourcesValue.content.value.trim() === ""
        ) {
          ctx.report({
            message: `Synthesis '${title}' has an empty query. Specify an entity type like 'lore', 'journal', 'opinion', or 'reference'.`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: { title },
          });
        }
      }
    }
  },
};
