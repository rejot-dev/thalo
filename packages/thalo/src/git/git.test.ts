import { describe, it, expect } from "vitest";
import {
  detectGitContext,
  getCurrentCommit,
  getFilesChangedSince,
  getFileAtCommit,
  wasFileModifiedSince,
  commitExists,
} from "./git.js";
import * as path from "node:path";
import * as os from "node:os";

// These tests run against the actual git repo
// They should pass as long as we're in the thalo-merge-driver repo

describe("git utilities", () => {
  // git/ → src/ → thalo/ → packages/ → repo root
  const repoRoot = path.resolve(import.meta.dirname, "../../../..");

  describe("detectGitContext", () => {
    it("should detect git repo in repo root", async () => {
      const context = await detectGitContext(repoRoot);
      expect(context.isGitRepo).toBe(true);
      expect(context.rootDir).toBe(repoRoot);
      expect(context.currentCommit).toMatch(/^[a-f0-9]{40}$/);
    });

    it("should detect git repo in subdirectory", async () => {
      const subdir = path.join(repoRoot, "packages/thalo/src");
      const context = await detectGitContext(subdir);
      expect(context.isGitRepo).toBe(true);
      expect(context.rootDir).toBe(repoRoot);
    });

    it("should return isGitRepo: false for non-git directory", async () => {
      const context = await detectGitContext(os.tmpdir());
      expect(context.isGitRepo).toBe(false);
      expect(context.rootDir).toBeUndefined();
      expect(context.currentCommit).toBeUndefined();
    });
  });

  describe("getCurrentCommit", () => {
    it("should return current commit hash", async () => {
      const commit = await getCurrentCommit(repoRoot);
      expect(commit).toMatch(/^[a-f0-9]{40}$/);
    });

    it("should return null for non-git directory", async () => {
      const commit = await getCurrentCommit(os.tmpdir());
      expect(commit).toBeNull();
    });
  });

  describe("commitExists", () => {
    it("should return true for existing commit", async () => {
      const commit = await getCurrentCommit(repoRoot);
      if (commit) {
        const exists = await commitExists(commit, repoRoot);
        expect(exists).toBe(true);
      }
    });

    it("should return false for non-existent commit", async () => {
      const exists = await commitExists("0000000000000000000000000000000000000000", repoRoot);
      expect(exists).toBe(false);
    });

    it("should return false for invalid commit", async () => {
      const exists = await commitExists("not-a-commit", repoRoot);
      expect(exists).toBe(false);
    });
  });

  describe("getFilesChangedSince", () => {
    it("should return empty array for HEAD..HEAD", async () => {
      const commit = await getCurrentCommit(repoRoot);
      if (commit) {
        const changes = await getFilesChangedSince(commit, repoRoot);
        expect(changes).toEqual([]);
      }
    });

    it("should return FileChange objects between commits", async () => {
      // Use HEAD~1 to get recent changes
      const changes = await getFilesChangedSince("HEAD~1", repoRoot);
      expect(Array.isArray(changes)).toBe(true);

      // Each item should be a FileChange object
      for (const change of changes) {
        expect(change).toHaveProperty("status");
        expect(change).toHaveProperty("path");
        expect(["added", "modified", "renamed", "deleted"]).toContain(change.status);
        expect(typeof change.path).toBe("string");

        // oldPath should only be present for renames
        if (change.status === "renamed") {
          expect(change.oldPath).toBeDefined();
          expect(typeof change.oldPath).toBe("string");
        }
      }
    });

    it("should detect rename status correctly", async () => {
      // This test validates the parsing logic for the -M flag output
      // We can't easily create a rename in the test, but we can verify
      // that non-renamed files don't have oldPath
      const changes = await getFilesChangedSince("HEAD~1", repoRoot);

      for (const change of changes) {
        if (change.status !== "renamed") {
          expect(change.oldPath).toBeUndefined();
        }
      }
    });
  });

  describe("getFileAtCommit", () => {
    it("should get file content at HEAD", async () => {
      const commit = await getCurrentCommit(repoRoot);
      if (commit) {
        const content = await getFileAtCommit("package.json", commit, repoRoot);
        expect(content).toContain("@rejot-dev/");
        expect(content).toContain("turbo");
      }
    });

    it("should return null for non-existent file", async () => {
      const commit = await getCurrentCommit(repoRoot);
      if (commit) {
        const content = await getFileAtCommit("non-existent-file.xyz", commit, repoRoot);
        expect(content).toBeNull();
      }
    });

    it("should handle absolute paths", async () => {
      const commit = await getCurrentCommit(repoRoot);
      if (commit) {
        const absolutePath = path.join(repoRoot, "package.json");
        const content = await getFileAtCommit(absolutePath, commit, repoRoot);
        expect(content).toContain("@rejot-dev/");
        expect(content).toContain("turbo");
      }
    });
  });

  describe("wasFileModifiedSince", () => {
    it("should return false for unmodified file since HEAD", async () => {
      const commit = await getCurrentCommit(repoRoot);
      if (commit) {
        const modified = await wasFileModifiedSince("package.json", commit, repoRoot);
        expect(modified).toBe(false);
      }
    });
  });
});
