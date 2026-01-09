import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "instance";

const visitor: RuleVisitor = {
  visitInstanceEntry(entry, ctx) {
    const registry = ctx.workspace.schemaRegistry;
    const entity = entry.header.entity;

    if (!registry.has(entity)) {
      ctx.report({
        message: `Unknown entity type '${entity}'. Define it using 'define-entity ${entity}'.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { entity },
      });
    }
  },
};

/**
 * Check for instance entries using undefined entity types
 */
export const unknownEntityRule: Rule = {
  code: "unknown-entity",
  name: "Unknown Entity",
  description: "Instance entry uses an undefined entity type",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
