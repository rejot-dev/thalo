import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "instance";

const visitor: RuleVisitor = {
  visitInstanceEntry(entry, ctx) {
    const registry = ctx.workspace.schemaRegistry;
    const entity = entry.header.entity;
    const schema = registry.get(entity);

    if (!schema) {
      return; // Will be caught by unknown-entity rule
    }

    for (const meta of entry.metadata) {
      const fieldName = meta.key.value;
      if (!schema.fields.has(fieldName)) {
        ctx.report({
          message: `Unknown field '${fieldName}' for entity '${entity}'.`,
          file: ctx.file,
          // Use key.location to point to the field name, not the leading indent
          location: meta.key.location,
          sourceMap: ctx.sourceMap,
          data: { field: fieldName, entity },
        });
      }
    }
  },
};

/**
 * Check for metadata fields not defined in the entity schema
 */
export const unknownFieldRule: Rule = {
  code: "unknown-field",
  name: "Unknown Field",
  description: "Metadata field not defined in entity schema",
  category,
  defaultSeverity: "warning",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
