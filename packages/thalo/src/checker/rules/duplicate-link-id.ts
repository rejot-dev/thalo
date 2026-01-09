import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor, VisitorContext } from "../visitor.js";
import type { LinkDefinition } from "../../semantic/types.js";

const category: RuleCategory = "link";

const visitor: RuleVisitor = {
  afterCheck(ctx: VisitorContext) {
    const { workspace } = ctx;

    // Track all definitions we've seen for each link ID
    const definitionsByLinkId = new Map<string, LinkDefinition[]>();

    // Collect definitions from all models
    for (const model of workspace.allModels()) {
      for (const [linkId, def] of model.linkIndex.definitions) {
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
        const explicitDefs = defs.filter((d) => {
          const entry = d.entry;
          if (entry.type === "instance_entry" || entry.type === "schema_entry") {
            return entry.header.link?.id === linkId;
          }
          if (entry.type === "synthesis_entry") {
            return entry.header.linkId.id === linkId;
          }
          return false;
        });

        if (explicitDefs.length > 1) {
          for (const def of explicitDefs) {
            const model = workspace.getModel(def.file);
            const otherFiles = explicitDefs
              .filter((d) => d !== def)
              .map((d) => d.file)
              .join(", ");

            ctx.report({
              message: `Duplicate link ID '^${linkId}'. Also defined in: ${otherFiles}`,
              file: def.file,
              location: def.location,
              sourceMap: model?.sourceMap,
              data: { linkId, otherFiles },
            });
          }
        }
      }
    }
  },
};

/**
 * Check for duplicate link ID definitions
 */
export const duplicateLinkIdRule: Rule = {
  code: "duplicate-link-id",
  name: "Duplicate Link ID",
  description: "Same explicit ^link-id defined multiple times",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "workspace", links: true },
  visitor,
};
