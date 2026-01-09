import type { Rule, RuleCategory } from "../types.js";
import type { InstanceEntry } from "../../ast/types.js";

const category: RuleCategory = "instance";

/**
 * Extract section names from entry content (markdown headers)
 */
function getSectionNames(entry: InstanceEntry): string[] {
  if (!entry.content) {
    return [];
  }
  return entry.content.children
    .filter((c) => c.type === "markdown_header")
    .map((h) => {
      // Extract section name from "# SectionName" format
      const match = h.text.match(/^#+\s*(.+)$/);
      return match ? match[1].trim() : h.text;
    });
}

/**
 * Check for sections in content not defined in the entity schema
 */
export const unknownSectionRule: Rule = {
  code: "unknown-section",
  name: "Unknown Section",
  description: "Section not defined in entity schema",
  category,
  defaultSeverity: "warning",

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

        for (const sectionName of getSectionNames(entry)) {
          if (!schema.sections.has(sectionName)) {
            ctx.report({
              message: `Unknown section '${sectionName}' for entity '${entity}'.`,
              file: model.file,
              location: entry.location, // Ideally we'd have the section's location
              sourceMap: model.sourceMap,
              data: { section: sectionName, entity },
            });
          }
        }
      }
    }
  },
};
