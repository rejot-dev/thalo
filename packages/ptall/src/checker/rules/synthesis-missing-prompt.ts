import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

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

  check(ctx) {
    const { workspace } = ctx;

    for (const doc of workspace.allDocuments()) {
      for (const synthesis of doc.synthesisEntries) {
        if (!synthesis.prompt || synthesis.prompt.trim() === "") {
          ctx.report({
            message: `Synthesis '${synthesis.title}' is missing a '# Prompt' section. Add instructions for the LLM.`,
            file: synthesis.file,
            location: synthesis.location,
            sourceMap: synthesis.sourceMap,
            data: { title: synthesis.title, linkId: synthesis.linkId },
          });
        }
      }
    }
  },
};
