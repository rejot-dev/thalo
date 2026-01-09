import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check for entries with empty titles
 */
export const missingTitleRule: Rule = {
  code: "missing-title",
  name: "Missing Title",
  description: "Entry has empty or missing title",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type === "instance_entry") {
          const title = entry.header.title?.value;
          if (!title || title.trim() === "") {
            ctx.report({
              message: `Entry is missing a title. Provide a descriptive title in quotes.`,
              file: model.file,
              location: entry.location,
              sourceMap: model.sourceMap,
              data: { directive: entry.header.directive, entity: entry.header.entity },
            });
          }
        } else if (entry.type === "schema_entry") {
          const title = entry.header.title?.value;
          if (!title || title.trim() === "") {
            ctx.report({
              message: `Schema entry is missing a title/description. Provide a description in quotes.`,
              file: model.file,
              location: entry.location,
              sourceMap: model.sourceMap,
              data: {
                directive: entry.header.directive,
                entityName: entry.header.entityName.value,
              },
            });
          }
        } else if (entry.type === "synthesis_entry") {
          const title = entry.header.title?.value;
          if (!title || title.trim() === "") {
            ctx.report({
              message: `Synthesis entry is missing a title. Provide a descriptive title in quotes.`,
              file: model.file,
              location: entry.location,
              sourceMap: model.sourceMap,
              data: { linkId: entry.header.linkId.id },
            });
          }
        }
      }
    }
  },
};
