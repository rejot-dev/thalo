import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check for missing required sections in instance entry content
 */
export const missingRequiredSectionRule: Rule = {
  code: "missing-required-section",
  name: "Missing Required Section",
  description: "Required section not present in content",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

    for (const entry of workspace.allInstanceEntries()) {
      const schema = registry.get(entry.entity);
      if (!schema) {
        continue;
      } // Will be caught by unknown-entity rule

      for (const [sectionName, sectionSchema] of schema.sections) {
        if (sectionSchema.optional) {
          continue;
        }

        if (!entry.sections.includes(sectionName)) {
          ctx.report({
            message: `Missing required section '${sectionName}' for entity '${entry.entity}'.`,
            file: entry.file,
            location: entry.location,
            sourceMap: entry.sourceMap,
            data: { section: sectionName, entity: entry.entity },
          });
        }
      }
    }
  },
};
