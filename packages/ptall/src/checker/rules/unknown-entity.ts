import type { Rule } from "../types.js";

/**
 * Check for instance entries using undefined entity types
 */
export const unknownEntityRule: Rule = {
  code: "unknown-entity",
  name: "Unknown Entity",
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
          data: { entity: entry.entity },
        });
      }
    }
  },
};
