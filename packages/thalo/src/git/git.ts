import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

/**
 * Git context information for the current working directory
 */
export interface GitContext {
  /** Whether the directory is inside a git repository */
  isGitRepo: boolean;
  /** Root directory of the git repository (if isGitRepo is true) */
  rootDir?: string;
  /** Current HEAD commit hash (if isGitRepo is true) */
  currentCommit?: string;
}

/**
 * Run a git command and return stdout, or null if it fails
 */
async function runGit(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string } | null> {
  try {
    const result = await execFileAsync("git", args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Detect git context for a directory.
 *
 * Returns information about whether the directory is in a git repo,
 * the repo root, and current commit hash.
 *
 * @param cwd - Directory to check
 * @returns Git context information
 */
export async function detectGitContext(cwd: string): Promise<GitContext> {
  // Check if inside a git repo
  const revParseResult = await runGit(["rev-parse", "--is-inside-work-tree"], cwd);

  if (!revParseResult || revParseResult.stdout.trim() !== "true") {
    return { isGitRepo: false };
  }

  // Get the root directory
  const rootResult = await runGit(["rev-parse", "--show-toplevel"], cwd);
  const rootDir = rootResult?.stdout.trim();

  // Get current commit hash
  const commitResult = await runGit(["rev-parse", "HEAD"], cwd);
  const currentCommit = commitResult?.stdout.trim();

  return {
    isGitRepo: true,
    rootDir,
    currentCommit,
  };
}

/**
 * Get the current HEAD commit hash.
 *
 * @param cwd - Directory to check
 * @returns Commit hash or null if not in a git repo
 */
export async function getCurrentCommit(cwd: string): Promise<string | null> {
  const result = await runGit(["rev-parse", "HEAD"], cwd);
  return result?.stdout.trim() ?? null;
}

/**
 * Represents a file change between commits.
 */
export interface FileChange {
  /** Type of change */
  status: "added" | "modified" | "renamed" | "deleted";
  /** Current path (or new path for renames) */
  path: string;
  /** Original path before rename (only for renamed files) */
  oldPath?: string;
}

/**
 * Get list of files changed since a commit with rename detection.
 *
 * Uses `git diff -M --name-status` to detect renames and returns structured change info.
 *
 * @param commit - Base commit to compare against
 * @param cwd - Working directory
 * @returns Array of file changes (relative to repo root)
 */
export async function getFilesChangedSince(commit: string, cwd: string): Promise<FileChange[]> {
  const result = await runGit(["diff", "-M", "--name-status", `${commit}..HEAD`], cwd);

  if (!result) {
    return [];
  }

  return result.stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line): FileChange => {
      const parts = line.split("\t");
      const statusCode = parts[0];

      // Rename: R100\told/path\tnew/path (R followed by similarity percentage)
      if (statusCode.startsWith("R")) {
        if (parts.length < 3) {
          // Invalid format, treat as modified with available path
          return { status: "modified", path: parts[1] ?? "" };
        }
        return {
          status: "renamed",
          oldPath: parts[1],
          path: parts[2],
        };
      }

      // Other statuses: A (added), M (modified), D (deleted)
      const status = statusCode === "A" ? "added" : statusCode === "D" ? "deleted" : "modified";

      if (parts.length < 2) {
        // Invalid format, skip this entry
        return { status: "modified", path: "" };
      }

      return {
        status,
        path: parts[1],
      };
    })
    .filter((change) => change.path.length > 0);
}

/**
 * Get file content at a specific commit.
 *
 * @param file - File path (relative to repo root or absolute)
 * @param commit - Commit hash to retrieve content from
 * @param cwd - Working directory (for finding repo root)
 * @returns File content at that commit, or null if file doesn't exist at commit
 */
export async function getFileAtCommit(
  file: string,
  commit: string,
  cwd: string,
): Promise<string | null> {
  // Get repo root to compute relative path
  const rootResult = await runGit(["rev-parse", "--show-toplevel"], cwd);
  if (!rootResult) {
    return null;
  }
  const repoRoot = rootResult.stdout.trim();

  let gitPath: string;

  if (path.isAbsolute(file)) {
    // For absolute paths, compute relative to repo root
    const relativePath = path.relative(repoRoot, file);

    // Guard against paths outside repo root
    if (relativePath.startsWith("..")) {
      return null;
    }

    // Normalize to POSIX forward slashes (git requires forward slashes on all platforms)
    gitPath = relativePath.split(path.sep).join("/");
  } else {
    // For relative paths (e.g., from git diff output), they are already repo-root-relative
    // Just normalize backslashes to forward slashes
    gitPath = file.replace(/\\/g, "/");
  }

  const result = await runGit(["show", `${commit}:${gitPath}`], cwd);
  return result?.stdout ?? null;
}

/**
 * Read the set of ignored revs for blame-like operations, if configured.
 *
 * Prefers the de-facto standard `.git-blame-ignore-revs` at the repo root, and
 * falls back to `blame.ignoreRevsFile` git config if set.
 *
 * Returns the rev SHAs (one per line) or null if no ignore revs are configured.
 *
 * @param cwd - Working directory
 * @returns Array of ignored revs (as strings) or null
 */
export async function getBlameIgnoreRevs(cwd: string): Promise<string[] | null> {
  const rootResult = await runGit(["rev-parse", "--show-toplevel"], cwd);
  if (!rootResult) {
    return null;
  }
  const repoRoot = rootResult.stdout.trim();

  async function readIgnoreFile(filePath: string): Promise<string[] | null> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const revs = raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#"))
        // Git accepts abbreviated SHAs in ignore revs; keep them as-is
        .map((l) => l.split(/\s+/)[0]);
      return revs.length > 0 ? revs : null;
    } catch {
      return null;
    }
  }

  const standardPath = path.join(repoRoot, ".git-blame-ignore-revs");
  const standardRevs = await readIgnoreFile(standardPath);
  if (standardRevs) {
    return standardRevs;
  }

  const configResult = await runGit(["config", "--get", "blame.ignoreRevsFile"], cwd);
  const configPathRaw = configResult?.stdout.trim();
  if (!configPathRaw) {
    return null;
  }

  const resolved = path.isAbsolute(configPathRaw)
    ? configPathRaw
    : path.resolve(repoRoot, configPathRaw);
  return await readIgnoreFile(resolved);
}

