import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check for instance entries using undefined entity types
 */
export const unknownEntityRule: Rule = {
  code: "unknown-entity",
  name: "Unknown Entity",
  description: "Instance entry uses an undefined entity type",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

    for (const entry of workspace.allInstanceEntries()) {
      if (!registry.has(entry.entity)) {
        ctx.report({
          message: `Unknown entity type '${entry.entity}'. Define it using 'define-entity ${entry.entity}'.`,
          file: entry.file,
          location: entry.location,
          sourceMap: entry.sourceMap,
          data: { entity: entry.entity },
        });
      }
    }
  },
};
