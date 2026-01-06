import type { Rule } from "../types.js";

/**
 * Check for sections in content not defined in the entity schema
 */
export const unknownSectionRule: Rule = {
  code: "unknown-section",
  name: "Unknown Section",
  defaultSeverity: "warning",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

    for (const entry of workspace.allInstanceEntries()) {
      const schema = registry.get(entry.entity);
      if (!schema) {
        continue;
      } // Will be caught by unknown-entity rule

      for (const sectionName of entry.sections) {
        if (!schema.sections.has(sectionName)) {
          ctx.report({
            message: `Unknown section '${sectionName}' for entity '${entry.entity}'.`,
            file: entry.file,
            location: entry.location, // Ideally we'd have the section's location
            data: { section: sectionName, entity: entry.entity },
          });
        }
      }
    }
  },
};
