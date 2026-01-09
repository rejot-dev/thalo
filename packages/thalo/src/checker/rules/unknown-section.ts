import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor } from "../visitor.js";
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

const visitor: RuleVisitor = {
  visitInstanceEntry(entry, ctx) {
    const registry = ctx.workspace.schemaRegistry;
    const entity = entry.header.entity;
    const schema = registry.get(entity);

    if (!schema) {
      return; // Will be caught by unknown-entity rule
    }

    for (const sectionName of getSectionNames(entry)) {
      if (!schema.sections.has(sectionName)) {
        ctx.report({
          message: `Unknown section '${sectionName}' for entity '${entity}'.`,
          file: ctx.file,
          location: entry.location, // Ideally we'd have the section's location
          sourceMap: ctx.sourceMap,
          data: { section: sectionName, entity },
        });
      }
    }
  },
};

/**
 * Check for sections in content not defined in the entity schema
 */
export const unknownSectionRule: Rule = {
  code: "unknown-section",
  name: "Unknown Section",
  description: "Section not defined in entity schema",
  category,
  defaultSeverity: "warning",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
