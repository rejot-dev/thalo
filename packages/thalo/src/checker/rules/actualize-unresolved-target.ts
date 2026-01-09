import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "link";

/**
 * Check that actualize-synthesis entries reference a valid synthesis definition
 */
export const actualizeUnresolvedTargetRule: Rule = {
  code: "actualize-unresolved-target",
  name: "Actualize Unresolved Target",
  description: "An actualize-synthesis must reference a defined synthesis",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "actualize_entry") {
          continue;
        }

        const targetId = entry.header.target.id;
        const targetDef = workspace.getLinkDefinition(targetId);

        if (!targetDef) {
          ctx.report({
            message: `Actualize references undefined synthesis '^${targetId}'. Define a synthesis with this link ID first.`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: { target: targetId },
          });
        } else if (targetDef.entry.type !== "synthesis_entry") {
          ctx.report({
            message: `Actualize target '^${targetId}' is not a synthesis definition (found '${targetDef.entry.type}' entry).`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: { target: targetId, actualKind: targetDef.entry.type },
          });
        }
      }
    }
  },
};
