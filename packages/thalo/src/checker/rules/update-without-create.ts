import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor } from "../visitor.js";
import type { InstanceEntry } from "../../ast/ast-types.js";

const category: RuleCategory = "instance";

/**
 * Get metadata link value for a given key
 */
function getMetadataLink(
  entry: InstanceEntry,
  key: string,
): { id: string; location: import("../../ast/ast-types.js").Location } | null {
  const meta = entry.metadata.find((m) => m.key.value === key);
  if (!meta) {
    return null;
  }

  const content = meta.value.content;
  if (content.type === "link_value") {
    return { id: content.link.id, location: content.link.location };
  }
  return null;
}

const visitor: RuleVisitor = {
  visitInstanceEntry(entry, ctx) {
    if (entry.header.directive !== "update") {
      return;
    }

    // Check if there's a supersedes field
    const supersedes = getMetadataLink(entry, "supersedes");
    if (!supersedes) {
      return;
    }

    // Check if the superseded entry exists
    const definition = ctx.workspace.getLinkDefinition(supersedes.id);
    if (!definition) {
      // This will be caught by unresolved-link rule
      return;
    }

    // Check if the superseded entry is a create of the same entity type
    const supersededEntry = definition.entry;
    if (supersededEntry.type === "instance_entry") {
      if (supersededEntry.header.directive !== "create") {
        ctx.report({
          message: `'update' entry supersedes another '${supersededEntry.header.directive}' entry. Consider pointing to the original 'create' entry instead.`,
          file: ctx.file,
          location: supersedes.location,
          sourceMap: ctx.sourceMap,
          data: {
            linkId: supersedes.id,
            supersededDirective: supersededEntry.header.directive,
          },
        });
      } else if (supersededEntry.header.entity !== entry.header.entity) {
        ctx.report({
          message: `'update ${entry.header.entity}' supersedes a '${supersededEntry.header.entity}' entry. Entity types should match.`,
          file: ctx.file,
          location: supersedes.location,
          sourceMap: ctx.sourceMap,
          data: {
            linkId: supersedes.id,
            expectedEntity: entry.header.entity,
            actualEntity: supersededEntry.header.entity,
          },
        });
      }
    }
  },
};

/**
 * Check for 'update' entries that reference (via supersedes) a non-existent create entry
 */
export const updateWithoutCreateRule: Rule = {
  code: "update-without-create",
  name: "Update Without Create",
  description: "update entry supersedes wrong directive/entity type",
  category,
  defaultSeverity: "warning",
  dependencies: { scope: "entry", links: true },
  visitor,
};