/**
 * Check whether `ancestorCommit` is an ancestor of `descendantCommit`.
 *
 * Uses `git merge-base ancestor descendant` and compares the result to the ancestor.
 */
export async function isCommitAncestorOf(
  ancestorCommit: string,
  descendantCommit: string,
  cwd: string,
): Promise<boolean> {
  const result = await runGit(["merge-base", ancestorCommit, descendantCommit], cwd);
  return result !== null && result.stdout.trim() === ancestorCommit;
}

/**
 * Get the set of commits currently blamed for a line range.
 *
 * @param file - File path (relative to repo root or absolute)
 * @param startLine - 1-based inclusive start line
 * @param endLine - 1-based inclusive end line
 * @param cwd - Working directory
 * @param ignoreRevsFile - Optional absolute path to ignore revs file
 */
export async function getBlameCommitsForLineRange(
  file: string,
  startLine: number,
  endLine: number,
  cwd: string,
  ignoreRevs?: string[] | null,
): Promise<Set<string>> {
  // Get repo root to compute relative path
  const rootResult = await runGit(["rev-parse", "--show-toplevel"], cwd);
  if (!rootResult) {
    return new Set();
  }
  const repoRoot = rootResult.stdout.trim();

  let gitPath: string;
  if (path.isAbsolute(file)) {
    const relativePath = path.relative(repoRoot, file);
    if (relativePath.startsWith("..")) {
      return new Set();
    }
    gitPath = relativePath.split(path.sep).join("/");
  } else {
    gitPath = file.replace(/\\/g, "/");
  }

  const args = ["blame", "--porcelain", "-L", `${startLine},${endLine}`];
  if (ignoreRevs && ignoreRevs.length > 0) {
    for (const rev of ignoreRevs) {
      args.push("--ignore-rev", rev);
    }
  }
  args.push("HEAD", "--", gitPath);

  const result = await runGit(args, cwd);
  if (!result) {
    return new Set();
  }

  const commits = new Set<string>();
  for (const line of result.stdout.split("\n")) {
    // Porcelain blame header line: "<sha> <orig-line> <final-line> <num-lines>"
    if (/^[0-9a-f]{40}\s/.test(line)) {
      commits.add(line.slice(0, 40));
    }
  }
  return commits;
}

