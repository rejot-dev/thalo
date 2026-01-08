import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "schema";

/**
 * Check that define-entity entries have at least one section defined
 */
export const defineEntityRequiresSectionRule: Rule = {
  code: "define-entity-requires-section",
  name: "Define Entity Requires Section",
  description: "Entity definition must have at least one section",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const entry of workspace.allSchemaEntries()) {
      if (entry.directive !== "define-entity") {
        continue;
      }

      if (entry.sections.length === 0) {
        ctx.report({
          message: `Entity definition '${entry.entityName}' must have at least one section.`,
          file: entry.file,
          location: entry.location,
          sourceMap: entry.sourceMap,
          data: { entityName: entry.entityName },
        });
      }
    }
  },
};
