import { describe, it, expect, beforeEach } from "vitest";
import { Workspace, executeQuery } from "@rejot-dev/thalo";
import { parseQueryString } from "./query.js";

describe("query command", () => {
  describe("parseQueryString", () => {
    it("parses entity-only query", () => {
      const result = parseQueryString("lore");

      expect(result).toEqual({
        entity: "lore",
        conditions: [],
      });
    });

    it("parses entity with hyphen", () => {
      const result = parseQueryString("my-entity");

      expect(result).toEqual({
        entity: "my-entity",
        conditions: [],
      });
    });

    it("rejects invalid entity names", () => {
      expect(parseQueryString("123invalid")).toBeNull();
      expect(parseQueryString("has space")).toBeNull();
    });

    it("parses query with tag condition", () => {
      const result = parseQueryString("lore where #career");

      expect(result).toEqual({
        entity: "lore",
        conditions: [{ kind: "tag", tag: "career" }],
      });
    });

    it("parses query with link condition", () => {
      const result = parseQueryString("opinion where ^my-topic");

      expect(result).toEqual({
        entity: "opinion",
        conditions: [{ kind: "link", link: "my-topic" }],
      });
    });

    it("parses query with field condition", () => {
      const result = parseQueryString('lore where type = "fact"');

      expect(result).toEqual({
        entity: "lore",
        conditions: [{ kind: "field", field: "type", value: '"fact"' }],
      });
    });

    it("parses query with multiple conditions", () => {
      const result = parseQueryString('lore where #career and type = "insight"');

      expect(result).toEqual({
        entity: "lore",
        conditions: [
          { kind: "tag", tag: "career" },
          { kind: "field", field: "type", value: '"insight"' },
        ],
      });
    });

    it("parses query with all condition types", () => {
      const result = parseQueryString('lore where #tag and ^link and field = "value"');

      expect(result).toEqual({
        entity: "lore",
        conditions: [
          { kind: "tag", tag: "tag" },
          { kind: "link", link: "link" },
          { kind: "field", field: "field", value: '"value"' },
        ],
      });
    });

    it("preserves quotes in field values", () => {
      const result = parseQueryString('lore where type = "fact"');

      expect(result?.conditions[0]).toEqual({
        kind: "field",
        field: "type",
        value: '"fact"',
      });
    });

    it("handles link values in field conditions", () => {
      const result = parseQueryString("lore where subject = ^self");

      expect(result).toEqual({
        entity: "lore",
        conditions: [{ kind: "field", field: "subject", value: "^self" }],
      });
    });
  });

  describe("executeQuery integration", () => {
    let workspace: Workspace;

    beforeEach(() => {
      workspace = new Workspace();

      // Add schema
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: link
`,
        { filename: "schema.thalo" },
      );

      // Add test entries
      workspace.addDocument(
        `2026-01-05T10:00Z create lore "Career insight" ^career-insight #career #growth
  type: "insight"
  subject: ^self

  # Summary
  Career-related insight.

2026-01-05T11:00Z create lore "Tech fact" ^tech-fact #tech
  type: "fact"
  subject: ^technology

  # Summary
  Technical fact.

2026-01-05T12:00Z create lore "Personal growth" ^growth #career #personal
  type: "insight"
  subject: ^self

  # Summary
  Personal growth insight.
`,
        { filename: "entries.thalo" },
      );
    });

    it("queries all entries of an entity type", () => {
      const query = parseQueryString("lore")!;
      const results = executeQuery(workspace, query);

      expect(results).toHaveLength(3);
    });

    it("filters by tag", () => {
      const query = parseQueryString("lore where #career")!;
      const results = executeQuery(workspace, query);

      expect(results).toHaveLength(2);
      expect(results[0].header.title.value).toBe("Career insight");
      expect(results[1].header.title.value).toBe("Personal growth");
    });

    it("filters by link", () => {
      const query = parseQueryString("lore where ^career-insight")!;
      const results = executeQuery(workspace, query);

      expect(results).toHaveLength(1);
      expect(results[0].header.title.value).toBe("Career insight");
    });

    it("filters by field value", () => {
      const query = parseQueryString('lore where type = "fact"')!;
      const results = executeQuery(workspace, query);

      expect(results).toHaveLength(1);
      expect(results[0].header.title.value).toBe("Tech fact");
    });

    it("combines multiple conditions with AND", () => {
      const query = parseQueryString('lore where #career and type = "insight"')!;
      const results = executeQuery(workspace, query);

      expect(results).toHaveLength(2);
    });

    it("returns empty for no matches", () => {
      const query = parseQueryString("lore where #nonexistent")!;
      const results = executeQuery(workspace, query);

      expect(results).toHaveLength(0);
    });

    it("returns empty for wrong entity type", () => {
      const query = parseQueryString("opinion")!;
      const results = executeQuery(workspace, query);

      expect(results).toHaveLength(0);
    });

    it("results are sorted by timestamp", () => {
      const query = parseQueryString("lore")!;
      const results = executeQuery(workspace, query);

      expect(results[0].header.title.value).toBe("Career insight");
      expect(results[1].header.title.value).toBe("Tech fact");
      expect(results[2].header.title.value).toBe("Personal growth");
    });
  });
});
