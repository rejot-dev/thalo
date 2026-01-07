import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../model/workspace.js";
import { executeQuery, executeQueries, entryMatchesQuery, formatQuery } from "./query.js";
import type { Query } from "../model/types.js";

describe("query service", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();

    // Add schema
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  # Sections
  Summary
`,
      { filename: "schema.ptall" },
    );

    // Add entries
    workspace.addDocument(
      `2026-01-05T10:00 create lore "Entry 1" ^entry-1 #career #tech
  type: "fact"
  subject: "work"

  # Summary
  First entry.

2026-01-05T11:00 create lore "Entry 2" ^entry-2 #career
  type: "insight"
  subject: "work"

  # Summary
  Second entry.

2026-01-05T12:00 create lore "Entry 3" ^entry-3 #personal
  type: "fact"
  subject: "life"

  # Summary
  Third entry.
`,
      { filename: "entries.ptall" },
    );
  });

  describe("entryMatchesQuery", () => {
    it("matches by entity type", () => {
      const entry = workspace.allDocuments()[1].instanceEntries[0];
      const query: Query = { entity: "lore", conditions: [] };

      expect(entryMatchesQuery(entry, query)).toBe(true);
    });

    it("rejects wrong entity type", () => {
      const entry = workspace.allDocuments()[1].instanceEntries[0];
      const query: Query = { entity: "opinion", conditions: [] };

      expect(entryMatchesQuery(entry, query)).toBe(false);
    });

    it("matches by tag condition", () => {
      const entry = workspace.allDocuments()[1].instanceEntries[0];
      const query: Query = {
        entity: "lore",
        conditions: [{ kind: "tag", tag: "career" }],
      };

      expect(entryMatchesQuery(entry, query)).toBe(true);
    });

    it("rejects missing tag", () => {
      const entry = workspace.allDocuments()[1].instanceEntries[0];
      const query: Query = {
        entity: "lore",
        conditions: [{ kind: "tag", tag: "personal" }],
      };

      expect(entryMatchesQuery(entry, query)).toBe(false);
    });

    it("matches by field condition", () => {
      const entry = workspace.allDocuments()[1].instanceEntries[0];
      const query: Query = {
        entity: "lore",
        conditions: [{ kind: "field", field: "type", value: '"fact"' }],
      };

      expect(entryMatchesQuery(entry, query)).toBe(true);
    });

    it("rejects wrong field value", () => {
      const entry = workspace.allDocuments()[1].instanceEntries[0];
      const query: Query = {
        entity: "lore",
        conditions: [{ kind: "field", field: "type", value: '"insight"' }],
      };

      expect(entryMatchesQuery(entry, query)).toBe(false);
    });

    it("matches by link condition on linkId", () => {
      const entry = workspace.allDocuments()[1].instanceEntries[0];
      const query: Query = {
        entity: "lore",
        conditions: [{ kind: "link", link: "entry-1" }],
      };

      expect(entryMatchesQuery(entry, query)).toBe(true);
    });

    it("matches multiple conditions (AND)", () => {
      const entry = workspace.allDocuments()[1].instanceEntries[0];
      const query: Query = {
        entity: "lore",
        conditions: [
          { kind: "tag", tag: "career" },
          { kind: "field", field: "type", value: '"fact"' },
        ],
      };

      expect(entryMatchesQuery(entry, query)).toBe(true);
    });

    it("rejects if any condition fails", () => {
      const entry = workspace.allDocuments()[1].instanceEntries[0];
      const query: Query = {
        entity: "lore",
        conditions: [
          { kind: "tag", tag: "career" },
          { kind: "field", field: "type", value: '"insight"' }, // Wrong
        ],
      };

      expect(entryMatchesQuery(entry, query)).toBe(false);
    });
  });

  describe("executeQuery", () => {
    it("returns all matching entries", () => {
      const query: Query = {
        entity: "lore",
        conditions: [{ kind: "tag", tag: "career" }],
      };

      const results = executeQuery(workspace, query);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Entry 1");
      expect(results[1].title).toBe("Entry 2");
    });

    it("returns entries sorted by timestamp", () => {
      const query: Query = { entity: "lore", conditions: [] };

      const results = executeQuery(workspace, query);

      expect(results).toHaveLength(3);
      expect(results[0].timestamp).toBe("2026-01-05T10:00");
      expect(results[1].timestamp).toBe("2026-01-05T11:00");
      expect(results[2].timestamp).toBe("2026-01-05T12:00");
    });

    it("filters by afterTimestamp", () => {
      const query: Query = { entity: "lore", conditions: [] };

      const results = executeQuery(workspace, query, {
        afterTimestamp: "2026-01-05T10:00",
      });

      expect(results).toHaveLength(2);
      expect(results[0].timestamp).toBe("2026-01-05T11:00");
      expect(results[1].timestamp).toBe("2026-01-05T12:00");
    });
  });

  describe("executeQueries", () => {
    it("returns entries matching any query (OR)", () => {
      const queries: Query[] = [
        { entity: "lore", conditions: [{ kind: "tag", tag: "tech" }] },
        { entity: "lore", conditions: [{ kind: "tag", tag: "personal" }] },
      ];

      const results = executeQueries(workspace, queries);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Entry 1"); // has #tech
      expect(results[1].title).toBe("Entry 3"); // has #personal
    });

    it("deduplicates entries matching multiple queries", () => {
      const queries: Query[] = [
        { entity: "lore", conditions: [{ kind: "tag", tag: "career" }] },
        { entity: "lore", conditions: [{ kind: "tag", tag: "tech" }] },
      ];

      const results = executeQueries(workspace, queries);

      // Entry 1 matches both queries but should only appear once
      expect(results).toHaveLength(2);
    });
  });

  describe("formatQuery", () => {
    it("formats entity-only query", () => {
      const query: Query = { entity: "lore", conditions: [] };

      expect(formatQuery(query)).toBe("lore");
    });

    it("formats query with field condition", () => {
      const query: Query = {
        entity: "lore",
        conditions: [{ kind: "field", field: "type", value: '"fact"' }],
      };

      expect(formatQuery(query)).toBe('lore where type = "fact"');
    });

    it("formats query with tag condition", () => {
      const query: Query = {
        entity: "lore",
        conditions: [{ kind: "tag", tag: "career" }],
      };

      expect(formatQuery(query)).toBe("lore where #career");
    });

    it("formats query with link condition", () => {
      const query: Query = {
        entity: "lore",
        conditions: [{ kind: "link", link: "my-link" }],
      };

      expect(formatQuery(query)).toBe("lore where ^my-link");
    });

    it("formats query with multiple conditions", () => {
      const query: Query = {
        entity: "lore",
        conditions: [
          { kind: "field", field: "type", value: '"fact"' },
          { kind: "tag", tag: "career" },
        ],
      };

      expect(formatQuery(query)).toBe('lore where type = "fact" and #career');
    });
  });
});
