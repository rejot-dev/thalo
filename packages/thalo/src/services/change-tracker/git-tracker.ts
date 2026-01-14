import type { Entry, InstanceEntry } from "../../ast/types.js";
import type { Query } from "../../model/types.js";
import type { Workspace } from "../../model/workspace.js";
import {
  detectGitContext,
  getCurrentCommit,
  getFilesChangedSince,
  getFileAtCommit,
  commitExists,
  getUncommittedFiles,
  getBlameIgnoreRevs,
  getBlameCommitsForLineRange,
  isCommitAncestorOf,
  type FileChange,
} from "../../git/index.js";
import { getEntryIdentity, serializeIdentity } from "../../merge/entry-matcher.js";
import { entriesEqual } from "../../merge/entry-merger.js";
import { entryMatchesQuery } from "../query.js";
import { parseDocument } from "../../parser.js";
import { extractSourceFile } from "../../ast/extract.js";
import type {
  ChangeTracker,
  ChangeMarker,
  ChangedEntriesResult,
  ChangeTrackerOptions,
} from "./types.js";
import { UncommittedChangesError } from "./types.js";

/**
 * Git-based change tracker.
 *
 * Uses git to determine which entries have changed since the last actualization.
 * This allows detection of in-place edits, not just new entries.
 *
 * Algorithm:
 * 1. Get files modified since the marker commit
 * 2. For each modified .thalo file:
 *    - Get file content at the marker commit
 *    - Parse both versions
 *    - Compare entries by identity (linkId or timestamp)
 *    - Mark entries as changed if they're new or content differs
 */
export class GitChangeTracker implements ChangeTracker {
  readonly type = "git" as const;
  private cwd: string;
  private force: boolean;
  private blameIgnoreRevs: string[] | null | undefined;

  constructor(options: ChangeTrackerOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.force = options.force ?? false;
  }

  private async getIgnoreRevs(): Promise<string[] | null> {
    if (this.blameIgnoreRevs !== undefined) {
      return this.blameIgnoreRevs;
    }
    this.blameIgnoreRevs = await getBlameIgnoreRevs(this.cwd);
    return this.blameIgnoreRevs;
  }

  async getCurrentMarker(): Promise<ChangeMarker> {
    const commit = await getCurrentCommit(this.cwd);
    if (!commit) {
      throw new Error("Not in a git repository");
    }
    return {
      type: "git",
      value: commit,
    };
  }

