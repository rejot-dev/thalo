import { describe, it, expect, beforeEach } from "vitest";
import { createWorkspace } from "../parser.native.js";
import type { Workspace } from "../model/workspace.js";
import { parseQueryString, runQuery, runQueries, isQueryValidationError } from "./query.js";

/**
 * Helper to create a workspace from a file structure.
 */
function workspaceFromFiles(files: Record<string, string>): Workspace {
  const ws = createWorkspace();
  for (const [filename, content] of Object.entries(files)) {
    ws.addDocument(content, { filename });
  }
  return ws;
}

describe("query command", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = workspaceFromFiles({
      "schema.thalo": `
2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight" | "opinion"
  subject: string
  related?: link

  # Sections
  Summary
  Details
`,
      "entries.thalo": `
2026-01-05T10:00Z create lore "First entry" ^first-entry #career #tech
  type: "fact"
  subject: "work"

  # Summary
  This is the first entry.

2026-01-05T11:00Z create lore "Second entry" ^second-entry #career
  type: "insight"
  subject: "work"
  related: ^first-entry

  # Summary
  This is the second entry.

2026-01-05T12:00Z create lore "Third entry" ^third-entry #personal
  type: "opinion"
  subject: "life"

  # Summary
  This is the third entry.
`,
      "more-entries.thalo": `
2026-01-06T10:00Z create lore "Fourth entry" ^fourth-entry #tech
  type: "fact"
  subject: "programming"

  # Summary
  This is about programming.
`,
    });
  });

  describe("parseQueryString", () => {
    it("parses entity-only query", () => {
      const queries = parseQueryString("lore");

      expect(queries).toEqual([
        {
          entity: "lore",
          conditions: [],
        },
      ]);
    });

    it("parses query with tag condition", () => {
      const queries = parseQueryString("lore where #career");

      expect(queries).toEqual([
        {
          entity: "lore",
          conditions: [{ kind: "tag", tag: "career" }],
        },
      ]);
    });

    it("parses query with field condition", () => {
      const queries = parseQueryString('lore where type = "fact"');

      expect(queries).toEqual([
        {
          entity: "lore",
          conditions: [{ kind: "field", field: "type", value: '"fact"' }],
        },
      ]);
    });

    it("parses query with link condition", () => {
      const queries = parseQueryString("lore where ^first-entry");

      expect(queries).toEqual([
        {
          entity: "lore",
          conditions: [{ kind: "link", link: "first-entry" }],
        },
      ]);
    });

    it("parses query with multiple conditions", () => {
      const queries = parseQueryString('lore where #career and type = "fact"');

      expect(queries).toEqual([
        {
          entity: "lore",
          conditions: [
            { kind: "tag", tag: "career" },
            { kind: "field", field: "type", value: '"fact"' },
          ],
        },
      ]);
    });

    it("parses query with multiple condition types", () => {
      const queries = parseQueryString('lore where #tech and ^first-entry and subject = "work"');

      expect(queries).toEqual([
        {
          entity: "lore",
          conditions: [
            { kind: "tag", tag: "tech" },
            { kind: "link", link: "first-entry" },
            { kind: "field", field: "subject", value: '"work"' },
          ],
        },
      ]);
    });

    it("returns null for invalid query", () => {
      const queries = parseQueryString("invalid syntax here");

      expect(queries).toBeNull();
    });

    it("returns null for empty string", () => {
      const queries = parseQueryString("");

      expect(queries).toBeNull();
    });

    it("handles entity names with hyphens", () => {
      const queries = parseQueryString("my-entity");

      expect(queries).toEqual([
        {
          entity: "my-entity",
          conditions: [],
        },
      ]);
    });

    it("parses comma-separated multiple queries", () => {
      const queries = parseQueryString("lore, journal");

      expect(queries).toEqual([
        { entity: "lore", conditions: [] },
        { entity: "journal", conditions: [] },
      ]);
    });

    it("parses multiple queries with conditions", () => {
      const queries = parseQueryString("lore where #career, journal where #work");

      expect(queries).toEqual([
        { entity: "lore", conditions: [{ kind: "tag", tag: "career" }] },
        { entity: "journal", conditions: [{ kind: "tag", tag: "work" }] },
      ]);
    });

    it("returns null if any query in comma-separated list is invalid", () => {
      const queries = parseQueryString("lore, invalid syntax here");

      expect(queries).toBeNull();
    });
  });

  describe("runQuery", () => {
    it("returns all entries for entity-only query", () => {
      const result = runQuery(workspace, "lore");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.entries).toHaveLength(4);
        expect(result.totalCount).toBe(4);
        expect(result.queryString).toBe("lore");
      }
    });

    it("filters by tag", () => {
      const result = runQuery(workspace, "lore where #career");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.entries).toHaveLength(2);
        expect(result.entries[0].title).toBe("First entry");
        expect(result.entries[1].title).toBe("Second entry");
        expect(result.totalCount).toBe(2);
      }
    });

    it("filters by field value", () => {
      const result = runQuery(workspace, 'lore where type = "fact"');

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.entries).toHaveLength(2);
        expect(result.entries[0].title).toBe("First entry");
        expect(result.entries[1].title).toBe("Fourth entry");
        expect(result.totalCount).toBe(2);
      }
    });

    it("filters by link id (matches both header link and metadata links)", () => {
      const result = runQuery(workspace, "lore where ^first-entry");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        // Matches both the entry with ^first-entry in header AND entries that reference it
        expect(result.entries).toHaveLength(2);
        expect(result.entries[0].title).toBe("First entry");
        expect(result.entries[0].linkId).toBe("first-entry");
        expect(result.entries[1].title).toBe("Second entry"); // Has related: ^first-entry
      }
    });

    it("filters by multiple conditions", () => {
      const result = runQuery(workspace, 'lore where #career and type = "fact"');

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].title).toBe("First entry");
      }
    });

    it("returns empty results when no matches", () => {
      const result = runQuery(workspace, "lore where #nonexistent");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.entries).toHaveLength(0);
        expect(result.totalCount).toBe(0);
      }
    });

    it("returns null for invalid query string", () => {
      const result = runQuery(workspace, "invalid query!!!");

      expect(result).toBeNull();
    });

    it("limits results when limit option is provided", () => {
      const result = runQuery(workspace, "lore", { limit: 2 });

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.entries).toHaveLength(2);
        expect(result.totalCount).toBe(4); // Total count is still 4
      }
    });

    it("ignores limit when it's 0", () => {
      const result = runQuery(workspace, "lore", { limit: 0 });

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.entries).toHaveLength(4);
      }
    });

    it("includes entry metadata in results", () => {
      const result = runQuery(workspace, "lore where #tech");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        const entry = result.entries[0];
        expect(entry.entity).toBe("lore");
        expect(entry.title).toBe("First entry");
        expect(entry.linkId).toBe("first-entry");
        expect(entry.tags).toEqual(["career", "tech"]);
        expect(entry.timestamp).toBe("2026-01-05T10:00Z");
        expect(entry.file).toBe("entries.thalo");
        expect(entry.startLine).toBe(2);
        expect(entry.endLine).toBe(7);
      }
    });

    it("does not include raw text by default", () => {
      const result = runQuery(workspace, "lore where ^first-entry");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.entries[0].rawText).toBeUndefined();
      }
    });

    it("includes raw text when includeRawText option is true", () => {
      const result = runQuery(workspace, "lore where ^first-entry", {
        includeRawText: true,
      });

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.entries[0].rawText).toBeDefined();
        expect(result.entries[0].rawText).toContain("First entry");
        expect(result.entries[0].rawText).toContain("This is the first entry");
      }
    });

    it("handles entries with no tags", () => {
      // Add an entry without tags
      workspace.addDocument(
        `
2026-01-07T10:00Z create lore "No tags entry"
  type: "fact"
  subject: "test"

  # Summary
  No tags here.
`,
        { filename: "test.thalo" },
      );

      const result = runQuery(workspace, "lore");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        const noTagsEntry = result.entries.find((e) => e.title === "No tags entry");
        expect(noTagsEntry).toBeDefined();
        expect(noTagsEntry!.tags).toEqual([]);
      }
    });

    it("handles entries with no link id", () => {
      const result = runQuery(workspace, "lore");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        const entries = result.entries;
        expect(entries.every((e) => e.linkId !== null)).toBe(true); // All our test entries have links
      }
    });

    it("returns entries sorted by timestamp", () => {
      const result = runQuery(workspace, "lore");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        const timestamps = result.entries.map((e) => e.timestamp);
        expect(timestamps).toEqual([
          "2026-01-05T10:00Z",
          "2026-01-05T11:00Z",
          "2026-01-05T12:00Z",
          "2026-01-06T10:00Z",
        ]);
      }
    });

    it("includes query object in result", () => {
      const result = runQuery(workspace, 'lore where #tech and type = "fact"');

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.query).toEqual({
          entity: "lore",
          conditions: [
            { kind: "tag", tag: "tech" },
            { kind: "field", field: "type", value: '"fact"' },
          ],
        });
      }
    });

    it("includes formatted query string in result", () => {
      const result = runQuery(workspace, 'lore where #tech and type = "fact"');

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.queryString).toBe('lore where #tech and type = "fact"');
      }
    });

    it("returns validation error for unknown entity", () => {
      const result = runQuery(workspace, "journal");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(true);
      if (isQueryValidationError(result)) {
        expect(result.entities).toEqual(["journal"]);
        expect(result.message).toContain("Unknown entity type");
        expect(result.message).toContain("journal");
      }
    });

    it("returns validation error for multiple unknown entities", () => {
      const result = runQuery(workspace, "journal, opinion");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(true);
      if (isQueryValidationError(result)) {
        expect(result.entities).toEqual(["journal", "opinion"]);
        expect(result.message).toContain("Unknown entity types");
      }
    });

    it("can disable entity validation", () => {
      const result = runQuery(workspace, "journal", { validateEntities: false });

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.entries).toHaveLength(0); // No matches, but no error
      }
    });
  });

  describe("runQueries", () => {
    it("executes multiple comma-separated queries", () => {
      // Add another entity type
      workspace.addDocument(
        `
2026-01-01T00:01Z define-entity journal "Journal entries"
  # Metadata
  mood: string

  # Sections
  Entry
`,
        { filename: "journal-schema.thalo" },
      );
      workspace.addDocument(
        `
2026-01-07T10:00Z create journal "My Journal" ^my-journal #personal
  mood: "happy"

  # Entry
  Today was a good day.
`,
        { filename: "journal.thalo" },
      );

      const result = runQueries(workspace, "lore, journal");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        expect(result.queries).toHaveLength(2);
        expect(result.entries.length).toBeGreaterThan(4); // 4 lore + 1 journal
        expect(result.queryString).toBe("lore, journal");
      }
    });

    it("deduplicates entries matching multiple queries", () => {
      const result = runQueries(workspace, "lore where #career, lore where #tech");

      expect(result).not.toBeNull();
      expect(isQueryValidationError(result)).toBe(false);
      if (!isQueryValidationError(result) && result) {
        // First entry has both #career and #tech, should only appear once
        const firstEntryCount = result.entries.filter((e) => e.title === "First entry").length;
        expect(firstEntryCount).toBe(1);
      }
    });
  });
});
