import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "instance";

const visitor: RuleVisitor = {
  visitInstanceEntry(entry, ctx) {
    const title = entry.header.title?.value;
    if (!title || title.trim() === "") {
      ctx.report({
        message: `Entry is missing a title. Provide a descriptive title in quotes.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { directive: entry.header.directive, entity: entry.header.entity },
      });
    }
  },

  visitSchemaEntry(entry, ctx) {
    const title = entry.header.title?.value;
    if (!title || title.trim() === "") {
      ctx.report({
        message: `Schema entry is missing a title/description. Provide a description in quotes.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: {
          directive: entry.header.directive,
          entityName: entry.header.entityName.value,
        },
      });
    }
  },

  visitSynthesisEntry(entry, ctx) {
    const title = entry.header.title?.value;
    if (!title || title.trim() === "") {
      ctx.report({
        message: `Synthesis entry is missing a title. Provide a descriptive title in quotes.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { linkId: entry.header.linkId.id },
      });
    }
  },
};

/**
 * Check for entries with empty titles
 */
export const missingTitleRule: Rule = {
  code: "missing-title",
  name: "Missing Title",
  description: "Entry has empty or missing title",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry" },
  visitor,
};
