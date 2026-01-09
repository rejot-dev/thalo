import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor } from "../visitor.js";

const category: RuleCategory = "instance";

const visitor: RuleVisitor = {
  visitSynthesisEntry(entry, ctx) {
    const title = entry.header.title.value;
    const linkId = entry.header.linkId.id;
    const content = entry.content;

    // Check if there's a # Prompt section with content
    let hasPromptWithContent = false;
    if (content) {
      let foundPromptHeader = false;
      for (const child of content.children) {
        if (child.type === "markdown_header" && child.text.toLowerCase().includes("prompt")) {
          foundPromptHeader = true;
        } else if (foundPromptHeader && child.type === "content_line") {
          // Found content after the prompt header
          hasPromptWithContent = true;
          break;
        } else if (foundPromptHeader && child.type === "markdown_header") {
          // Hit another header before finding content - prompt section is empty
          break;
        }
      }
    }

    if (!hasPromptWithContent) {
      ctx.report({
        message: `Synthesis '${title}' is missing a '# Prompt' section. Add instructions for the LLM.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { title, linkId },
      });
    }
  },
};

/**
 * Check that define-synthesis entries have a Prompt section
 */
export const synthesisMissingPromptRule: Rule = {
  code: "synthesis-missing-prompt",
  name: "Synthesis Missing Prompt",
  description:
    "A define-synthesis entry should have a '# Prompt' section with instructions for the LLM",
  category,
  defaultSeverity: "warning",
  dependencies: { scope: "entry" },
  visitor,
};
