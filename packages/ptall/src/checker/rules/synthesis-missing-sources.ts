import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check that define-synthesis entries have a sources field
 */
export const synthesisMissingSourcesRule: Rule = {
  code: "synthesis-missing-sources",
  name: "Synthesis Missing Sources",
  description:
    "A define-synthesis entry must have a 'sources:' field specifying which entries to query",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const doc of workspace.allDocuments()) {
      for (const synthesis of doc.synthesisEntries) {
        if (synthesis.sources.length === 0) {
          ctx.report({
            message: `Synthesis '${synthesis.title}' is missing a 'sources:' field. Add a query like 'sources: lore where subject = ^self'.`,
            file: synthesis.file,
            location: synthesis.location,
            data: { title: synthesis.title, linkId: synthesis.linkId },
          });
        }
      }
    }
  },
};