/**
 * Check if a file was modified since a commit.
 *
 * Uses --follow to track the file through renames.
 *
 * @param file - File path to check
 * @param commit - Base commit to compare against
 * @param cwd - Working directory
 * @returns true if file was modified, false otherwise
 */
export async function wasFileModifiedSince(
  file: string,
  commit: string,
  cwd: string,
): Promise<boolean> {
  // Get repo root to compute relative path
  const rootResult = await runGit(["rev-parse", "--show-toplevel"], cwd);
  if (!rootResult) {
    return false;
  }
  const repoRoot = rootResult.stdout.trim();

  let gitPath: string;

  if (path.isAbsolute(file)) {
    // For absolute paths, compute relative to repo root
    const relativePath = path.relative(repoRoot, file);

    // Guard against paths outside repo root
    if (relativePath.startsWith("..")) {
      return false;
    }

    // Normalize to POSIX forward slashes (git requires forward slashes on all platforms)
    gitPath = relativePath.split(path.sep).join("/");
  } else {
    // For relative paths (e.g., from git diff output), they are already repo-root-relative
    // Just normalize backslashes to forward slashes
    gitPath = file.replace(/\\/g, "/");
  }

  // Use git log with --follow to track through renames
  const result = await runGit(
    ["log", "--follow", "-1", "--format=%H", `${commit}..HEAD`, "--", gitPath],
    cwd,
  );

  // If we get a commit hash, the file was modified
  return result !== null && result.stdout.trim().length > 0;
}

/**
 * Check if a commit exists in the repository.
 *
 * @param commit - Commit hash to check
 * @param cwd - Working directory
 * @returns true if commit exists, false otherwise
 */
export async function commitExists(commit: string, cwd: string): Promise<boolean> {
  const result = await runGit(["cat-file", "-t", commit], cwd);
  return result !== null && result.stdout.trim() === "commit";
}

/**
 * Get list of files with uncommitted changes (staged or unstaged).
 *
 * @param cwd - Working directory
 * @param files - Optional list of files to filter (relative to repo root or absolute)
 * @returns Array of file paths (relative to repo root) with uncommitted changes
 */
export async function getUncommittedFiles(cwd: string, files?: string[]): Promise<string[]> {
  // Get repo root for path normalization
  const rootResult = await runGit(["rev-parse", "--show-toplevel"], cwd);
  if (!rootResult) {
    return [];
  }
  const repoRoot = rootResult.stdout.trim();

  // Build git status command - porcelain gives us stable, parseable output
  const args = ["status", "--porcelain", "--"];

  if (files && files.length > 0) {
    // Normalize file paths to be relative to repo root
    for (const file of files) {
      let gitPath: string;
      if (path.isAbsolute(file)) {
        const relativePath = path.relative(repoRoot, file);
        if (relativePath.startsWith("..")) {
          continue; // Skip files outside repo
        }
        gitPath = relativePath.split(path.sep).join("/");
      } else {
        gitPath = file.replace(/\\/g, "/");
      }
      args.push(gitPath);
    }
  }

  const result = await runGit(args, cwd);
  if (!result) {
    return [];
  }

  // Parse porcelain output: "XY filename" or "XY old -> new" for renames
  // X = index status, Y = worktree status
  // We want files where either X or Y indicates a change
  return result.stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      // Skip the status codes (first 3 chars: XY + space)
      const filePart = line.slice(3);
      // Handle renames: "old -> new"
      if (filePart.includes(" -> ")) {
        return filePart.split(" -> ")[1];
      }
      return filePart;
    })
    .filter((f) => f.length > 0);
}
