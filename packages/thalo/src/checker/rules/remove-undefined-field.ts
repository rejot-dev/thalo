import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "schema";

const visitor: RuleVisitor = {
  visitSchemaEntry(entry, ctx) {
    if (entry.header.directive !== "alter-entity") {
      return;
    }

    const removeFields = entry.removeMetadataBlock?.fields ?? [];
    if (removeFields.length === 0) {
      return;
    }

    const entityName = entry.header.entityName.value;
    const schema = ctx.workspace.schemaRegistry.get(entityName);

    if (!schema) {
      return; // Will be caught by alter-undefined-entity rule
    }

    for (const removal of removeFields) {
      const fieldName = removal.name.value;
      if (!schema.fields.has(fieldName)) {
        ctx.report({
          message: `Cannot remove field '${fieldName}' from entity '${entityName}': field does not exist.`,
          file: ctx.file,
          location: removal.location,
          sourceMap: ctx.sourceMap,
          data: { fieldName, entityName },
        });
      }
    }
  },
};

/**
 * Check for alter-entity trying to remove fields that don't exist in the schema
 */
export const removeUndefinedFieldRule: Rule = {
  code: "remove-undefined-field",
  name: "Remove Undefined Field",
  description: "# Remove Metadata references nonexistent field",
  category,
  defaultSeverity: "warning",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
