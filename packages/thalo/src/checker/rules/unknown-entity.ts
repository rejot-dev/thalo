import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check for instance entries using undefined entity types
 */
export const unknownEntityRule: Rule = {
  code: "unknown-entity",
  name: "Unknown Entity",
  description: "Instance entry uses an undefined entity type",
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
        if (!registry.has(entity)) {
          ctx.report({
            message: `Unknown entity type '${entity}'. Define it using 'define-entity ${entity}'.`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: { entity },
          });
        }
      }
    }
  },
};
