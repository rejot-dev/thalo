import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check that create entries have at least one section in their content
 */
export const createRequiresSectionRule: Rule = {
  code: "create-requires-section",
  name: "Create Requires Section",
  description: "Create entry must use at least one section",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const entry of workspace.allInstanceEntries()) {
      if (entry.directive !== "create") {
        continue;
      }

      if (entry.sections.length === 0) {
        ctx.report({
          message: `Create entry '${entry.title}' must use at least one section.`,
          file: entry.file,
          location: entry.location,
          data: { title: entry.title, entity: entry.entity },
        });
      }
    }
  },
};
