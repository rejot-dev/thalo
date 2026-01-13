import { describe, it, expect, beforeEach } from "vitest";
import { GitChangeTracker } from "./git-tracker.js";
import { UncommittedChangesError } from "./types.js";
import { createWorkspace } from "../../parser.native.js";
import { Workspace } from "../../model/workspace.js";
import type { Query } from "../../model/types.js";
import * as path from "node:path";
import * as os from "node:os";

describe("GitChangeTracker", () => {
  // change-tracker/ → services/ → src/ → thalo/ → packages/ → repo root
  const repoRoot = path.resolve(import.meta.dirname, "../../../../..");

  describe("type", () => {
    it("should have type 'git'", () => {
      const tracker = new GitChangeTracker({ cwd: repoRoot });
      expect(tracker.type).toBe("git");
    });
  });

  describe("getCurrentMarker", () => {
    it("should return git commit marker", async () => {
      const tracker = new GitChangeTracker({ cwd: repoRoot });
      const marker = await tracker.getCurrentMarker();

      expect(marker.type).toBe("git");
      expect(marker.value).toMatch(/^[a-f0-9]{40}$/);
    });

    it("should throw when not in git repo", async () => {
      const tracker = new GitChangeTracker({ cwd: os.tmpdir() });

      await expect(tracker.getCurrentMarker()).rejects.toThrow("Not in a git repository");
    });
  });

  describe("getChangedEntries", () => {
    let tracker: GitChangeTracker;
    let workspace: Workspace;
    const loreQuery: Query = { entity: "lore", conditions: [] };

    beforeEach(() => {
      tracker = new GitChangeTracker({ cwd: repoRoot });
      workspace = createWorkspace();
    });

    it("should throw when not in git repo", async () => {
      const nonGitTracker = new GitChangeTracker({ cwd: os.tmpdir() });

      await expect(nonGitTracker.getChangedEntries(workspace, [loreQuery], null)).rejects.toThrow(
        "Not in a git repository",
      );
    });

    it("should return all entries when marker is null (first run)", async () => {
      workspace.addDocument(
        `2026-01-07T10:00Z create lore "Entry 1" ^entry1
2026-01-07T11:00Z create lore "Entry 2" ^entry2`,
        { filename: "test.thalo" },
      );

      const result = await tracker.getChangedEntries(workspace, [loreQuery], null);

      expect(result.entries).toHaveLength(2);
      expect(result.currentMarker.type).toBe("git");
    });

    it("should return all entries when marker is timestamp type (migration)", async () => {
      workspace.addDocument(`2026-01-07T10:00Z create lore "Entry 1" ^entry1`, {
        filename: "test.thalo",
      });

      const result = await tracker.getChangedEntries(workspace, [loreQuery], {
        type: "ts",
        value: "2026-01-07T09:00Z",
      });

      // Should return all entries since we're migrating from timestamp to git
      expect(result.entries).toHaveLength(1);
      expect(result.currentMarker.type).toBe("git");
    });

    it("should return all entries when commit doesn't exist (rebased)", async () => {
      workspace.addDocument(`2026-01-07T10:00Z create lore "Entry 1" ^entry1`, {
        filename: "test.thalo",
      });

      const result = await tracker.getChangedEntries(workspace, [loreQuery], {
        type: "git",
        value: "0000000000000000000000000000000000000000",
      });

      // Should return all entries as fallback
      expect(result.entries).toHaveLength(1);
    });

    it("should filter by query conditions", async () => {
      workspace.addDocument(
        `2026-01-07T10:00Z create lore "A Lore" ^lore1
2026-01-07T11:00Z create opinion "An Opinion" ^opinion1`,
        { filename: "test.thalo" },
      );

      const result = await tracker.getChangedEntries(workspace, [loreQuery], null);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].header.link?.id).toBe("lore1");
    });

    it("should handle multiple queries", async () => {
      workspace.addDocument(
        `2026-01-07T10:00Z create lore "A Lore" ^lore1
2026-01-07T11:00Z create opinion "An Opinion" ^opinion1
2026-01-07T12:00Z create event "An Event" ^event1`,
        { filename: "test.thalo" },
      );

      const opinionQuery: Query = { entity: "opinion", conditions: [] };
      const result = await tracker.getChangedEntries(workspace, [loreQuery, opinionQuery], null);

      expect(result.entries).toHaveLength(2);
    });

    it("should ignore non-instance entries", async () => {
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "My Synthesis" ^synth
  sources: lore

  # Prompt
  Generate.

2026-01-07T11:00Z create lore "A Lore" ^lore1`,
        { filename: "test.thalo" },
      );

      const result = await tracker.getChangedEntries(workspace, [loreQuery], null);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].header.link?.id).toBe("lore1");
    });

    it("should return empty when no thalo files changed since marker", async () => {
      // When comparing HEAD to HEAD, no files should have changed
      const marker = await tracker.getCurrentMarker();

      // Add document that won't match any real file in the repo
      workspace.addDocument(`2026-01-07T10:00Z create lore "Entry" ^entry1`, {
        filename: "nonexistent-in-git.thalo",
      });

      const result = await tracker.getChangedEntries(workspace, [loreQuery], marker);

      // No files changed since HEAD, and our test file isn't tracked
      expect(result.entries).toEqual([]);
    });

    it("should proceed with force option even if there were uncommitted changes", async () => {
      const forceTracker = new GitChangeTracker({ cwd: repoRoot, force: true });

      workspace.addDocument(`2026-01-07T10:00Z create lore "Entry" ^entry1`, {
        filename: "test.thalo",
      });

      // With force: true, this should not throw even if source files had uncommitted changes
      const result = await forceTracker.getChangedEntries(workspace, [loreQuery], null);

      expect(result.entries).toHaveLength(1);
    });
  });

  describe("UncommittedChangesError", () => {
    it("should have correct error message and files", () => {
      const error = new UncommittedChangesError(["file1.thalo", "file2.thalo"]);

      expect(error.name).toBe("UncommittedChangesError");
      expect(error.files).toEqual(["file1.thalo", "file2.thalo"]);
      expect(error.message).toContain("file1.thalo");
      expect(error.message).toContain("file2.thalo");
      expect(error.message).toContain("--force");
    });
  });
});
