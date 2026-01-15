import { describe, it, expect } from "vitest";
import { TimestampChangeTracker } from "./change-tracker.js";
import { createChangeTracker, GitChangeTracker } from "./create-tracker.js";
import * as path from "node:path";
import * as os from "node:os";

describe("createChangeTracker", () => {
  // change-tracker/ → services/ → src/ → thalo/ → packages/ → repo root
  const repoRoot = path.resolve(import.meta.dirname, "../../../../..");

  describe("auto mode (default)", () => {
    it("should return GitChangeTracker when in git repo", async () => {
      const tracker = await createChangeTracker({ cwd: repoRoot });
      expect(tracker).toBeInstanceOf(GitChangeTracker);
      expect(tracker.type).toBe("git");
    });

    it("should return TimestampChangeTracker when not in git repo", async () => {
      const tracker = await createChangeTracker({ cwd: os.tmpdir() });
      expect(tracker).toBeInstanceOf(TimestampChangeTracker);
      expect(tracker.type).toBe("ts");
    });
  });

  describe("preferredType: 'git'", () => {
    it("should return GitChangeTracker when in git repo", async () => {
      const tracker = await createChangeTracker({
        cwd: repoRoot,
        preferredType: "git",
      });
      expect(tracker).toBeInstanceOf(GitChangeTracker);
    });

    it("should throw when not in git repo", async () => {
      await expect(
        createChangeTracker({
          cwd: os.tmpdir(),
          preferredType: "git",
        }),
      ).rejects.toThrow("Git tracker requested but not in a git repository");
    });
  });

  describe("preferredType: 'timestamp'", () => {
    it("should return TimestampChangeTracker even in git repo", async () => {
      const tracker = await createChangeTracker({
        cwd: repoRoot,
        preferredType: "timestamp",
      });
      expect(tracker).toBeInstanceOf(TimestampChangeTracker);
      expect(tracker.type).toBe("ts");
    });

    it("should return TimestampChangeTracker when not in git repo", async () => {
      const tracker = await createChangeTracker({
        cwd: os.tmpdir(),
        preferredType: "timestamp",
      });
      expect(tracker).toBeInstanceOf(TimestampChangeTracker);
      expect(tracker.type).toBe("ts");
    });
  });

  describe("default options", () => {
    it("should use process.cwd() when cwd not specified", async () => {
      // This test depends on running from within the git repo
      const tracker = await createChangeTracker();
      // Should detect git since we're running from within the repo
      expect(tracker.type).toBe("git");
    });
  });
});

describe("exports", () => {
  it("should export browser-safe parts from change-tracker.js", async () => {
    const exports = await import("./change-tracker.js");

    // Browser-safe exports
    expect(exports.TimestampChangeTracker).toBeDefined();
    expect(exports.parseCheckpoint).toBeDefined();
    expect(exports.formatCheckpoint).toBeDefined();
    expect(exports.UncommittedChangesError).toBeDefined();

    // createChangeTracker and GitChangeTracker are NOT exported here (Node-only)
    expect(exports).not.toHaveProperty("createChangeTracker");
    expect(exports).not.toHaveProperty("GitChangeTracker");
  });

  it("should export Node-only parts from create-tracker.js", async () => {
    const exports = await import("./create-tracker.js");

    expect(exports.createChangeTracker).toBeDefined();
    expect(exports.GitChangeTracker).toBeDefined();
    expect(exports.UncommittedChangesError).toBeDefined();
  });
});
