import { describe, it, expect } from "vitest";
import { buildMergedResult } from "./merge-result-builder.js";
import type { Entry } from "../ast/types.js";
import type { EntryMatch, MergeConflict } from "./types.js";
import { mockInstanceEntry } from "./test-utils.js";

describe("merge-result-builder", () => {
  describe("buildMergedResult", () => {
    it("builds result with no conflicts", () => {
      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry 1",
        linkId: "e1",
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry 2",
        linkId: "e2",
      });

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: null,
          ours: oursEntry,
          theirs: null,
        },
        {
          identity: { linkId: "e2", entryType: "instance_entry" },
          base: null,
          ours: null,
          theirs: theirsEntry,
        },
      ];

      const result = buildMergedResult(matches, []);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.content).toContain("Entry 1");
      expect(result.content).toContain("Entry 2");
      expect(result.stats.totalEntries).toBe(2);
      expect(result.stats.oursOnly).toBe(1);
      expect(result.stats.theirsOnly).toBe(1);
      expect(result.stats.conflicts).toBe(0);
    });

    it("builds result with conflicts", () => {
      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Ours",
        linkId: "shared-id",
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Theirs",
        linkId: "shared-id",
      });

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "shared-id", entryType: "instance_entry" },
          base: null,
          ours: oursEntry,
          theirs: theirsEntry,
        },
      ];

      const conflicts: MergeConflict[] = [
        {
          type: "duplicate-link-id",
          message: "Duplicate link ID",
          location: 0,
          identity: { linkId: "shared-id", entryType: "instance_entry" },
          ours: oursEntry,
          theirs: theirsEntry,
          context: { linkId: "shared-id" },
        },
      ];

      const result = buildMergedResult(matches, conflicts);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.content).toContain("<<<<<<< ours");
      expect(result.content).toContain("=======");
      expect(result.content).toContain(">>>>>>> theirs");
      expect(result.stats.conflicts).toBe(1);
    });

    it("sorts entries chronologically by timestamp", () => {
      const entry1: Entry = mockInstanceEntry({
        timestamp: "2026-01-05T15:00Z",
        directive: "create",
        entity: "lore",
        title: "Later",
        linkId: "e2",
      });

      const entry2: Entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Earlier",
        linkId: "e1",
      });

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e2", entryType: "instance_entry" },
          base: null,
          ours: entry1,
          theirs: null,
        },
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: null,
          ours: entry2,
          theirs: null,
        },
      ];

      const result = buildMergedResult(matches, []);

      const lines = result.content.split("\n");
      const earlierIdx = lines.findIndex((l) => l.includes("Earlier"));
      const laterIdx = lines.findIndex((l) => l.includes("Later"));
      expect(earlierIdx).toBeLessThan(laterIdx);
    });

    it("excludes deleted entries from output", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Deleted",
        linkId: "e1",
      });

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: baseEntry,
          ours: null,
          theirs: baseEntry,
        },
      ];

      const result = buildMergedResult(matches, []);

      expect(result.content).not.toContain("Deleted");
      expect(result.stats.totalEntries).toBe(0);
    });

    it("calculates statistics correctly", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T09:00Z",
        directive: "create",
        entity: "lore",
        title: "Base",
        linkId: "e0",
      });

      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Ours Only",
        linkId: "e1",
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Theirs Only",
        linkId: "e2",
      });

      const modifiedEntry = mockInstanceEntry({
        timestamp: "2026-01-05T12:00Z",
        directive: "create",
        entity: "lore",
        title: "Modified",
        linkId: "e3",
      });

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e0", entryType: "instance_entry" },
          base: baseEntry,
          ours: baseEntry,
          theirs: baseEntry,
        },
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: null,
          ours: oursEntry,
          theirs: null,
        },
        {
          identity: { linkId: "e2", entryType: "instance_entry" },
          base: null,
          ours: null,
          theirs: theirsEntry,
        },
        {
          identity: { linkId: "e3", entryType: "instance_entry" },
          base: baseEntry,
          ours: modifiedEntry,
          theirs: baseEntry,
        },
      ];

      const result = buildMergedResult(matches, []);

      expect(result.stats.totalEntries).toBe(4);
      expect(result.stats.common).toBe(1);
      expect(result.stats.oursOnly).toBe(1);
      expect(result.stats.theirsOnly).toBe(1);
      expect(result.stats.autoMerged).toBe(1);
      expect(result.stats.conflicts).toBe(0);
    });

    it("sets conflict locations correctly", () => {
      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Ours",
        linkId: "e1",
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Theirs",
        linkId: "e1",
      });

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: oursEntry,
          ours: oursEntry,
          theirs: theirsEntry,
        },
      ];

      const conflicts: MergeConflict[] = [
        {
          type: "concurrent-title-change",
          message: "Concurrent title change",
          location: 0,
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: oursEntry,
          ours: oursEntry,
          theirs: theirsEntry,
        },
      ];

      const result = buildMergedResult(matches, conflicts);

      expect(result.conflicts[0].location).toBeGreaterThan(0);
    });

    it("handles empty match list", () => {
      const result = buildMergedResult([], []);

      expect(result.success).toBe(true);
      expect(result.content).toBe("");
      expect(result.stats.totalEntries).toBe(0);
    });

    it("includes conflict markers with diff3 style when specified", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Base",
        linkId: "e1",
      });

      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Ours",
        linkId: "e1",
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Theirs",
        linkId: "e1",
      });

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: baseEntry,
          ours: oursEntry,
          theirs: theirsEntry,
        },
      ];

      const conflicts: MergeConflict[] = [
        {
          type: "concurrent-title-change",
          message: "Concurrent title change",
          location: 0,
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: baseEntry,
          ours: oursEntry,
          theirs: theirsEntry,
        },
      ];

      const result = buildMergedResult(matches, conflicts, { markerStyle: "diff3" });

      expect(result.content).toContain("||||||| base");
    });

    it("handles entries with non-serializable syntaxNode fields without throwing", () => {
      // Create entry with mock syntaxNode that could have circular refs
      const entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Test Entry",
        linkId: "e1",
      });

      // Add a synthetic syntaxNode-like object with circular reference
      const circularRef: Record<string, unknown> = { value: "test" };
      circularRef["self"] = circularRef; // Create circular reference
      (entry as unknown as Record<string, unknown>)["_testCircularRef"] = circularRef;

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: entry,
          ours: entry,
          theirs: entry,
        },
      ];

      // Should not throw even with circular references in the entry
      expect(() => {
        const result = buildMergedResult(matches, []);
        expect(result.success).toBe(true);
        expect(result.content).toBeTruthy();
      }).not.toThrow();
    });
  });
});
