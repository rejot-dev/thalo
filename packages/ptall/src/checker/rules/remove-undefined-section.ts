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

    for (const entry of workspace.allSchemaEntries()) {
      if (entry.directive !== "alter-entity" || entry.removeSections.length === 0) {
        continue;
      }

      // Get the schema as it was BEFORE this alter-entity
      const schema = registry.get(entry.entityName);
      if (!schema) {
        continue; // Will be caught by alter-undefined-entity rule
      }

      for (const sectionName of entry.removeSections) {
        // Check if this section exists in the current resolved schema
        if (!schema.sections.has(sectionName)) {
          ctx.report({
            message: `Cannot remove section '${sectionName}' from entity '${entry.entityName}': section does not exist.`,
            file: entry.file,
            location: entry.location,
            data: { sectionName, entityName: entry.entityName },
          });
        }
      }
    }
  },
};
