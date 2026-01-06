import type { Rule } from "../types.js";

/**
 * Check for alter-entity entries targeting entities that were never defined
 */
export const alterUndefinedEntityRule: Rule = {
  code: "alter-undefined-entity",
  name: "Alter Undefined Entity",
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    // Collect all defined entity names
    const definedEntities = new Set<string>();
    for (const entry of workspace.allSchemaEntries()) {
      if (entry.directive === "define-entity") {
        definedEntities.add(entry.entityName);
      }
    }

    // Check alter-entity entries
    for (const entry of workspace.allSchemaEntries()) {
      if (entry.directive === "alter-entity") {
        if (!definedEntities.has(entry.entityName)) {
          ctx.report({
            message: `Cannot alter undefined entity '${entry.entityName}'. Define it first using 'define-entity ${entry.entityName}'.`,
            file: entry.file,
            location: entry.location,
            data: { entityName: entry.entityName },
          });
        }
      }
    }
  },
};
