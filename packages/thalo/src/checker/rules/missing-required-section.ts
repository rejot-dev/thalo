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

    const presentSections = getSectionNames(entry);

    for (const [sectionName, sectionSchema] of schema.sections) {
      if (sectionSchema.optional) {
        continue;
      }

      if (!presentSections.includes(sectionName)) {
        ctx.report({
          message: `Missing required section '${sectionName}' for entity '${entity}'.`,
          file: ctx.file,
          location: entry.location,
          sourceMap: ctx.sourceMap,
          data: { section: sectionName, entity },
        });
      }
    }
  },
};

/**
 * Check for missing required sections in instance entry content
 */
export const missingRequiredSectionRule: Rule = {
  code: "missing-required-section",
  name: "Missing Required Section",
  description: "Required section not present in content",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
