import { describe, it, expect, beforeEach } from "vitest";
import { TimestampChangeTracker } from "./timestamp-tracker.js";
import { createWorkspace } from "../../parser.native.js";
import { Workspace } from "../../model/workspace.js";
import type { Query } from "../query.js";

describe("TimestampChangeTracker", () => {
  let tracker: TimestampChangeTracker;
  let workspace: Workspace;

  beforeEach(() => {
    tracker = new TimestampChangeTracker();
    workspace = createWorkspace();
  });

  describe("type", () => {
    it("should have type 'ts'", () => {
      expect(tracker.type).toBe("ts");
    });
  });

  describe("getCurrentMarker", () => {
    it("should return a timestamp marker", async () => {
      const marker = await tracker.getCurrentMarker();
      expect(marker.type).toBe("ts");
      expect(marker.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
    });

    it("should return current UTC time", async () => {
      const before = new Date();
      const marker = await tracker.getCurrentMarker();
      const after = new Date();

      const markerDate = new Date(marker.value);
      expect(markerDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 60000);
      expect(markerDate.getTime()).toBeLessThanOrEqual(after.getTime() + 60000);
    });
  });

  describe("getChangedEntries", () => {
    const loreQuery: Query = { entity: "lore", conditions: [] };

    it("should return all matching entries when marker is null", async () => {
      workspace.addDocument(
        `2026-01-07T10:00Z create lore "Entry 1" ^entry1
2026-01-07T11:00Z create lore "Entry 2" ^entry2`,
        { filename: "test.thalo" },
      );

      const result = await tracker.getChangedEntries(workspace, [loreQuery], null);

      expect(result.entries).toHaveLength(2);
      expect(result.currentMarker.type).toBe("ts");
    });

    it("should filter entries after timestamp marker", async () => {
      workspace.addDocument(
        `2026-01-07T10:00Z create lore "Old Entry" ^old
2026-01-07T12:00Z create lore "New Entry" ^new`,
        { filename: "test.thalo" },
      );

      const result = await tracker.getChangedEntries(workspace, [loreQuery], {
        type: "ts",
        value: "2026-01-07T11:00Z",
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].header.link?.id).toBe("new");
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

    it("should sort entries by timestamp", async () => {
      workspace.addDocument(
        `2026-01-07T12:00Z create lore "Later" ^later
2026-01-07T10:00Z create lore "Earlier" ^earlier`,
        { filename: "test.thalo" },
      );

      const result = await tracker.getChangedEntries(workspace, [loreQuery], null);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].header.link?.id).toBe("earlier");
      expect(result.entries[1].header.link?.id).toBe("later");
    });

    it("should deduplicate entries from multiple files", async () => {
      workspace.addDocument(`2026-01-07T10:00Z create lore "Entry 1" ^entry1`, {
        filename: "file1.thalo",
      });
      workspace.addDocument(`2026-01-07T11:00Z create lore "Entry 2" ^entry2`, {
        filename: "file2.thalo",
      });

      const result = await tracker.getChangedEntries(workspace, [loreQuery], null);

      expect(result.entries).toHaveLength(2);
    });

    it("should handle entries at exactly the marker time", async () => {
      workspace.addDocument(
        `2026-01-07T10:00Z create lore "At Marker" ^at
2026-01-07T10:01Z create lore "After Marker" ^after`,
        { filename: "test.thalo" },
      );

      // Entry at exactly the marker time should NOT be included (<=)
      const result = await tracker.getChangedEntries(workspace, [loreQuery], {
        type: "ts",
        value: "2026-01-07T10:00Z",
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].header.link?.id).toBe("after");
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
  });
});
