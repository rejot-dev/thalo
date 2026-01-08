import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "link";

/**
 * Check for link references that don't resolve to any definition
 */
export const unresolvedLinkRule: Rule = {
  code: "unresolved-link",
  name: "Unresolved Link",
  description: "Link reference (^id) has no definition",
  category,
  defaultSeverity: "warning",

  check(ctx) {
    const { workspace } = ctx;
    const linkIndex = workspace.linkIndex;

    // Check all references to see if they have definitions
    for (const [linkId, refs] of linkIndex.references) {
      const definition = linkIndex.definitions.get(linkId);

      if (!definition) {
        // No definition found - report for each reference
        for (const ref of refs) {
          ctx.report({
            message: `Unresolved link '^${linkId}'. No entry defines this link ID.`,
            file: ref.file,
            location: ref.location,
            sourceMap: ref.entry.sourceMap,
            data: { linkId },
          });
        }
      }
    }
  },
};
