import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "schema";

const visitor: RuleVisitor = {
  visitSchemaEntry(entry, ctx) {
    if (entry.header.directive !== "alter-entity") {
      return;
    }

    const removeSections = entry.removeSectionsBlock?.sections ?? [];
    if (removeSections.length === 0) {
      return;
    }

    const entityName = entry.header.entityName.value;
    const schema = ctx.workspace.schemaRegistry.get(entityName);

    if (!schema) {
      return; // Will be caught by alter-undefined-entity rule
    }

    for (const removal of removeSections) {
      const sectionName = removal.name.value;
      if (!schema.sections.has(sectionName)) {
        ctx.report({
          message: `Cannot remove section '${sectionName}' from entity '${entityName}': section does not exist.`,
          file: ctx.file,
          location: removal.location,
          sourceMap: ctx.sourceMap,
          data: { sectionName, entityName },
        });
      }
    }
  },
};

/**
 * Check for alter-entity trying to remove sections that don't exist in the schema
 */
export const removeUndefinedSectionRule: Rule = {
  code: "remove-undefined-section",
  name: "Remove Undefined Section",
  description: "# Remove Sections references nonexistent section",
  category,
  defaultSeverity: "warning",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
