import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "schema";

const visitor: RuleVisitor = {
  visitSchemaEntry(entry, ctx) {
    if (entry.header.directive !== "define-entity") {
      return;
    }

    const sectionCount = entry.sectionsBlock?.sections.length ?? 0;
    if (sectionCount === 0) {
      const entityName = entry.header.entityName.value;
      ctx.report({
        message: `Entity definition '${entityName}' must have at least one section.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { entityName },
      });
    }
  },
};

/**
 * Check that define-entity entries have at least one section defined
 */
export const defineEntityRequiresSectionRule: Rule = {
  code: "define-entity-requires-section",
  name: "Define Entity Requires Section",
  description: "Entity definition must have at least one section",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry" },
  visitor,
};
