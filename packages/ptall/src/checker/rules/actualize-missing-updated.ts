import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "metadata";

/**
 * Check that actualize-synthesis entries have an updated field
 */
export const actualizeMissingUpdatedRule: Rule = {
  code: "actualize-missing-updated",
  name: "Actualize Missing Updated",
  description: "An actualize-synthesis entry must have an 'updated:' field with a timestamp",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const doc of workspace.allDocuments()) {
      for (const actualize of doc.actualizeEntries) {
        const updatedField = actualize.metadata.get("updated");

        if (!updatedField) {
          ctx.report({
            message: `Actualize entry is missing 'updated:' field. Add 'updated: ${actualize.timestamp}' to track when this synthesis was last run.`,
            file: actualize.file,
            location: actualize.location,
            data: { target: actualize.target, suggestedTimestamp: actualize.timestamp },
          });
        }
      }
    }
  },
};
