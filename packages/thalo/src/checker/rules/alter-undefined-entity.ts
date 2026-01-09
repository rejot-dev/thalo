import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "schema";

/**
 * Check for alter-entity entries targeting entities that were never defined
 */
export const alterUndefinedEntityRule: Rule = {
  code: "alter-undefined-entity",
  name: "Alter Undefined Entity",
  description: "alter-entity targets an undefined entity",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    // Collect all defined entity names
    const definedEntities = new Set<string>();
    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type === "schema_entry" && entry.header.directive === "define-entity") {
          definedEntities.add(entry.header.entityName.value);
        }
      }
    }

    // Check alter-entity entries
    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "schema_entry") {
          continue;
        }
        if (entry.header.directive !== "alter-entity") {
          continue;
        }

        const entityName = entry.header.entityName.value;
        if (!definedEntities.has(entityName)) {
          ctx.report({
            message: `Cannot alter undefined entity '${entityName}'. Define it first using 'define-entity ${entityName}'.`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: { entityName },
          });
        }
      }
    }
  },
};
