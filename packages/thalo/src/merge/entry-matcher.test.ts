import { describe, it, expect } from "vitest";
import { matchEntries, getEntryIdentity, serializeIdentity } from "./entry-matcher.js";
import type { Entry, InstanceEntry } from "../ast/types.js";
import {
  mockInstanceEntry,
  mockSchemaEntry,
  mockSynthesisEntry,
  mockActualizeEntry,
} from "./test-utils.js";

describe("entry-matcher", () => {
  describe("getEntryIdentity", () => {
    it("extracts link ID from instance entry", () => {
      const entry = mockInstanceEntry({
        timestamp: "2026-01-01T00:00Z",
        directive: "create",
        entity: "lore",
        title: "Test",
        linkId: "test-id",
      });

      const identity = getEntryIdentity(entry);

      expect(identity.linkId).toBe("test-id");
      expect(identity.entryType).toBe("instance_entry");
      expect(identity.timestamp).toBeUndefined();
    });

    it("extracts link ID from schema entry", () => {
      const entry = mockSchemaEntry({
        timestamp: "2026-01-01T00:00Z",
        directive: "define-entity",
        entityName: "lore",
        title: "Lore",
        linkId: "schema-id",
      });

      const identity = getEntryIdentity(entry);

      expect(identity.linkId).toBe("schema-id");
      expect(identity.entryType).toBe("schema_entry");
    });

    it("extracts link ID from synthesis entry", () => {
      const entry = mockSynthesisEntry({
        timestamp: "2026-01-01T00:00Z",
        title: "Synthesis",
        linkId: "synth-id",
      });

      const identity = getEntryIdentity(entry);

      expect(identity.linkId).toBe("synth-id");
      expect(identity.entryType).toBe("synthesis_entry");
    });

    it("extracts link ID from actualize entry", () => {
      const entry = mockActualizeEntry({
        timestamp: "2026-01-01T00:00Z",
        target: "target-id",
      });

      const identity = getEntryIdentity(entry);

      expect(identity.linkId).toBe("target-id");
      expect(identity.entryType).toBe("actualize_entry");
    });

    it("falls back to timestamp for entry without link ID", () => {
      const entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Test",
      });

      const identity = getEntryIdentity(entry);

      expect(identity.linkId).toBeUndefined();
      expect(identity.timestamp).toBe("2026-01-05T10:00Z");
      expect(identity.entryType).toBe("instance_entry");
    });

    it("handles timestamps with colons", () => {
      const entry = mockInstanceEntry({
        timestamp: "2026-01-07T11:40:00Z",
        directive: "create",
        entity: "lore",
        title: "Test",
      });

      const identity = getEntryIdentity(entry);

      expect(identity.timestamp).toBe("2026-01-07T11:40:00Z");
      expect(identity.entryType).toBe("instance_entry");
    });
  });

  describe("serializeIdentity", () => {
    it("serializes link ID identity", () => {
      const identity = {
        linkId: "test-id",
        entryType: "instance_entry" as const,
      };

      const key = serializeIdentity(identity);

      expect(key).toBe("link:test-id");
    });

    it("serializes timestamp identity", () => {
      const identity = {
        timestamp: "2026-01-05T10:00Z",
        entryType: "instance_entry" as const,
      };

      const key = serializeIdentity(identity);

      expect(key).toBe("ts:2026-01-05T10:00Z:instance_entry");
    });

    it("serializes timestamp with colons correctly", () => {
      const identity = {
        timestamp: "2026-01-07T11:40:00Z",
        entryType: "instance_entry" as const,
      };

      const key = serializeIdentity(identity);

      expect(key).toBe("ts:2026-01-07T11:40:00Z:instance_entry");
    });

    it("returns fallback for identity without link ID or timestamp", () => {
      const identity = {
        entryType: "instance_entry" as const,
      };

      const key = serializeIdentity(identity);
      expect(key).toBe("type:instance_entry");
    });
  });

  describe("matchEntries", () => {
    it("matches entries with same link ID", () => {
      const base: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-01T00:00Z",
          directive: "create",
          entity: "lore",
          title: "Base",
          linkId: "e1",
        }),
      ];

      const ours: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-01T00:00Z",
          directive: "create",
          entity: "lore",
          title: "Ours",
          linkId: "e1",
        }),
      ];

      const theirs: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-01T00:00Z",
          directive: "create",
          entity: "lore",
          title: "Theirs",
          linkId: "e1",
        }),
      ];

      const matches = matchEntries(base, ours, theirs);

      expect(matches).toHaveLength(1);
      expect(matches[0].identity.linkId).toBe("e1");
      expect((matches[0].base as InstanceEntry)?.header.title.value).toBe("Base");
      expect((matches[0].ours as InstanceEntry)?.header.title.value).toBe("Ours");
      expect((matches[0].theirs as InstanceEntry)?.header.title.value).toBe("Theirs");
    });

    it("matches entries by timestamp when no link ID", () => {
      const base: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "Base",
        }),
      ];

      const ours: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "Ours",
        }),
      ];

      const theirs: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "Theirs",
        }),
      ];

      const matches = matchEntries(base, ours, theirs);

      expect(matches).toHaveLength(1);
      expect(matches[0].identity.timestamp).toBe("2026-01-05T10:00Z");
      expect((matches[0].base as InstanceEntry)?.header.title.value).toBe("Base");
      expect((matches[0].ours as InstanceEntry)?.header.title.value).toBe("Ours");
      expect((matches[0].theirs as InstanceEntry)?.header.title.value).toBe("Theirs");
    });

    it("creates match for entry only in ours", () => {
      const base: Entry[] = [];
      const ours: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "Ours",
          linkId: "e1",
        }),
      ];
      const theirs: Entry[] = [];

      const matches = matchEntries(base, ours, theirs);

      expect(matches).toHaveLength(1);
      expect(matches[0].base).toBeNull();
      expect(matches[0].ours).not.toBeNull();
      expect(matches[0].theirs).toBeNull();
    });

    it("creates match for entry only in theirs", () => {
      const base: Entry[] = [];
      const ours: Entry[] = [];
      const theirs: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T11:00Z",
          directive: "create",
          entity: "lore",
          title: "Theirs",
          linkId: "e2",
        }),
      ];

      const matches = matchEntries(base, ours, theirs);

      expect(matches).toHaveLength(1);
      expect(matches[0].base).toBeNull();
      expect(matches[0].ours).toBeNull();
      expect(matches[0].theirs).not.toBeNull();
    });

    it("creates match for deleted entry (in base, missing in ours)", () => {
      const base: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "Base",
          linkId: "e1",
        }),
      ];
      const ours: Entry[] = [];
      const theirs: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "Theirs",
          linkId: "e1",
        }),
      ];

      const matches = matchEntries(base, ours, theirs);

      expect(matches).toHaveLength(1);
      expect(matches[0].base).not.toBeNull();
      expect(matches[0].ours).toBeNull();
      expect(matches[0].theirs).not.toBeNull();
    });

    it("handles multiple entries with different identities", () => {
      const base: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "Entry1",
          linkId: "e1",
        }),
      ];

      const ours: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "Entry1",
          linkId: "e1",
        }),
        mockInstanceEntry({
          timestamp: "2026-01-05T11:00Z",
          directive: "create",
          entity: "lore",
          title: "Entry2",
          linkId: "e2",
        }),
      ];

      const theirs: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "Entry1",
          linkId: "e1",
        }),
        mockInstanceEntry({
          timestamp: "2026-01-05T12:00Z",
          directive: "create",
          entity: "lore",
          title: "Entry3",
          linkId: "e3",
        }),
      ];

      const matches = matchEntries(base, ours, theirs);

      expect(matches).toHaveLength(3);
      expect(matches.find((m) => m.identity.linkId === "e1")).toBeDefined();
      expect(matches.find((m) => m.identity.linkId === "e2")).toBeDefined();
      expect(matches.find((m) => m.identity.linkId === "e3")).toBeDefined();
    });

    it("throws error for duplicate identity in ours version", () => {
      const base: Entry[] = [];
      const ours: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "First",
          linkId: "dup-id",
        }),
        mockInstanceEntry({
          timestamp: "2026-01-05T11:00Z",
          directive: "create",
          entity: "lore",
          title: "Second",
          linkId: "dup-id",
        }),
      ];
      const theirs: Entry[] = [];

      expect(() => matchEntries(base, ours, theirs)).toThrow(
        "Duplicate identity 'link:dup-id' found in ours version",
      );
    });

    it("throws error for duplicate identity in theirs version", () => {
      const base: Entry[] = [];
      const ours: Entry[] = [];
      const theirs: Entry[] = [
        mockInstanceEntry({
          timestamp: "2026-01-05T10:00Z",
          directive: "create",
          entity: "lore",
          title: "First",
          linkId: "dup-id",
        }),
        mockInstanceEntry({
          timestamp: "2026-01-05T11:00Z",
          directive: "create",
          entity: "lore",
          title: "Second",
          linkId: "dup-id",
        }),
      ];

      expect(() => matchEntries(base, ours, theirs)).toThrow(
        "Duplicate identity 'link:dup-id' found in theirs version",
      );
    });
  });
});
