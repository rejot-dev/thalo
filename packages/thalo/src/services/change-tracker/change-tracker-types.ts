import type { InstanceEntry } from "../../ast/ast-types.js";
import type { Query } from "../../services/query.js";
import type { Workspace } from "../../model/workspace.js";

/**
 * Known checkpoint provider types.
 *
 * - "git": Git commit hash
 * - "ts": ISO timestamp
 *
 * This is extensible - future providers could include "db" for database, etc.
 */
export type CheckpointProvider = "git" | "ts";

/**
 * A marker representing a point in time for change tracking.
 *
 * Stored as `checkpoint: "git:abc123"` or `checkpoint: "ts:2026-01-08T15:00Z"`.
 */
export interface ChangeMarker {
  /** Provider type (git, ts, etc.) */
  type: CheckpointProvider;
  /** The marker value - commit hash or ISO timestamp */
  value: string;
}

/**
 * Result of getting changed entries, including the marker to store
 */
export interface ChangedEntriesResult {
  /** Entries that have changed since the marker */
  entries: InstanceEntry[];
  /** The current marker to store for next comparison */
  currentMarker: ChangeMarker;
}

/**
 * Options for creating a ChangeTracker
 */
export interface ChangeTrackerOptions {
  /** Working directory for git operations */
  cwd?: string;
  /**
   * Force operation even if there are uncommitted changes.
   * When false (default), git tracker will error if source files have uncommitted changes.
   */
  force?: boolean;
}

/**
 * Error thrown when source files have uncommitted changes.
 *
 * This prevents incorrect change tracking since uncommitted changes
 * are not captured in the checkpoint.
 */
export class UncommittedChangesError extends Error {
  /** Files with uncommitted changes */
  readonly files: string[];

  constructor(files: string[]) {
    super(
      `Source files have uncommitted changes: ${files.join(", ")}. ` +
        `Commit your changes or use --force to proceed anyway.`,
    );
    this.name = "UncommittedChangesError";
    this.files = files;
  }
}

/**
 * Interface for tracking changes to entries.
 *
 * Implementations can use different backends (git, timestamps, database, etc.)
 * to determine which entries have changed since a marker point.
 */
export interface ChangeTracker {
  /**
   * Type of tracker - matches the checkpoint provider type.
   */
  readonly type: CheckpointProvider;

  /**
   * Get the current position marker (HEAD commit or current time).
   *
   * @returns Current marker to store for future comparisons
   */
  getCurrentMarker(): Promise<ChangeMarker>;

  /**
   * Get entries that have changed since a marker.
   *
   * For git tracker: Finds files modified since the commit, parses them,
   * and compares entry content to identify changed entries.
   *
   * For timestamp tracker: Filters entries with timestamps after the marker.
   *
   * @param workspace - The workspace containing current entries
   * @param queries - Queries to filter which entries to consider
   * @param marker - The marker to compare against (from previous actualization)
   * @returns Changed entries and the current marker to store
   */
  getChangedEntries(
    workspace: Workspace,
    queries: Query[],
    marker: ChangeMarker | null,
  ): Promise<ChangedEntriesResult>;
}

/**
 * Strip quotes from a string value if present.
 * Handles both single and double quotes.
 */
function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse a checkpoint value into a ChangeMarker.
 *
 * Expected format: "git:abc123" or "ts:2026-01-08T15:00Z"
 * Strips quotes from the raw value as metadata raw values include quotes.
 *
 * @param checkpointRaw - Raw checkpoint metadata value (may include quotes)
 * @returns Parsed marker or null if invalid/missing
 */
export function parseCheckpoint(checkpointRaw: string | undefined): ChangeMarker | null {
  if (!checkpointRaw) {
    return null;
  }

  const value = stripQuotes(checkpointRaw);
  const colonIndex = value.indexOf(":");

  if (colonIndex === -1) {
    return null;
  }

  const provider = value.slice(0, colonIndex);
  const markerValue = value.slice(colonIndex + 1);

  if (!markerValue) {
    return null;
  }

  // Validate known providers
  if (provider === "git" || provider === "ts") {
    return { type: provider, value: markerValue };
  }

  return null;
}

/**
 * Format a ChangeMarker as a checkpoint string.
 *
 * @param marker - The marker to format
 * @returns Formatted string like "git:abc123" or "ts:2026-01-08T15:00Z"
 */
export function formatCheckpoint(marker: ChangeMarker): string {
  return `${marker.type}:${marker.value}`;
}
