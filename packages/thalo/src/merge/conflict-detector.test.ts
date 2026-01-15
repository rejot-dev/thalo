import { describe, it, expect } from "vitest";
import { detectConflicts } from "./conflict-detector.js";
import type { EntryMatch } from "./entry-matcher.js";
import { mockInstanceEntry } from "./test-utils.js";

describe("conflict-detector", () => {
  describe("detectConflicts", () => {
    it("detects no conflicts for independent additions", () => {
      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Ours",
        linkId: "e1",
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Theirs",
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

      const conflicts = detectConflicts(matches);

      expect(conflicts).toHaveLength(0);
    });

    it("detects duplicate link ID conflict", () => {
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

      const conflicts = detectConflicts(matches);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe("duplicate-link-id");
      expect(conflicts[0].context?.linkId).toBe("shared-id");
      expect(conflicts[0].ours).toBe(oursEntry);
      expect(conflicts[0].theirs).toBe(theirsEntry);
    });

    it("detects concurrent metadata update conflict", () => {
      const baseEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [{ key: "subject", value: "^original" }],
      });

      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [{ key: "subject", value: "^ours-version" }],
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        metadata: [{ key: "subject", value: "^theirs-version" }],
      });

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: baseEntry,
          ours: oursEntry,
          theirs: theirsEntry,
        },
      ];

      const conflicts = detectConflicts(matches);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe("concurrent-metadata-update");
      expect(conflicts[0].context?.metadataKey).toBe("subject");
      expect(conflicts[0].base).toBe(baseEntry);
      expect(conflicts[0].ours).toBe(oursEntry);
      expect(conflicts[0].theirs).toBe(theirsEntry);
    });

    it("detects concurrent title change conflict", () => {
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
        title: "Ours Version",
        linkId: "e1",
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Theirs Version",
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

      const conflicts = detectConflicts(matches);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe("concurrent-title-change");
      expect(conflicts[0].base).toBe(baseEntry);
      expect(conflicts[0].ours).toBe(oursEntry);
      expect(conflicts[0].theirs).toBe(theirsEntry);
    });

    it("does not detect conflict for non-overlapping metadata changes", () => {
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

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: baseEntry,
          ours: oursEntry,
          theirs: theirsEntry,
        },
      ];

      const conflicts = detectConflicts(matches);

      expect(conflicts).toHaveLength(0);
    });

    it("does not detect conflict when only one side changed", () => {
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

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: baseEntry,
          ours: oursEntry,
          theirs: baseEntry,
        },
      ];

      const conflicts = detectConflicts(matches);

      expect(conflicts).toHaveLength(0);
    });

    it("does not detect conflict for deletions", () => {
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

      const conflicts = detectConflicts(matches);

      expect(conflicts).toHaveLength(0);
    });

    it("applies custom conflict rules", () => {
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
        tags: ["tag1"],
      });

      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry",
        linkId: "e1",
        tags: ["tag2"],
      });

      const matches: EntryMatch[] = [
        {
          identity: { linkId: "e1", entryType: "instance_entry" },
          base: baseEntry,
          ours: oursEntry,
          theirs: theirsEntry,
        },
      ];

      const customRule = {
        name: "concurrent-tag-change",
        detect: (match: EntryMatch) => {
          const { base, ours, theirs } = match;
          if (
            base &&
            ours &&
            theirs &&
            base.type === "instance_entry" &&
            ours.type === "instance_entry" &&
            theirs.type === "instance_entry"
          ) {
            const baseTags = base.header.tags.map((t) => t.name).join(",");
            const oursTags = ours.header.tags.map((t) => t.name).join(",");
            const theirsTags = theirs.header.tags.map((t) => t.name).join(",");

            if (baseTags !== oursTags && baseTags !== theirsTags && oursTags !== theirsTags) {
              return {
                type: "concurrent-metadata-update" as const,
                message: "Concurrent tag changes detected",
                location: 0,
                identity: match.identity,
                base,
                ours,
                theirs,
              };
            }
          }
          return null;
        },
      };

      const conflicts = detectConflicts(matches, { conflictRules: [customRule] });

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toBe("Concurrent tag changes detected");
    });
  });
});
