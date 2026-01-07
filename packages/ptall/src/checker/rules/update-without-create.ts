import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

/**
 * Check for 'update' entries that reference (via supersedes) a non-existent create entry
 */
export const updateWithoutCreateRule: Rule = {
  code: "update-without-create",
  name: "Update Without Create",
  description: "update entry supersedes wrong directive/entity type",
  category,
  defaultSeverity: "warning",

  check(ctx) {
    const { workspace } = ctx;

    for (const entry of workspace.allInstanceEntries()) {
      if (entry.directive !== "update") {
        continue;
      }

      // Check if there's a supersedes field
      const supersedes = entry.metadata.get("supersedes");
      if (!supersedes?.linkId) {
        continue;
      }

      // Check if the superseded entry exists
      const linkId = supersedes.linkId;
      const definition = workspace.getLinkDefinition(linkId);

      if (!definition) {
        // This will be caught by unresolved-link rule, but we can add context
        continue;
      }

      // Check if the superseded entry is a create of the same entity type
      const supersededEntry = definition.entry;
      if (supersededEntry.kind === "instance") {
        if (supersededEntry.directive !== "create") {
          ctx.report({
            message: `'update' entry supersedes another '${supersededEntry.directive}' entry. Consider pointing to the original 'create' entry instead.`,
            file: entry.file,
            location: supersedes.location,
            data: {
              linkId,
              supersededDirective: supersededEntry.directive,
            },
          });
        } else if (supersededEntry.entity !== entry.entity) {
          ctx.report({
            message: `'update ${entry.entity}' supersedes a '${supersededEntry.entity}' entry. Entity types should match.`,
            file: entry.file,
            location: supersedes.location,
            data: {
              linkId,
              expectedEntity: entry.entity,
              actualEntity: supersededEntry.entity,
            },
          });
        }
      }
    }
  },
};
