import type { Rule, RuleCategory } from "../types.js";
import type { InstanceEntry } from "../../ast/types.js";

const category: RuleCategory = "instance";

/**
 * Get metadata field names from entry
 */
function getMetadataFieldNames(entry: InstanceEntry): Set<string> {
  return new Set(entry.metadata.map((m) => m.key.value));
}

/**
 * Check for missing required metadata fields in instance entries
 */
export const missingRequiredFieldRule: Rule = {
  code: "missing-required-field",
  name: "Missing Required Field",
  description: "Required metadata field not present",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;
    const registry = workspace.schemaRegistry;

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "instance_entry") {
          continue;
        }

        const entity = entry.header.entity;
        const schema = registry.get(entity);
        if (!schema) {
          continue;
        } // Will be caught by unknown-entity rule

        const presentFields = getMetadataFieldNames(entry);

        for (const [fieldName, fieldSchema] of schema.fields) {
          if (fieldSchema.optional) {
            continue;
          }
          if (fieldSchema.defaultValue !== null) {
            continue;
          } // Has default, not required

          if (!presentFields.has(fieldName)) {
            ctx.report({
              message: `Missing required field '${fieldName}' for entity '${entity}'.`,
              file: model.file,
              location: entry.location,
              sourceMap: model.sourceMap,
              data: { field: fieldName, entity },
            });
          }
        }
      }
    }
  },
};
