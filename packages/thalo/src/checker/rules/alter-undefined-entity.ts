import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor, VisitorContext } from "../visitor.js";

const category: RuleCategory = "schema";

const visitor: RuleVisitor = {
  afterCheck(ctx: VisitorContext) {
    const { index } = ctx;

    // Get all defined entity names
    const definedEntities = new Set(index.defineEntitiesByName.keys());

    // Check alter-entity entries
    for (const [entityName, alters] of index.alterEntitiesByName) {
      if (!definedEntities.has(entityName)) {
        for (const { entry, file, sourceMap } of alters) {
          ctx.report({
            message: `Cannot alter undefined entity '${entityName}'. Define it first using 'define-entity ${entityName}'.`,
            file,
            location: entry.location,
            sourceMap,
            data: { entityName },
          });
        }
      }
    }
  },
};

/**
 * Check for alter-entity entries targeting entities that were never defined
 */
export const alterUndefinedEntityRule: Rule = {
  code: "alter-undefined-entity",
  name: "Alter Undefined Entity",
  description: "alter-entity targets an undefined entity",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "workspace", schemas: true },
  visitor,
};
