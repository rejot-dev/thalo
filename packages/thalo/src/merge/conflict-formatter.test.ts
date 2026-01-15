import { describe, it, expect } from "vitest";
import { formatConflict, formatEntry } from "./conflict-formatter.js";
import type { Entry } from "../ast/ast-types.js";
import type { MergeConflict } from "./conflict-detector.js";
import {
  mockInstanceEntry,
  mockSchemaEntry,
  mockSynthesisEntry,
  mockActualizeEntry,
} from "./test-utils.js";

describe("conflict-formatter", () => {
  describe("formatConflict", () => {
    it("formats conflict with Git-style markers", () => {
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

      const conflict: MergeConflict = {
        type: "duplicate-link-id",
        message: "Duplicate link ID",
        location: 0,
        identity: { linkId: "shared-id", entryType: "instance_entry" },
        ours: oursEntry,
        theirs: theirsEntry,
        context: { linkId: "shared-id" },
      };

      const lines = formatConflict(conflict);

      expect(lines[0]).toBe("<<<<<<< ours");
      expect(lines[lines.length - 1]).toBe(">>>>>>> theirs");
      expect(lines).toContain("=======");
      expect(lines.some((l) => l.includes("Ours"))).toBe(true);
      expect(lines.some((l) => l.includes("Theirs"))).toBe(true);
    });

    it("formats conflict with diff3-style markers when showBase is true", () => {
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

      const conflict: MergeConflict = {
        type: "concurrent-title-change",
        message: "Concurrent title change",
        location: 0,
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: oursEntry,
        theirs: theirsEntry,
      };

      const lines = formatConflict(conflict, { showBase: true });

      expect(lines[0]).toBe("<<<<<<< ours");
      expect(lines).toContain("||||||| base");
      expect(lines).toContain("=======");
      expect(lines[lines.length - 1]).toBe(">>>>>>> theirs");
      expect(lines.some((l) => l.includes("Base"))).toBe(true);
      expect(lines.some((l) => l.includes("Ours"))).toBe(true);
      expect(lines.some((l) => l.includes("Theirs"))).toBe(true);
    });

    it("formats conflict with diff3-style markers when markerStyle is diff3", () => {
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

      const conflict: MergeConflict = {
        type: "concurrent-title-change",
        message: "Concurrent title change",
        location: 0,
        identity: { linkId: "e1", entryType: "instance_entry" },
        base: baseEntry,
        ours: oursEntry,
        theirs: theirsEntry,
      };

      const lines = formatConflict(conflict, { markerStyle: "diff3" });

      expect(lines).toContain("||||||| base");
    });

    it("handles conflict with missing ours entry", () => {
      const theirsEntry = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Theirs",
        linkId: "e1",
      });

      const conflict: MergeConflict = {
        type: "concurrent-content-edit",
        message: "Content conflict",
        location: 0,
        identity: { linkId: "e1", entryType: "instance_entry" },
        theirs: theirsEntry,
      };

      const lines = formatConflict(conflict);

      expect(lines[0]).toBe("<<<<<<< ours");
      expect(lines).toContain("=======");
      expect(lines[lines.length - 1]).toBe(">>>>>>> theirs");
    });

    it("handles conflict with missing theirs entry", () => {
      const oursEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Ours",
        linkId: "e1",
      });

      const conflict: MergeConflict = {
        type: "concurrent-content-edit",
        message: "Content conflict",
        location: 0,
        identity: { linkId: "e1", entryType: "instance_entry" },
        ours: oursEntry,
      };

      const lines = formatConflict(conflict);

      expect(lines[0]).toBe("<<<<<<< ours");
      expect(lines).toContain("=======");
      expect(lines[lines.length - 1]).toBe(">>>>>>> theirs");
    });
  });

  describe("formatEntry", () => {
    it("formats instance entry with header only", () => {
      const entry: Entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Test Entry",
        linkId: "test-id",
      });

      const lines = formatEntry(entry);

      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('2026-01-05T10:00Z create lore "Test Entry" ^test-id');
    });

    it("formats instance entry with tags", () => {
      const entry: Entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Test",
        linkId: "e1",
        tags: ["tag1", "tag2"],
      });

      const lines = formatEntry(entry);

      expect(lines[0]).toContain("#tag1");
      expect(lines[0]).toContain("#tag2");
    });

    it("formats instance entry with metadata", () => {
      const entry: Entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Test",
        linkId: "e1",
        metadata: [
          { key: "type", value: '"fact"' },
          { key: "subject", value: "^person" },
        ],
      });

      const lines = formatEntry(entry);

      expect(lines).toContain('  type: "fact"');
      expect(lines).toContain("  subject: ^person");
    });

    it("formats instance entry with content", () => {
      const entry: Entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Test",
        linkId: "e1",
        content: ["Line 1", "Line 2"],
      });

      const lines = formatEntry(entry);

      expect(lines).toContain("");
      expect(lines).toContain("  Line 1");
      expect(lines).toContain("  Line 2");
    });

    it("formats schema entry with header only", () => {
      const entry: Entry = mockSchemaEntry({
        timestamp: "2026-01-01T00:00Z",
        directive: "define-entity",
        entityName: "lore",
        title: "Lore",
      });

      const lines = formatEntry(entry);

      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('2026-01-01T00:00Z define-entity lore "Lore"');
    });

    it("formats synthesis entry", () => {
      const entry: Entry = mockSynthesisEntry({
        timestamp: "2026-01-05T10:00Z",
        title: "Synthesis",
        linkId: "synth-1",
        tags: ["tag1"],
      });

      const lines = formatEntry(entry);

      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('2026-01-05T10:00Z define-synthesis "Synthesis" ^synth-1 #tag1');
    });

    it("formats actualize entry", () => {
      const entry: Entry = mockActualizeEntry({
        timestamp: "2026-01-05T10:00Z",
        target: "synth-1",
      });

      const lines = formatEntry(entry);

      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe("2026-01-05T10:00Z actualize-synthesis ^synth-1");
    });
  });
});
