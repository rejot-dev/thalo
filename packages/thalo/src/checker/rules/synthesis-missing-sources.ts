import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "instance";

const visitor: RuleVisitor = {
  visitSynthesisEntry(entry, ctx) {
    const title = entry.header.title.value;
    const linkId = entry.header.linkId.id;
    const sourcesMetadata = entry.metadata.find((m) => m.key.value === "sources");

    if (!sourcesMetadata) {
      ctx.report({
        message: `Synthesis '${title}' is missing a 'sources:' field. Add a query like 'sources: lore where subject = ^self'.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { title, linkId },
      });
    }
  },
};

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
  dependencies: { scope: "entry" },
  visitor,
};
