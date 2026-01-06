import type { Rule } from "../types.js";
import type { ModelEntry } from "../../model/types.js";

/**
 * Check for multiple entries with the same timestamp (since timestamps are implicit link IDs)
 */
export const duplicateTimestampRule: Rule = {
  code: "duplicate-timestamp",
  name: "Duplicate Timestamp",
  defaultSeverity: "warning",

  check(ctx) {
    const { workspace } = ctx;

    // Track all entries by timestamp
    const entriesByTimestamp = new Map<string, ModelEntry[]>();

    for (const entry of workspace.allEntries()) {
      const entries = entriesByTimestamp.get(entry.timestamp) ?? [];
      entries.push(entry);
      entriesByTimestamp.set(entry.timestamp, entries);
    }

    // Report duplicates
    for (const [timestamp, entries] of entriesByTimestamp) {
      if (entries.length > 1) {
        for (const entry of entries) {
          const otherLocations = entries
            .filter((e) => e !== entry)
            .map((e) => `${e.file}:${e.location.startPosition.row + 1}`)
            .join(", ");

          ctx.report({
            message: `Duplicate timestamp '${timestamp}'. Timestamps are implicit link IDs and should be unique. Also at: ${otherLocations}`,
            file: entry.file,
            location: entry.location,
            data: { timestamp, otherLocations },
          });
        }
      }
    }
  },
};
