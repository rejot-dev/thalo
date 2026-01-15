/**
 * Node.js-only module for creating change trackers.
 *
 * This module imports git functionality directly and should only be used
 * in Node.js environments (CLI, scripts). For browser code, use
 * TimestampChangeTracker directly from "./change-tracker.js".
 */

import { detectGitContext } from "../../git/git.js";
import type { ChangeTracker, ChangeTrackerOptions } from "./change-tracker.js";
import { GitChangeTracker } from "./git-tracker.js";
import { TimestampChangeTracker } from "./timestamp-tracker.js";

/**
 * Error thrown when a git tracker is requested but the current directory
 * is not inside a git repository.
 */
export class NotInGitRepoError extends Error {
  /** The directory that was checked */
  readonly cwd: string;

  constructor(cwd: string) {
    super(`Git tracker requested but "${cwd}" is not in a git repository`);
    this.name = "NotInGitRepoError";
    this.cwd = cwd;
  }
}

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
 * NOTE: This is a Node.js-only function. For browser environments,
 * use TimestampChangeTracker directly.
 *
 * @param options - Tracker creation options
 * @returns Appropriate change tracker implementation
 */
export async function createChangeTracker(
  options: CreateChangeTrackerOptions = {},
): Promise<ChangeTracker> {
  const { preferredType = "auto", cwd, force } = options;

  if (preferredType === "timestamp") {
    return new TimestampChangeTracker();
  }

  const nodeCwd = cwd ?? process.cwd();
  const gitContext = await detectGitContext(nodeCwd);

  if (preferredType === "git") {
    if (!gitContext.isGitRepo) {
      throw new NotInGitRepoError(nodeCwd);
    }
    return new GitChangeTracker({ cwd: nodeCwd, force });
  }

  // Auto mode: use git if available
  if (gitContext.isGitRepo) {
    return new GitChangeTracker({ cwd: nodeCwd, force });
  }

  return new TimestampChangeTracker();
}

// Re-export things CLI needs
export { GitChangeTracker } from "./git-tracker.js";
export { UncommittedChangesError } from "./change-tracker.js";
