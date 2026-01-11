import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor } from "../visitor.js";
import type { Timestamp } from "../../ast/types.js";
import { isSyntaxError } from "../../ast/types.js";

const category: RuleCategory = "metadata";

/**
 * Format a timestamp for display
 */
function formatTimestamp(ts: Timestamp): string {
  const date = `${ts.date.year}-${String(ts.date.month).padStart(2, "0")}-${String(ts.date.day).padStart(2, "0")}`;
  const time = `${String(ts.time.hour).padStart(2, "0")}:${String(ts.time.minute).padStart(2, "0")}`;
  const tz = isSyntaxError(ts.timezone) ? "" : ts.timezone.value;
  return `${date}T${time}${tz}`;
}

const visitor: RuleVisitor = {
  visitActualizeEntry(entry, ctx) {
    const target = entry.header.target.id;
    const timestamp = formatTimestamp(entry.header.timestamp);
    const checkpointField = entry.metadata.find((m) => m.key.value === "checkpoint");

    if (!checkpointField) {
      ctx.report({
        message: `Actualize entry is missing checkpoint. Add 'checkpoint: "ts:${timestamp}"' or 'checkpoint: "git:<hash>"' to track when this synthesis was last run.`,
        file: ctx.file,
        location: entry.location,
        sourceMap: ctx.sourceMap,
        data: { target, suggestedTimestamp: timestamp },
      });
    }
  },
};

/**
 * Check that actualize-synthesis entries have a checkpoint field for tracking
 */
export const actualizeMissingUpdatedRule: Rule = {
  code: "actualize-missing-updated",
  name: "Actualize Missing Checkpoint",
  description: "An actualize-synthesis entry must have a 'checkpoint:' field for tracking",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry" },
  visitor,
};
