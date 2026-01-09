import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../model/workspace.js";
import {
  buildWorkspaceIndex,
  getInstancesForEntity,
  getDefineEntriesForEntity,
  getAlterEntriesForEntity,
  getEntriesReferencingLink,
} from "./workspace-index.js";

describe("WorkspaceIndex", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  describe("buildWorkspaceIndex", () => {
    it("should build an empty index from an empty workspace", () => {
      const index = buildWorkspaceIndex(workspace);

      expect(index.instanceEntries).toHaveLength(0);
      expect(index.schemaEntries).toHaveLength(0);
      expect(index.synthesisEntries).toHaveLength(0);
      expect(index.actualizeEntries).toHaveLength(0);
    });

    it("should index instance entries by type", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entity"
  # Metadata
  type: "fact"
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z create lore "First entry" ^first
  type: "fact"

2026-01-06T10:00Z create lore "Second entry" ^second
  type: "fact"
`,
        { filename: "entries.thalo" },
      );

      const index = buildWorkspaceIndex(workspace);

      expect(index.instanceEntries).toHaveLength(2);
      expect(index.schemaEntries).toHaveLength(1);
    });

    it("should group instance entries by entity", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entity"
  # Metadata
  type: "fact"

2026-01-01T00:01Z define-entity journal "Journal entity"
  # Metadata
  mood: "happy" | "sad"
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Lore entry"
  type: "fact"

2026-01-05T18:01Z create journal "Journal entry"
  mood: "happy"

2026-01-05T18:02Z create lore "Another lore"
  type: "fact"
`,
        { filename: "entries.thalo" },
      );

      const index = buildWorkspaceIndex(workspace);

      const loreInstances = getInstancesForEntity(index, "lore");
      const journalInstances = getInstancesForEntity(index, "journal");

      expect(loreInstances).toHaveLength(2);
      expect(journalInstances).toHaveLength(1);
    });

    it("should group schema entries by directive", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entity"
  # Metadata
  type: "fact"

2026-01-02T00:00Z alter-entity lore "Add tags field"
  # Metadata
  tags: string[]

2026-01-03T00:00Z alter-entity lore "Add priority field"
  # Metadata
  priority: "low" | "medium" | "high"
`,
        { filename: "entities.thalo" },
      );

      const index = buildWorkspaceIndex(workspace);

      const defineEntries = getDefineEntriesForEntity(index, "lore");
      const alterEntries = getAlterEntriesForEntity(index, "lore");

      expect(defineEntries).toHaveLength(1);
      expect(alterEntries).toHaveLength(2);
    });

    it("should index entries by link ID", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entity"
  # Metadata
  type: "fact"
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Entry with link" ^my-link
  type: "fact"
`,
        { filename: "entries.thalo" },
      );

      const index = buildWorkspaceIndex(workspace);

      const entryByLink = index.instancesByLinkId.get("my-link");
      expect(entryByLink).toBeDefined();
      expect(entryByLink?.entry.header.link?.id).toBe("my-link");
    });

    it("should track entries that reference links", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entity"
  # Metadata
  type: "fact"
  related?: link
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z create lore "First entry" ^first
  type: "fact"

2026-01-06T10:00Z create lore "References first" ^second
  type: "fact"
  related: ^first
`,
        { filename: "entries.thalo" },
      );

      const index = buildWorkspaceIndex(workspace);

      const referencingEntries = getEntriesReferencingLink(index, "first");
      expect(referencingEntries).toHaveLength(1);
      expect(referencingEntries[0].entry.type).toBe("instance_entry");
    });

    it("should track actualize entries referencing synthesis targets", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entity"
  # Metadata
  type: "fact"
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z define-synthesis ^bio "Personal Bio"
  sources: lore where type = "fact"

# Prompt
Summarize the lore entries.
`,
        { filename: "syntheses.thalo" },
      );

      workspace.addDocument(
        `2026-01-10T12:00Z actualize-synthesis ^bio "Updated bio"
  updated: 2026-01-10T12:00Z
`,
        { filename: "actualizations.thalo" },
      );

      const index = buildWorkspaceIndex(workspace);

      expect(index.synthesisEntries).toHaveLength(1);
      expect(index.actualizeEntries).toHaveLength(1);

      const referencingBio = getEntriesReferencingLink(index, "bio");
      expect(referencingBio).toHaveLength(1);
      expect(referencingBio[0].entry.type).toBe("actualize_entry");
    });
  });

  describe("helper functions", () => {
    it("getInstancesForEntity returns empty array for unknown entity", () => {
      const index = buildWorkspaceIndex(workspace);
      expect(getInstancesForEntity(index, "unknown")).toEqual([]);
    });

    it("getDefineEntriesForEntity returns empty array for unknown entity", () => {
      const index = buildWorkspaceIndex(workspace);
      expect(getDefineEntriesForEntity(index, "unknown")).toEqual([]);
    });

    it("getAlterEntriesForEntity returns empty array for unknown entity", () => {
      const index = buildWorkspaceIndex(workspace);
      expect(getAlterEntriesForEntity(index, "unknown")).toEqual([]);
    });

    it("getEntriesReferencingLink returns empty array for unknown link", () => {
      const index = buildWorkspaceIndex(workspace);
      expect(getEntriesReferencingLink(index, "unknown")).toEqual([]);
    });
  });
});
