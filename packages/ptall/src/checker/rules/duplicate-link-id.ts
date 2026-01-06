import type { Rule } from "../types.js";
import type { LinkDefinition } from "../../model/types.js";

/**
 * Check for duplicate link ID definitions
 */
export const duplicateLinkIdRule: Rule = {
  code: "duplicate-link-id",
  name: "Duplicate Link ID",
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    // Track all definitions we've seen for each link ID
    const definitionsByLinkId = new Map<string, LinkDefinition[]>();

    // Collect definitions from all documents
    for (const doc of workspace.allDocuments()) {
      for (const [linkId, def] of doc.linkIndex.definitions) {
        const defs = definitionsByLinkId.get(linkId) ?? [];
        defs.push(def);
        definitionsByLinkId.set(linkId, defs);
      }
    }

    // Report duplicates
    for (const [linkId, defs] of definitionsByLinkId) {
      if (defs.length > 1) {
        // Skip timestamps - they're implicitly unique per entry
        // Only report explicit ^link-id duplicates
        const explicitDefs = defs.filter((d) => d.entry.linkId === linkId);

        if (explicitDefs.length > 1) {
          for (const def of explicitDefs) {
            const otherFiles = explicitDefs
              .filter((d) => d !== def)
              .map((d) => d.file)
              .join(", ");

            ctx.report({
              message: `Duplicate link ID '^${linkId}'. Also defined in: ${otherFiles}`,
              file: def.file,
              location: def.location,
              data: { linkId, otherFiles },
            });
          }
        }
      }
    }
  },
};
