import type { Rule, RuleCategory } from "../types.js";
import type { Timestamp } from "../../ast/types.js";
import { isSyntaxError } from "../../ast/types.js";

const category: RuleCategory = "instance";

/**
 * Format a timestamp for display
 */
function formatTimestamp(ts: Timestamp): string {
  const date = `${ts.date.year}-${String(ts.date.month).padStart(2, "0")}-${String(ts.date.day).padStart(2, "0")}`;
  const time = `${String(ts.time.hour).padStart(2, "0")}:${String(ts.time.minute).padStart(2, "0")}`;
  const tz = isSyntaxError(ts.timezone) ? "" : ts.timezone.value;
  return `${date}T${time}${tz}`;
}

/**
 * Compare two timestamps, returning negative if a < b, positive if a > b, 0 if equal
 */
function compareTimestamps(a: Timestamp, b: Timestamp): number {
  const aStr = formatTimestamp(a);
  const bStr = formatTimestamp(b);
  return aStr.localeCompare(bStr);
}

/**
 * Check for timestamps that are out of chronological order within a document
 */
export const timestampOutOfOrderRule: Rule = {
  code: "timestamp-out-of-order",
  name: "Timestamp Out of Order",
  description: "Entry timestamp is earlier than the previous entry",
  category,
  defaultSeverity: "warning",

  check(ctx) {
    const { workspace } = ctx;

    for (const model of workspace.allModels()) {
      const entries = model.ast.entries;

      if (entries.length < 2) {
        continue;
      }

      let previousTimestamp: Timestamp | null = null;

      for (const entry of entries) {
        // Get timestamp from entry header
        const timestamp =
          entry.type === "instance_entry"
            ? entry.header.timestamp
            : entry.type === "schema_entry"
              ? entry.header.timestamp
              : entry.type === "synthesis_entry"
                ? entry.header.timestamp
                : entry.type === "actualize_entry"
                  ? entry.header.timestamp
                  : null;

        if (!timestamp) {
          continue;
        }

        if (previousTimestamp !== null && compareTimestamps(timestamp, previousTimestamp) < 0) {
          const currentStr = formatTimestamp(timestamp);
          const previousStr = formatTimestamp(previousTimestamp);

          ctx.report({
            message: `Timestamp '${currentStr}' is earlier than previous entry '${previousStr}'. Entries should be in chronological order.`,
            file: model.file,
            location: entry.location,
            sourceMap: model.sourceMap,
            data: {
              timestamp: currentStr,
              previousTimestamp: previousStr,
            },
          });
        }

        previousTimestamp = timestamp;
      }
    }
  },
};
