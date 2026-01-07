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

    for (const doc of workspace.allDocuments()) {
      for (const actualize of doc.actualizeEntries) {
        const targetDef = workspace.getLinkDefinition(actualize.target);

        if (!targetDef) {
          ctx.report({
            message: `Actualize references undefined synthesis '^${actualize.target}'. Define a synthesis with this link ID first.`,
            file: actualize.file,
            location: actualize.location,
            data: { target: actualize.target },
          });
        } else if (targetDef.entry.kind !== "synthesis") {
          ctx.report({
            message: `Actualize target '^${actualize.target}' is not a synthesis definition (found '${targetDef.entry.kind}' entry).`,
            file: actualize.file,
            location: actualize.location,
            data: { target: actualize.target, actualKind: targetDef.entry.kind },
          });
        }
      }
    }
  },
};
