import type { EntryMatch, MergeConflict, MergeResult, MergeStats, MergeOptions } from "./types.js";
import { formatConflict, formatEntry } from "./conflict-formatter.js";
import { mergeEntry, entriesEqual } from "./entry-merger.js";
import { serializeIdentity } from "./entry-matcher.js";

/**
 * Build the final merged result from matches and conflicts
 *
 * @param matches - Array of matched entry triplets
 * @param conflicts - Array of detected conflicts
 * @param options - Merge options
 * @returns Complete merge result with content and statistics
 */
export function buildMergedResult(
  matches: EntryMatch[],
  conflicts: MergeConflict[],
  options: MergeOptions = {},
): MergeResult {
  const conflictMap = new Map<string, MergeConflict>();
  for (const conflict of conflicts) {
    const key = serializeIdentity(conflict.identity);
    conflictMap.set(key, conflict);
  }

  const lines: string[] = [];
  const stats: MergeStats = {
    totalEntries: 0,
    oursOnly: 0,
    theirsOnly: 0,
    common: 0,
    autoMerged: 0,
    conflicts: conflicts.length,
  };

  const sortedMatches = sortMatchesByTimestamp(matches);

  for (const match of sortedMatches) {
    const matchKey = serializeIdentity(match.identity);
    const conflict = conflictMap.get(matchKey);

    if (conflict) {
      const conflictLines = formatConflict(conflict, options);
      conflict.location = lines.length + 1;
      lines.push(...conflictLines);
      lines.push("");
    } else {
      const merged = mergeEntry(match);
      if (merged) {
        lines.push(...formatEntry(merged));
        lines.push("");

        stats.totalEntries++;
        if (!match.base && match.ours && !match.theirs) {
          stats.oursOnly++;
        } else if (!match.base && !match.ours && match.theirs) {
          stats.theirsOnly++;
        } else if (match.base && match.ours && match.theirs) {
          if (entriesEqual(match.base, match.ours) && entriesEqual(match.base, match.theirs)) {
            stats.common++;
          } else {
            stats.autoMerged++;
          }
        }
      }
    }
  }

  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return {
    success: conflicts.length === 0,
    content: lines.join("\n"),
    conflicts,
    stats,
  };
}

/**
 * Sort matches by timestamp for chronological output
 */
function sortMatchesByTimestamp(matches: EntryMatch[]): EntryMatch[] {
  return [...matches].sort((a, b) => {
    const tsA = getMatchTimestamp(a);
    const tsB = getMatchTimestamp(b);

    if (!tsA && !tsB) {
      return 0;
    }
    if (!tsA) {
      return 1;
    }
    if (!tsB) {
      return -1;
    }

    return tsA.localeCompare(tsB);
  });
}

/**
 * Get timestamp from a match (prefer ours, then theirs, then base)
 */
function getMatchTimestamp(match: EntryMatch): string | null {
  const entry = match.ours || match.theirs || match.base;
  if (!entry) {
    return null;
  }

  switch (entry.type) {
    case "instance_entry":
    case "schema_entry":
    case "synthesis_entry":
    case "actualize_entry":
      return entry.header.timestamp.value;
    default:
      return null;
  }
}
