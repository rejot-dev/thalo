import type { Rule, RuleCategory } from "../types.js";
import type { SchemaEntry, Timestamp } from "../../ast/types.js";
import { isSyntaxError } from "../../ast/types.js";
import type { SemanticModel } from "../../semantic/types.js";

const category: RuleCategory = "schema";

interface SchemaEntryContext {
  entry: SchemaEntry;
  model: SemanticModel;
  timestampStr: string;
}

/**
 * Format a timestamp for comparison
 */
function formatTimestamp(ts: Timestamp): string {
  const date = `${ts.date.year}-${String(ts.date.month).padStart(2, "0")}-${String(ts.date.day).padStart(2, "0")}`;
  const time = `${String(ts.time.hour).padStart(2, "0")}:${String(ts.time.minute).padStart(2, "0")}`;
  const tz = isSyntaxError(ts.timezone) ? "" : ts.timezone.value;
  return `${date}T${time}${tz}`;
}

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
    const defineTimestamps = new Map<string, SchemaEntryContext>();
    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "schema_entry") {
          continue;
        }
        if (entry.header.directive !== "define-entity") {
          continue;
        }

        const entityName = entry.header.entityName.value;
        const timestampStr = formatTimestamp(entry.header.timestamp);

        // If there are duplicates, use the earliest one
        const existing = defineTimestamps.get(entityName);
        if (!existing || timestampStr < existing.timestampStr) {
          defineTimestamps.set(entityName, { entry, model, timestampStr });
        }
      }
    }

    // Check alter-entity entries
    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "schema_entry") {
          continue;
        }
        if (entry.header.directive !== "alter-entity") {
          continue;
        }

        const entityName = entry.header.entityName.value;
        const timestampStr = formatTimestamp(entry.header.timestamp);
        const defineEntry = defineTimestamps.get(entityName);

        if (defineEntry && timestampStr < defineEntry.timestampStr) {
          ctx.report({
            message: `alter-entity for '${entityName}' has timestamp ${timestampStr} which is before the define-entity at ${defineEntry.timestampStr}.`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: {
              entityName,
              alterTimestamp: timestampStr,
              defineTimestamp: defineEntry.timestampStr,
            },
          });
        }
      }
    }
  },
};
