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

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "schema_entry") {
          continue;
        }
        if (entry.header.directive !== "define-entity") {
          continue;
        }

        const sectionCount = entry.sectionsBlock?.sections.length ?? 0;
        if (sectionCount === 0) {
          const entityName = entry.header.entityName.value;
          ctx.report({
            message: `Entity definition '${entityName}' must have at least one section.`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: { entityName },
          });
        }
      }
    }
  },
};
