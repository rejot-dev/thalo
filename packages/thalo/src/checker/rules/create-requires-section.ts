import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check that create entries have at least one section in their content
 */
export const createRequiresSectionRule: Rule = {
  code: "create-requires-section",
  name: "Create Requires Section",
  description: "Create entry must use at least one section",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "instance_entry") {
          continue;
        }
        if (entry.header.directive !== "create") {
          continue;
        }

        // Count markdown headers (sections) in content
        const content = entry.content;
        const sectionCount =
          content?.children.filter((c) => c.type === "markdown_header").length ?? 0;

        if (sectionCount === 0) {
          const title = entry.header.title?.value ?? "(no title)";
          ctx.report({
            message: `Create entry '${title}' must use at least one section.`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: { title, entity: entry.header.entity },
          });
        }
      }
    }
  },
};
