import { describe, it, expect, beforeAll } from "vitest";
import { mergeThaloFiles } from "./driver.js";
import { initParser } from "../parser.node.js";

describe("mergeThaloFiles", () => {
  beforeAll(async () => {
    await initParser();
  });

  describe("clean merges", () => {
    it("merges independent additions from both sides", () => {
      const base = `2026-01-01T00:00Z define-entity lore "Lore"
  # Metadata
  type: "fact" | "insight"`;

      const ours =
        base +
        `

2026-01-05T10:00Z create lore "My addition" #ours
  type: "fact"`;

      const theirs =
        base +
        `

2026-01-05T11:00Z create lore "Their addition" #theirs
  type: "insight"`;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.content).toContain("My addition");
      expect(result.content).toContain("Their addition");
      expect(result.stats.totalEntries).toBeGreaterThanOrEqual(2);
    });

    it("auto-merges non-conflicting metadata changes", () => {
      const base = `2026-01-05T10:00Z create lore "Entry" ^entry-1
  type: "fact"
  subject: ^original`;

      const ours = base.replace("subject: ^original", "subject: ^updated-ours");
      const theirs = base + `\n  status: "reviewed"`;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).toContain("subject: ^updated-ours");
      expect(result.content).toContain('status: "reviewed"');
    });

    it("preserves chronological order after merge", () => {
      const base = `2026-01-01T00:00Z define-entity lore "Lore"`;
      const ours = base + `\n\n2026-01-05T15:00Z create lore "Later" #tag`;
      const theirs = base + `\n\n2026-01-05T10:00Z create lore "Earlier" #tag`;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      const lines = result.content.split("\n");
      const earlierIdx = lines.findIndex((l) => l.includes("Earlier"));
      const laterIdx = lines.findIndex((l) => l.includes("Later"));
      expect(earlierIdx).toBeLessThan(laterIdx);
    });
  });

  describe("conflict detection", () => {
    it("detects duplicate link IDs from both sides", () => {
      const base = `2026-01-01T00:00Z define-entity lore "Lore"`;

      const ours = base + `\n\n2026-01-05T10:00Z create lore "Ours" ^shared-id`;
      const theirs = base + `\n\n2026-01-05T11:00Z create lore "Theirs" ^shared-id`;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe("duplicate-link-id");
      expect(result.content).toContain("<<<<<<< ours");
      expect(result.content).toContain("=======");
      expect(result.content).toContain(">>>>>>> theirs");
    });

    it("detects concurrent metadata updates", () => {
      const base = `2026-01-05T10:00Z create lore "Entry" ^entry-1
  type: "fact"
  subject: ^original`;

      const ours = base.replace("subject: ^original", "subject: ^ours-version");
      const theirs = base.replace("subject: ^original", "subject: ^theirs-version");

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe("concurrent-metadata-update");
      expect(result.conflicts[0].context?.metadataKey).toBe("subject");
    });

    it("detects concurrent title changes", () => {
      const base = `2026-01-05T10:00Z create lore "Original" ^entry-1
  type: "fact"`;

      const ours = base.replace('"Original"', '"Ours Version"');
      const theirs = base.replace('"Original"', '"Theirs Version"');

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe("concurrent-title-change");
    });
  });

  describe("deletion handling", () => {
    it("accepts deletion from one side", () => {
      const base = `2026-01-05T10:00Z create lore "To Delete" ^entry-1
2026-01-05T11:00Z create lore "To Keep" ^entry-2`;

      const ours = `2026-01-05T11:00Z create lore "To Keep" ^entry-2`;
      const theirs = base;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).not.toContain("To Delete");
      expect(result.content).toContain("To Keep");
    });
  });

  describe("timestamp handling", () => {
    it("matches entries without explicit link IDs by timestamp", () => {
      const base = `2026-01-05T10:00Z create lore "Entry"
  type: "fact"`;

      const ours = base.replace('type: "fact"', 'type: "insight"');
      const theirs = base + `\n  subject: ^someone`;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).toContain('type: "insight"');
      expect(result.content).toContain("subject: ^someone");
    });
  });

  describe("error handling", () => {
    it("handles empty base gracefully", () => {
      const base = "";
      const ours = `2026-01-05T10:00Z create lore "Entry" ^e1`;
      const theirs = `2026-01-05T11:00Z create lore "Entry" ^e2`;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).toContain("^e1");
      expect(result.content).toContain("^e2");
    });

    it("handles empty ours file as deletion", () => {
      const base = `2026-01-01T00:00Z define-entity lore "Lore"
2026-01-02T00:00Z create lore "Entry" ^e1`;
      const ours = "";
      const theirs = base;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).toBe("");
    });

    it("handles empty theirs file as deletion", () => {
      const base = `2026-01-01T00:00Z define-entity lore "Lore"
2026-01-02T00:00Z create lore "Entry" ^e1`;
      const ours = base;
      const theirs = "";

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).toBe("");
    });
  });

  describe("timestamp with colons", () => {
    it.skip("correctly matches entries with timestamps containing colons", () => {
      const base = `2026-01-01T00:00Z define-entity lore "Lore"

2026-01-07T11:40:00Z create lore "Entry"
  type: "fact"`;

      const ours = base.replace('type: "fact"', 'type: "insight"');
      const theirs = base + `\n  subject: ^someone`;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).toContain('type: "insight"');
      expect(result.content).toContain("subject: ^someone");
      expect(result.content).toContain("2026-01-07T11:40:00Z");
    });

    it.skip("handles multiple entries with colon-containing timestamps", () => {
      const base = `2026-01-01T00:00Z define-entity lore "Lore"

2026-01-07T11:40:00Z create lore "Entry1"

2026-01-07T14:25:30Z create lore "Entry2"`;

      const ours = base + `\n\n2026-01-08T10:00:00Z create lore "Ours" ^ours`;
      const theirs = base + `\n\n2026-01-08T11:00:00Z create lore "Theirs" ^theirs`;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).toContain("Entry1");
      expect(result.content).toContain("Entry2");
      expect(result.content).toContain("Ours");
      expect(result.content).toContain("Theirs");
    });
  });

  describe("metadata deletion", () => {
    it("preserves metadata deletion on both sides", () => {
      const base = `2026-01-01T00:00Z define-entity lore "Lore"

2026-01-05T10:00Z create lore "Entry" ^entry-1
  type: "fact"
  subject: ^original
  status: "draft"`;

      const ours = `2026-01-01T00:00Z define-entity lore "Lore"

2026-01-05T10:00Z create lore "Entry" ^entry-1
  type: "fact"`;

      const theirs = `2026-01-01T00:00Z define-entity lore "Lore"

2026-01-05T10:00Z create lore "Entry" ^entry-1
  type: "fact"`;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).not.toContain("subject:");
      expect(result.content).not.toContain("status:");
      expect(result.content).toContain('type: "fact"');
    });

    it("preserves deletion on one side when other side unchanged", () => {
      const base = `2026-01-01T00:00Z define-entity lore "Lore"

2026-01-05T10:00Z create lore "Entry" ^entry-1
  type: "fact"
  subject: ^original`;

      const ours = `2026-01-01T00:00Z define-entity lore "Lore"

2026-01-05T10:00Z create lore "Entry" ^entry-1
  type: "fact"`;

      const theirs = base;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).not.toContain("subject:");
    });

    it("merges deletion on one side with addition of different key on other", () => {
      const base = `2026-01-01T00:00Z define-entity lore "Lore"

2026-01-05T10:00Z create lore "Entry" ^entry-1
  type: "fact"
  subject: ^original`;

      const ours = `2026-01-01T00:00Z define-entity lore "Lore"

2026-01-05T10:00Z create lore "Entry" ^entry-1
  type: "fact"`;

      const theirs = base + `\n  status: "reviewed"`;

      const result = mergeThaloFiles(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.content).not.toContain("subject:");
      expect(result.content).toContain('status: "reviewed"');
      expect(result.content).toContain('type: "fact"');
    });
  });
});
