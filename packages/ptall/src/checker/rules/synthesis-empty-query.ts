import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check that synthesis queries have at least an entity type
 */
export const synthesisEmptyQueryRule: Rule = {
  code: "synthesis-empty-query",
  name: "Synthesis Empty Query",
  description: "A synthesis source query must specify an entity type",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const doc of workspace.allDocuments()) {
      for (const synthesis of doc.synthesisEntries) {
        for (const query of synthesis.sources) {
          if (!query.entity || query.entity.trim() === "") {
            ctx.report({
              message: `Synthesis '${synthesis.title}' has an empty query. Specify an entity type like 'lore', 'journal', 'opinion', or 'reference'.`,
              file: synthesis.file,
              location: synthesis.location,
              sourceMap: synthesis.sourceMap,
              data: { title: synthesis.title },
            });
          }
        }
      }
    }
  },
};
