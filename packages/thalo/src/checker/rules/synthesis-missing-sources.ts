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

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "synthesis_entry") {
          continue;
        }

        const title = entry.header.title.value;
        const linkId = entry.header.linkId.id;
        const sourcesMetadata = entry.metadata.find((m) => m.key.value === "sources");

        if (!sourcesMetadata) {
          ctx.report({
            message: `Synthesis '${title}' is missing a 'sources:' field. Add a query like 'sources: lore where subject = ^self'.`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: { title, linkId },
          });
        }
      }
    }
  },
};
