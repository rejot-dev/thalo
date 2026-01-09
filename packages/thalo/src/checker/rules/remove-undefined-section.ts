import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "schema";

/**
 * Check for alter-entity trying to remove sections that don't exist in the schema
 */
export const removeUndefinedSectionRule: Rule = {
  code: "remove-undefined-section",
  name: "Remove Undefined Section",
  description: "# Remove Sections references nonexistent section",
  category,
  defaultSeverity: "warning",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "schema_entry") {
          continue;
        }
        if (entry.header.directive !== "alter-entity") {
          continue;
        }

        const removeSections = entry.removeSectionsBlock?.sections ?? [];
        if (removeSections.length === 0) {
          continue;
        }

        const entityName = entry.header.entityName.value;
        const schema = registry.get(entityName);
        if (!schema) {
          continue;
        } // Will be caught by alter-undefined-entity rule

        for (const removal of removeSections) {
          const sectionName = removal.name.value;
          if (!schema.sections.has(sectionName)) {
            ctx.report({
              message: `Cannot remove section '${sectionName}' from entity '${entityName}': section does not exist.`,
              file: model.file,
              location: removal.location,
              sourceMap: model.sourceMap,
              data: { sectionName, entityName },
            });
          }
        }
      }
    }
  },
};
