import { describe, it, expect, beforeEach } from "vitest";
import { GitChangeTracker } from "./git-tracker.js";
import { UncommittedChangesError } from "./change-tracker.js";
import { createWorkspace } from "../../parser.native.js";
import { Workspace } from "../../model/workspace.js";
import type { Query } from "../query.js";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd: string): Promise<string> {
  const result = await execFileAsync("git", args, { cwd });
  return result.stdout.toString();
}

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

    it("should honor .git-blame-ignore-revs (ignored commits don't trigger changes)", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thalo-git-tracker-"));

      // Init a minimal git repo
      await runGit(["init"], tempDir);
      await runGit(["config", "user.email", "test@example.com"], tempDir);
      await runGit(["config", "user.name", "Test User"], tempDir);

      const file = "entries.thalo";
      const baseContent = `2026-01-07T10:00Z create lore "Entry 1" ^entry1

  # Content
  Hello
`;
      await fs.writeFile(path.join(tempDir, file), baseContent, "utf8");
      await runGit(["add", file], tempDir);
      await runGit(["commit", "-m", "base"], tempDir);
      const baseCommit = (await runGit(["rev-parse", "HEAD"], tempDir)).trim();

      // "Formatting" change: change content text (would normally retrigger)
      const formattedContent = `2026-01-07T10:00Z create lore "Entry 1" ^entry1

  # Content
  Hello world
`;
      await fs.writeFile(path.join(tempDir, file), formattedContent, "utf8");
      await runGit(["add", file], tempDir);
      await runGit(["commit", "-m", "formatting"], tempDir);
      const formattingCommit = (await runGit(["rev-parse", "HEAD"], tempDir)).trim();

      // Add ignore file at repo root (no git config required)
      await fs.writeFile(
        path.join(tempDir, ".git-blame-ignore-revs"),
        `${formattingCommit}\n`,
        "utf8",
      );
      await runGit(["add", ".git-blame-ignore-revs"], tempDir);
      await runGit(["commit", "-m", "add ignore revs"], tempDir);

      const tempTracker = new GitChangeTracker({ cwd: tempDir });
      const tempWorkspace = createWorkspace();
      tempWorkspace.addDocument(formattedContent, { filename: file });

      const result = await tempTracker.getChangedEntries(tempWorkspace, [loreQuery], {
        type: "git",
        value: baseCommit,
      });

      expect(result.entries).toEqual([]);

      // Sanity check: without the ignore file, the formatting change would be detected
      await runGit(["rm", ".git-blame-ignore-revs"], tempDir);
      await runGit(["commit", "-m", "remove ignore revs"], tempDir);

      const tempTracker2 = new GitChangeTracker({ cwd: tempDir });
      const result2 = await tempTracker2.getChangedEntries(tempWorkspace, [loreQuery], {
        type: "git",
        value: baseCommit,
      });
      expect(result2.entries).toHaveLength(1);
      expect(result2.entries[0].header.link?.id).toBe("entry1");
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
