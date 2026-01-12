import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor, VisitorContext } from "../visitor.js";
import type { SchemaEntry } from "../../ast/types.js";
import type { IndexedEntry } from "../workspace-index.js";
import { formatTimestamp } from "../../formatters.js";

const category: RuleCategory = "schema";

const visitor: RuleVisitor = {
  afterCheck(ctx: VisitorContext) {
    const { index } = ctx;

    // For each entity with alter entries, check against define entries
    for (const [entityName, alterEntries] of index.alterEntitiesByName) {
      const defineEntries = index.defineEntitiesByName.get(entityName);
      if (!defineEntries || defineEntries.length === 0) {
        continue; // No define - handled by alter-undefined-entity rule
      }

      // Find the earliest define timestamp
      let earliestDefine: IndexedEntry<SchemaEntry> | null = null;
      let earliestDefineTs = "";

      for (const entry of defineEntries) {
        const ts = formatTimestamp(entry.entry.header.timestamp);
        if (!earliestDefine || ts < earliestDefineTs) {
          earliestDefine = entry;
          earliestDefineTs = ts;
        }
      }

      // Check each alter entry
      for (const { entry, file, sourceMap } of alterEntries) {
        const alterTs = formatTimestamp(entry.header.timestamp);

        if (alterTs < earliestDefineTs) {
          ctx.report({
            message: `alter-entity for '${entityName}' has timestamp ${alterTs} which is before the define-entity at ${earliestDefineTs}.`,
            file,
            location: entry.location,
            sourceMap,
            data: {
              entityName,
              alterTimestamp: alterTs,
              defineTimestamp: earliestDefineTs,
            },
          });
        }
      }
    }
  },
};

/**
 * Check for alter-entity entries with timestamps earlier than the define-entity
 */
export const alterBeforeDefineRule: Rule = {
  code: "alter-before-define",
  name: "Alter Before Define",
  description: "alter-entity timestamp before define-entity",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "workspace", schemas: true },
  visitor,
};
