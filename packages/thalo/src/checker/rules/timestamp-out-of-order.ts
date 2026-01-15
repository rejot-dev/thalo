import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor, VisitorContext } from "../visitor.js";
import type { Timestamp } from "../../ast/ast-types.js";
import { formatTimestamp } from "../../formatters.js";

const category: RuleCategory = "instance";

/**
 * Compare two timestamps, returning negative if a < b, positive if a > b, 0 if equal
 */
function compareTimestamps(a: Timestamp, b: Timestamp): number {
  const aStr = formatTimestamp(a);
  const bStr = formatTimestamp(b);
  return aStr.localeCompare(bStr);
}

const visitor: RuleVisitor = {
  afterCheck(ctx: VisitorContext) {
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

/**
 * Check for timestamps that are out of chronological order within a document
 */
export const timestampOutOfOrderRule: Rule = {
  code: "timestamp-out-of-order",
  name: "Timestamp Out of Order",
  description: "Entry timestamp is earlier than the previous entry",
  category,
  defaultSeverity: "warning",
  dependencies: { scope: "document" },
  visitor,
};
