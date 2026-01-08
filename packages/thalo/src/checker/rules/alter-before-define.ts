import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "schema";
import type { ModelSchemaEntry } from "../../model/types.js";

/**
 * Check for alter-entity entries with timestamps earlier than the define-entity
 */
export const alterBeforeDefineRule: Rule = {
  code: "alter-before-define",
  name: "Alter Before Define",
  description: "alter-entity timestamp before define-entity",
  category,
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    // Collect define-entity timestamps
    const defineTimestamps = new Map<string, ModelSchemaEntry>();
    for (const entry of workspace.allSchemaEntries()) {
      if (entry.directive === "define-entity") {
        // If there are duplicates, use the earliest one
        const existing = defineTimestamps.get(entry.entityName);
        if (!existing || entry.timestamp < existing.timestamp) {
          defineTimestamps.set(entry.entityName, entry);
        }
      }
    }

    // Check alter-entity entries
    for (const entry of workspace.allSchemaEntries()) {
      if (entry.directive === "alter-entity") {
        const defineEntry = defineTimestamps.get(entry.entityName);
        if (defineEntry && entry.timestamp < defineEntry.timestamp) {
          ctx.report({
            message: `alter-entity for '${entry.entityName}' has timestamp ${entry.timestamp} which is before the define-entity at ${defineEntry.timestamp}.`,
            file: entry.file,
            location: entry.location,
            sourceMap: entry.sourceMap,
            data: {
              entityName: entry.entityName,
              alterTimestamp: entry.timestamp,
              defineTimestamp: defineEntry.timestamp,
            },
          });
        }
      }
    }
  },
};
