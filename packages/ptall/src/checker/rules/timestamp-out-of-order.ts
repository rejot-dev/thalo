import type { Rule, RuleCategory } from "../types.js";

const category: RuleCategory = "instance";

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

    for (const doc of workspace.allDocuments()) {
      const entries = doc.entries;

      if (entries.length < 2) {
        continue;
      }

      let previousTimestamp: string | null = null;

      for (const entry of entries) {
        if (previousTimestamp !== null && entry.timestamp < previousTimestamp) {
          ctx.report({
            message: `Timestamp '${entry.timestamp}' is earlier than previous entry '${previousTimestamp}'. Entries should be in chronological order.`,
            file: entry.file,
            location: entry.location,
            data: {
              timestamp: entry.timestamp,
              previousTimestamp,
            },
          });
        }

        previousTimestamp = entry.timestamp;
      }
    }
  },
};
