import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "instance";

const visitor: RuleVisitor = {
  visitInstanceEntry(entry, ctx) {
    if (entry.header.directive !== "create") {
      return;
    }

    // Count markdown headers (sections) in content
    const content = entry.content;
    const sectionCount = content?.children.filter((c) => c.type === "markdown_header").length ?? 0;

    if (sectionCount === 0) {
      const title = entry.header.title?.value ?? "(no title)";
      ctx.report({
        message: `Create entry '${title}' must use at least one section.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { title, entity: entry.header.entity },
      });
    }
  },
};

/**
 * Check that create entries have at least one section in their content
 */
export const createRequiresSectionRule: Rule = {
  code: "create-requires-section",
  name: "Create Requires Section",
  description: "Create entry must use at least one section",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry" },
  visitor,
};
