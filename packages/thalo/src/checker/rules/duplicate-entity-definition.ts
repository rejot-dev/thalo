import type { Rule, RuleCategory } from "../types.js";
import type { SchemaEntry } from "../../ast/types.js";
import type { SemanticModel } from "../../semantic/types.js";

const category: RuleCategory = "schema";

interface SchemaEntryContext {
  entry: SchemaEntry;
  model: SemanticModel;
}

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
    const definesByName = new Map<string, SchemaEntryContext[]>();

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "schema_entry") {
          continue;
        }
        if (entry.header.directive !== "define-entity") {
          continue;
        }

        const entityName = entry.header.entityName.value;
        const defs = definesByName.get(entityName) ?? [];
        defs.push({ entry, model });
        definesByName.set(entityName, defs);
      }
    }

    // Report duplicates
    for (const [entityName, defs] of definesByName) {
      if (defs.length > 1) {
        for (const { entry, model } of defs) {
          const otherLocations = defs
            .filter((d) => d.entry !== entry)
            .map((d) => `${d.model.file}:${d.entry.location.startPosition.row + 1}`)
            .join(", ");

          ctx.report({
            message: `Duplicate definition for entity '${entityName}'. Also defined at: ${otherLocations}`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: { entityName, otherLocations },
          });
        }
      }
    }
  },
};
