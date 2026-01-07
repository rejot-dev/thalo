import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "schema";
import type { ModelSchemaEntry } from "../../model/types.js";

/**
 * Check for multiple define-entity entries for the same entity name
 */
export const duplicateEntityDefinitionRule: Rule = {
  code: "duplicate-entity-definition",
  name: "Duplicate Entity Definition",
  description: "Multiple define-entity for the same entity name",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    // Track all define-entity entries by entity name
    const definesByName = new Map<string, ModelSchemaEntry[]>();

    for (const entry of workspace.allSchemaEntries()) {
      if (entry.directive === "define-entity") {
        const defs = definesByName.get(entry.entityName) ?? [];
        defs.push(entry);
        definesByName.set(entry.entityName, defs);
      }
    }

    // Report duplicates
    for (const [entityName, defs] of definesByName) {
      if (defs.length > 1) {
        for (const def of defs) {
          const otherLocations = defs
            .filter((d) => d !== def)
            .map((d) => `${d.file}:${d.location.startPosition.row + 1}`)
            .join(", ");

          ctx.report({
            message: `Duplicate definition for entity '${entityName}'. Also defined at: ${otherLocations}`,
            file: def.file,
            location: def.location,
            data: { entityName, otherLocations },
          });
        }
      }
    }
  },
};
