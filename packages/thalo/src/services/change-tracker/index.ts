export type {
  CheckpointProvider,
  ChangeMarker,
  ChangedEntriesResult,
  ChangeTracker,
  ChangeTrackerOptions,
} from "./types.js";
export { parseCheckpoint, formatCheckpoint } from "./types.js";
export { TimestampChangeTracker } from "./timestamp-tracker.js";
export { GitChangeTracker } from "./git-tracker.js";

import { detectGitContext } from "../../git/index.js";
import type { ChangeTracker, ChangeTrackerOptions } from "./types.js";
import { GitChangeTracker } from "./git-tracker.js";
import { TimestampChangeTracker } from "./timestamp-tracker.js";

/**
 * Options for creating a change tracker
 */
export interface CreateChangeTrackerOptions extends ChangeTrackerOptions {
  /**
   * Preferred tracker type.
   * - "auto": Use git if in a git repo, otherwise timestamp (default)
   * - "git": Force git tracker (throws if not in git repo)
   * - "timestamp": Force timestamp tracker
   */
  preferredType?: "auto" | "git" | "timestamp";
}

/**
 * Create a change tracker based on environment and options.
 *
 * By default, auto-detects git repository and uses GitChangeTracker
 * if available, otherwise falls back to TimestampChangeTracker.
 *
 * @param options - Tracker creation options
 * @returns Appropriate change tracker implementation
 */
export async function createChangeTracker(
  options: CreateChangeTrackerOptions = {},
): Promise<ChangeTracker> {
  const { preferredType = "auto", cwd = process.cwd() } = options;

  if (preferredType === "timestamp") {
    return new TimestampChangeTracker();
  }

  const gitContext = await detectGitContext(cwd);

  if (preferredType === "git") {
    if (!gitContext.isGitRepo) {
      throw new Error("Git tracker requested but not in a git repository");
    }
    return new GitChangeTracker({ cwd });
  }

  // Auto mode: use git if available
  if (gitContext.isGitRepo) {
    return new GitChangeTracker({ cwd });
  }

  return new TimestampChangeTracker();
}
