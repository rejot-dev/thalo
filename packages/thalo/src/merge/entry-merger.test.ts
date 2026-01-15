import { describe, it, expect } from "vitest";
import { mergeEntry } from "./entry-merger.js";
import type { EntryMatch } from "./entry-matcher.js";
import { mockInstanceEntry } from "./test-utils.js";

describe("entry-merger", () => {
  describe("mergeEntry", () => {
    it("returns ours for entry added only in ours", () => {
      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Ours Only",
        linkId: "e1",
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: null,
        ours: oursEntry,
        theirs: null,
      };

      const result = mergeEntry(match);

      expect(result).toBe(oursEntry);
    });

    it("returns theirs for entry added only in theirs", () => {
      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Theirs Only",
        linkId: "e2",
      });

      const match: EntryMatch = {
        identity: { linkId: "e2", entryType: "instance_entry" },
        base: null,
        ours: null,
        theirs: theirsEntry,
      };

      const result = mergeEntry(match);

      expect(result).toBe(theirsEntry);
    });

    it("returns null for entry deleted in ours", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Deleted",
        linkId: "e1",
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: null,
        theirs: baseEntry,
      };

      const result = mergeEntry(match);

      expect(result).toBeNull();
    });

    it("returns null for entry deleted in theirs", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Deleted",
        linkId: "e1",
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: baseEntry,
        theirs: null,
      };

      const result = mergeEntry(match);

      expect(result).toBeNull();
    });

    it("returns ours when only ours changed", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Original",
        linkId: "e1",
      });

      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Modified",
        linkId: "e1",
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: oursEntry,
        theirs: baseEntry,
      };

      const result = mergeEntry(match);

      expect(result).toBe(oursEntry);
    });

    it("returns theirs when only theirs changed", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Original",
        linkId: "e1",
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Modified",
        linkId: "e1",
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: baseEntry,
        theirs: theirsEntry,
      };

      const result = mergeEntry(match);

      expect(result).toBe(theirsEntry);
    });

    it("returns base when neither side changed", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Unchanged",
        linkId: "e1",
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: baseEntry,
        theirs: baseEntry,
      };

      const result = mergeEntry(match);

      expect(result).toBe(baseEntry);
    });

    it("merges non-conflicting metadata changes from both sides", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [
          { key: "type", value: '"fact"' },
          { key: "status", value: '"draft"' },
        ],
      });

      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [
          { key: "type", value: '"insight"' },
          { key: "status", value: '"draft"' },
        ],
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [
          { key: "type", value: '"fact"' },
          { key: "status", value: '"reviewed"' },
        ],
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: oursEntry,
        theirs: theirsEntry,
      };

      const result = mergeEntry(match);

      expect(result).not.toBeNull();
      if (!result) {
        return;
      }
      expect(result.type).toBe("instance_entry");
      if (result.type === "instance_entry") {
        expect(result.metadata).toHaveLength(2);
        expect(result.metadata.find((m) => m.key.value === "type")?.value.raw).toBe('"insight"');
        expect(result.metadata.find((m) => m.key.value === "status")?.value.raw).toBe('"reviewed"');
      }
    });

    it("preserves metadata deletion on one side", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [
          { key: "type", value: '"fact"' },
          { key: "subject", value: "^original" },
        ],
      });

      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [{ key: "type", value: '"fact"' }],
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [
          { key: "type", value: '"fact"' },
          { key: "subject", value: "^original" },
        ],
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: oursEntry,
        theirs: theirsEntry,
      };

      const result = mergeEntry(match);

      expect(result).not.toBeNull();
      if (!result) {
        return;
      }
      expect(result.type).toBe("instance_entry");
      if (result.type === "instance_entry") {
        expect(result.metadata).toHaveLength(1);
        expect(result.metadata.find((m) => m.key.value === "subject")).toBeUndefined();
      }
    });

    it("preserves deletion on both sides", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [
          { key: "type", value: '"fact"' },
          { key: "subject", value: "^original" },
          { key: "status", value: '"draft"' },
        ],
      });

      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [{ key: "type", value: '"fact"' }],
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [{ key: "type", value: '"fact"' }],
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: oursEntry,
        theirs: theirsEntry,
      };

      const result = mergeEntry(match);

      expect(result).not.toBeNull();
      if (!result) {
        return;
      }
      expect(result.type).toBe("instance_entry");
      if (result.type === "instance_entry") {
        expect(result.metadata).toHaveLength(1);
        expect(result.metadata[0].key.value).toBe("type");
      }
    });

    it("merges metadata addition on one side with deletion on other", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [
          { key: "type", value: '"fact"' },
          { key: "subject", value: "^original" },
        ],
      });

      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [{ key: "type", value: '"fact"' }],
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [
          { key: "type", value: '"fact"' },
          { key: "subject", value: "^original" },
          { key: "status", value: '"reviewed"' },
        ],
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: oursEntry,
        theirs: theirsEntry,
      };

      const result = mergeEntry(match);

      expect(result).not.toBeNull();
      if (!result) {
        return;
      }
      expect(result.type).toBe("instance_entry");
      if (result.type === "instance_entry") {
        expect(result.metadata).toHaveLength(2);
        expect(result.metadata.find((m) => m.key.value === "subject")).toBeUndefined();
        expect(result.metadata.find((m) => m.key.value === "status")?.value.raw).toBe('"reviewed"');
      }
    });

    it("does not resurrect content when both sides delete it", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        content: ["Original content"],
      });

      // Both ours and theirs have no content (deleted)
      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: oursEntry,
        theirs: theirsEntry,
      };

      const result = mergeEntry(match);

      expect(result).not.toBeNull();
      if (result && result.type === "instance_entry") {
        // Content should be null, not resurrected from base
        expect(result.content).toBeNull();
      }
    });

    it("takes ours when both sides add different content", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
      });

      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        content: ["Ours content"],
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        content: ["Theirs content"],
      });

      const match: EntryMatch = {
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: oursEntry,
        theirs: theirsEntry,
      };

      const result = mergeEntry(match);

      expect(result).not.toBeNull();
      if (result && result.type === "instance_entry" && result.content) {
        // When both sides add content, take ours
        expect(result.content.children[0].text).toBe("Ours content");
      }
    });
  });
});
