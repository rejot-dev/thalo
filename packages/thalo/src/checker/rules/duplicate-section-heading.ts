import type { Rule, RuleCategory } from "../types.js";
import type { InstanceEntry, MarkdownHeader } from "../../ast/types.js";

const category: RuleCategory = "content";

/**
 * Extract markdown headers from entry content
 */
function getMarkdownHeaders(entry: InstanceEntry): MarkdownHeader[] {
  if (!entry.content) {
    return [];
  }
  return entry.content.children.filter((c): c is MarkdownHeader => c.type === "markdown_header");
}

/**
 * Check for duplicate section headings within a single entry's content
 */
export const duplicateSectionHeadingRule: Rule = {
  code: "duplicate-section-heading",
  name: "Duplicate Section Heading",
  description: "Same # Section appears twice in entry content",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "instance_entry") {
          continue;
        }

        const headers = getMarkdownHeaders(entry);
        const seenSections = new Map<string, MarkdownHeader>();

        for (const header of headers) {
          // Extract section name from "# SectionName" format
          const match = header.text.match(/^#+\s*(.+)$/);
          const sectionName = match ? match[1].trim() : header.text;
          const existing = seenSections.get(sectionName);

          if (existing) {
            ctx.report({
              message: `Duplicate section heading '# ${sectionName}' in entry content.`,
              file: model.file,
              location: header.location,
              sourceMap: model.sourceMap,
              data: { sectionName },
            });
          } else {
            seenSections.set(sectionName, header);
          }
        }
      }
    }
  },
};
