import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";
import type { InstanceEntry } from "../../ast/ast-types.js";

const category: RuleCategory = "instance";

/**
 * Get metadata field names from entry
 */
function getMetadataFieldNames(entry: InstanceEntry): Set<string> {
  return new Set(entry.metadata.map((m) => m.key.value));
}

const visitor: RuleVisitor = {
  visitInstanceEntry(entry, ctx) {
    const registry = ctx.workspace.schemaRegistry;
    const entity = entry.header.entity;
    const schema = registry.get(entity);

    if (!schema) {
      return; // Will be caught by unknown-entity rule
    }

    const presentFields = getMetadataFieldNames(entry);

    for (const [fieldName, fieldSchema] of schema.fields) {
      if (fieldSchema.optional) {
        continue;
      }
      if (fieldSchema.defaultValue !== null) {
        continue; // Has default, not required
      }

      if (!presentFields.has(fieldName)) {
        ctx.report({
          message: `Missing required field '${fieldName}' for entity '${entity}'.`,
          file: ctx.file,
          location: entry.location,
          sourceMap: ctx.sourceMap,
          data: { field: fieldName, entity },
        });
      }
    }
  },
};

/**
 * Check for missing required metadata fields in instance entries
 */
export const missingRequiredFieldRule: Rule = {
  code: "missing-required-field",
  name: "Missing Required Field",
  description: "Required metadata field not present",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