  async getChangedEntries(
    workspace: Workspace,
    queries: Query[],
    marker: ChangeMarker | null,
  ): Promise<ChangedEntriesResult> {
    // Validate git context
    const gitContext = await detectGitContext(this.cwd);
    if (!gitContext.isGitRepo) {
      throw new Error("Not in a git repository");
    }

    const currentMarker = await this.getCurrentMarker();

    // Find files that contain matching entries (source files for the queries)
    const sourceFiles = this.getSourceFiles(workspace, queries);

    // Check for uncommitted changes in source files (unless force is set)
    if (!this.force && sourceFiles.length > 0) {
      const uncommitted = await getUncommittedFiles(this.cwd, sourceFiles);
      if (uncommitted.length > 0) {
        throw new UncommittedChangesError(uncommitted);
      }
    }

    // If no marker, return all matching entries (first run)
    if (!marker) {
      return {
        entries: this.getAllMatchingEntries(workspace, queries),
        currentMarker,
      };
    }

    // If marker is a timestamp, we can still handle it by returning all entries
    // (graceful fallback - user switched from timestamp to git tracking)
    if (marker.type === "ts") {
      return {
        entries: this.getAllMatchingEntries(workspace, queries),
        currentMarker,
      };
    }

    // Validate the commit exists
    const exists = await commitExists(marker.value, this.cwd);
    if (!exists) {
      // Commit doesn't exist (maybe rebased or squashed)
      // Return all matching entries as fallback
      return {
        entries: this.getAllMatchingEntries(workspace, queries),
        currentMarker,
      };
    }

    // Get files changed since the marker commit (with rename detection)
    const changedFiles = await getFilesChangedSince(marker.value, this.cwd);
    const thaloChanges = changedFiles.filter(
      (f) => f.path.endsWith(".thalo") || f.path.endsWith(".md"),
    );

    // If no thalo files changed, return empty
    if (thaloChanges.length === 0) {
      return {
        entries: [],
        currentMarker,
      };
    }

    // Find changed entries
    const changedEntries: InstanceEntry[] = [];
    const seenKeys = new Set<string>();

    for (const change of thaloChanges) {
      const entries = await this.getChangedEntriesInFile(workspace, change, marker.value, queries);

      for (const entry of entries) {
        // Include file path in dedup key to handle timestamp-based identities across files
        // (Link IDs are globally unique, but timestamps can collide across files)
        const key = `${change.path}:${serializeIdentity(getEntryIdentity(entry))}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          changedEntries.push(entry);
        }
      }
    }

    return {
      entries: changedEntries,
      currentMarker,
    };
  }

  /**
   * Get all files that contain entries matching the queries.
   */
  private getSourceFiles(workspace: Workspace, queries: Query[]): string[] {
    const files = new Set<string>();

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "instance_entry") {
          continue;
        }

        for (const query of queries) {
          if (entryMatchesQuery(entry, query)) {
            files.add(model.file);
            break;
          }
        }
      }
    }

    return Array.from(files);
  }

  /**
   * Get all entries matching the queries (for first run or fallback)
   */
  private getAllMatchingEntries(workspace: Workspace, queries: Query[]): InstanceEntry[] {
    const results: InstanceEntry[] = [];
    const seen = new Set<string>();

    for (const model of workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type !== "instance_entry") {
          continue;
        }

        const key = `${model.file}:${serializeIdentity(getEntryIdentity(entry))}`;

        if (seen.has(key)) {
          continue;
        }

        for (const query of queries) {
          if (entryMatchesQuery(entry, query)) {
            results.push(entry);
            seen.add(key);
            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * Get changed entries in a specific file.
   *
   * Note: This method only returns entries that exist in the current version of the file.
   * Deleted entries are intentionally not tracked because for the actualization use case,
   * we want entries to include in the synthesis prompt - deleted entries don't exist
   * and therefore don't need to be synthesized.
   */
  private async getChangedEntriesInFile(
    workspace: Workspace,
    change: FileChange,
    markerCommit: string,
    queries: Query[],
  ): Promise<InstanceEntry[]> {
    // Find the model for this file in the workspace (use current path)
    const model = this.findModelByRelativePath(workspace, change.path);
    if (!model) {
      return [];
    }

    // Get current entries
    const currentEntries = model.ast.entries.filter(
      (e): e is InstanceEntry => e.type === "instance_entry",
    );

    // If a blame ignore-revs file exists, use blame-based change detection.
    // This allows users to ignore formatting-only commits (e.g. via `.git-blame-ignore-revs`)
    // so they don't retrigger syntheses.
    const ignoreRevs = await this.getIgnoreRevs();
    if (ignoreRevs) {
      const changed: InstanceEntry[] = [];

      // Normalize end line: tree-sitter endPosition is exclusive.
      function locationToLineRange(entry: InstanceEntry): { startLine: number; endLine: number } {
        const startRow = entry.location.startPosition.row;
        const endRow = entry.location.endPosition.row;
        const endCol = entry.location.endPosition.column;
        const startLine = startRow + 1;
        const endLine = endCol === 0 ? endRow : endRow + 1;
        return { startLine, endLine: Math.max(startLine, endLine) };
      }

      for (const entry of currentEntries) {
        // Check if entry matches any query
        let matchesQuery = false;
        for (const query of queries) {
          if (entryMatchesQuery(entry, query)) {
            matchesQuery = true;
            break;
          }
        }
        if (!matchesQuery) {
          continue;
        }

        const { startLine, endLine } = locationToLineRange(entry);
        const blamedCommits = await getBlameCommitsForLineRange(
          change.path,
          startLine,
          endLine,
          this.cwd,
          ignoreRevs,
        );

        let isChanged = false;
        for (const commit of blamedCommits) {
          // If the blamed commit is not an ancestor of the marker, then the entry
          // has changes "after" the marker (including merges), after applying ignore-revs.
          const isBeforeMarker = await isCommitAncestorOf(commit, markerCommit, this.cwd);
          if (!isBeforeMarker) {
            isChanged = true;
            break;
          }
        }

        if (isChanged) {
          changed.push(entry);
        }
      }

      return changed;
    }

    // Get old file content - use oldPath for renames, otherwise current path
    const pathAtCommit = change.oldPath ?? change.path;
    const oldContent = await getFileAtCommit(pathAtCommit, markerCommit, this.cwd);

    // Build map of old entries
    const oldEntryMap = new Map<string, Entry>();
    if (oldContent) {
      try {
        // Detect file type from extension (markdown files contain embedded thalo blocks)
        const fileType = pathAtCommit.endsWith(".md") ? "markdown" : "thalo";
        const oldDoc = parseDocument(oldContent, { fileType });

        // Iterate all blocks (markdown files may have multiple thalo blocks)
        for (const block of oldDoc.blocks) {
          const oldAst = extractSourceFile(block.tree.rootNode);
          for (const entry of oldAst.entries) {
            const key = serializeIdentity(getEntryIdentity(entry));
            oldEntryMap.set(key, entry);
          }
        }
      } catch {
        // Parse error in old content - treat all current entries as changed
      }
    }

    // Find changed entries
    const changed: InstanceEntry[] = [];

    for (const entry of currentEntries) {
      // Check if entry matches any query
      let matchesQuery = false;
      for (const query of queries) {
        if (entryMatchesQuery(entry, query)) {
          matchesQuery = true;
          break;
        }
      }

      if (!matchesQuery) {
        continue;
      }

      const key = serializeIdentity(getEntryIdentity(entry));
      const oldEntry = oldEntryMap.get(key);

      // Entry is changed if:
      // 1. It didn't exist at the marker commit (new entry)
      // 2. Its content differs from the marker commit (modified entry)
      if (!oldEntry || !entriesEqual(oldEntry, entry)) {
        changed.push(entry);
      }
    }

    return changed;
  }

  /**
   * Find a model in the workspace by relative path.
   * Normalizes path separators for cross-platform compatibility.
   */
  private findModelByRelativePath(
    workspace: Workspace,
    relativePath: string,
  ): ReturnType<typeof workspace.getModel> {
    // Normalize to forward slashes for comparison (git always uses forward slashes)
    const normalizedRelative = relativePath.replace(/\\/g, "/");
    const relativeParts = normalizedRelative.split("/");

    for (const model of workspace.allModels()) {
      const normalizedModel = model.file.replace(/\\/g, "/");

      // Exact match
      if (normalizedModel === normalizedRelative) {
        return model;
      }

      // Suffix match: ensure we're matching complete path segments
      // This prevents "oo.thalo" from matching "bar/foo.thalo"
      const modelParts = normalizedModel.split("/");
      if (modelParts.length >= relativeParts.length) {
        const modelSuffix = modelParts.slice(-relativeParts.length).join("/");
        if (modelSuffix === normalizedRelative) {
          return model;
        }
      }
    }
    return undefined;
  }
}
