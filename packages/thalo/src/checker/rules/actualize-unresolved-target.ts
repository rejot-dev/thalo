import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "link";

const visitor: RuleVisitor = {
  visitActualizeEntry(entry, ctx) {
    const targetId = entry.header.target.id;
    const targetDef = ctx.workspace.getLinkDefinition(targetId);

    if (!targetDef) {
      ctx.report({
        message: `Actualize references undefined synthesis '^${targetId}'. Define a synthesis with this link ID first.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { target: targetId },
      });
    } else if (targetDef.entry.type !== "synthesis_entry") {
      ctx.report({
        message: `Actualize target '^${targetId}' is not a synthesis definition (found '${targetDef.entry.type}' entry).`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { target: targetId, actualKind: targetDef.entry.type },
      });
    }
  },
};

/**
 * Check that actualize-synthesis entries reference a valid synthesis definition
 */
export const actualizeUnresolvedTargetRule: Rule = {
  code: "actualize-unresolved-target",
  name: "Actualize Unresolved Target",
  description: "An actualize-synthesis must reference a defined synthesis",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry", links: true },
  visitor,
};
