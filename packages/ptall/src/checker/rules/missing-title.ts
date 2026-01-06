import type { Rule } from "../types.js";

/**
 * Check for entries with empty titles
 */
export const missingTitleRule: Rule = {
  code: "missing-title",
  name: "Missing Title",
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    // Check instance entries
    for (const entry of workspace.allInstanceEntries()) {
      if (!entry.title || entry.title.trim() === "") {
        ctx.report({
          message: `Entry is missing a title. Provide a descriptive title in quotes.`,
          file: entry.file,
          location: entry.location,
          data: { directive: entry.directive, entity: entry.entity },
        });
      }
    }

    // Check schema entries
    for (const entry of workspace.allSchemaEntries()) {
      if (!entry.title || entry.title.trim() === "") {
        ctx.report({
          message: `Schema entry is missing a title/description. Provide a description in quotes.`,
          file: entry.file,
          location: entry.location,
          data: { directive: entry.directive, entityName: entry.entityName },
        });
      }
    }
  },
};
