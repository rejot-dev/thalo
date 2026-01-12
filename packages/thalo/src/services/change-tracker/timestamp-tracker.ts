import type { Timestamp, InstanceEntry } from "../../ast/types.js";
import type { Query } from "../../model/types.js";
import type { Workspace } from "../../model/workspace.js";
import { entryMatchesQuery } from "../query.js";
import { formatTimestamp } from "../../formatters.js";
import type { ChangeTracker, ChangeMarker, ChangedEntriesResult } from "./types.js";

/**
 * Convert a timestamp to epoch milliseconds for correct comparison across timezones
 */
function timestampToEpoch(ts: Timestamp): number {
  const isoStr = formatTimestamp(ts);
  // Date.parse handles timezone offsets correctly
  return Date.parse(isoStr);
}

/**
 * Parse an ISO timestamp string to epoch milliseconds
 */
function parseTimestampToEpoch(isoStr: string): number {
  return Date.parse(isoStr);
}

/**
 * Get current ISO timestamp
 */
function getCurrentTimestamp(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}Z`;
}

/**
 * Timestamp-based change tracker.
 *
 * This is the fallback implementation that uses entry timestamps
 * to determine which entries are "new" since the last actualization.
 *
 * Simple but limited - can't detect in-place edits, only new entries.
 */
export class TimestampChangeTracker implements ChangeTracker {
  readonly type = "ts" as const;

  async getCurrentMarker(): Promise<ChangeMarker> {
    return {
      type: "ts",
      value: getCurrentTimestamp(),
    };
  }

  async getChangedEntries(
    workspace: Workspace,
    queries: Query[],
    marker: ChangeMarker | null,
  ): Promise<ChangedEntriesResult> {
    // Only use the marker if it's a timestamp type
    // If marker is git type (from switching modes), return all entries
    const afterTimestamp = marker?.type === "ts" ? marker.value : null;
    // Convert to epoch for correct comparison across timezones
    const afterEpoch = afterTimestamp ? parseTimestampToEpoch(afterTimestamp) : null;

    const results: { entry: InstanceEntry; timestampEpoch: number }[] = [];
    const seen = new Set<string>();

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "instance_entry") {
          continue;
        }

        const timestampEpoch = timestampToEpoch(entry.header.timestamp);
        const timestampStr = formatTimestamp(entry.header.timestamp);
        // Include entity type and link in key to avoid collisions for same-minute entries
        const entityType = entry.header.entity ?? "unknown";
        const linkId = entry.header.link?.id ?? "";
        const key = `${model.file}:${timestampStr}:${entityType}:${linkId}`;

        // Skip if we've already seen this entry
        if (seen.has(key)) {
          continue;
        }

        // Skip if entry is before or at the cutoff (use epoch for correct timezone comparison)
        if (afterEpoch !== null && timestampEpoch <= afterEpoch) {
          continue;
        }

        // Check if entry matches any of the queries
        for (const query of queries) {
          if (entryMatchesQuery(entry, query)) {
            results.push({ entry, timestampEpoch });
            seen.add(key);
            break;
          }
        }
      }
    }

    // Sort by timestamp (epoch for correct ordering)
    results.sort((a, b) => a.timestampEpoch - b.timestampEpoch);

    return {
      entries: results.map((r) => r.entry),
      currentMarker: await this.getCurrentMarker(),
    };
  }
}
