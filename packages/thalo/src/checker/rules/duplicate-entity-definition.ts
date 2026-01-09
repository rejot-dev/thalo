import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor, VisitorContext } from "../visitor.js";

const category: RuleCategory = "schema";

const visitor: RuleVisitor = {
  afterCheck(ctx: VisitorContext) {
    const { index } = ctx;

    // Report duplicates
    for (const [entityName, defs] of index.defineEntitiesByName) {
      if (defs.length > 1) {
        for (const { entry, file, sourceMap } of defs) {
          const otherLocations = defs
            .filter((d) => d.entry !== entry)
            .map((d) => `${d.file}:${d.entry.location.startPosition.row + 1}`)
            .join(", ");

          ctx.report({
            message: `Duplicate definition for entity '${entityName}'. Also defined at: ${otherLocations}`,
            file,
            location: entry.location,
            sourceMap,
            data: { entityName, otherLocations },
          });
        }
      }
    }
  },
};

/**
 * Check for multiple define-entity entries for the same entity name
 */
export const duplicateEntityDefinitionRule: Rule = {
  code: "duplicate-entity-definition",
  name: "Duplicate Entity Definition",
  description: "Multiple define-entity for the same entity name",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "workspace", schemas: true },
  visitor,
};
