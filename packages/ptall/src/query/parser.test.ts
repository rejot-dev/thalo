import { describe, expect, it } from "vitest";
import { parseSourcesValue, parseQuery } from "./parser.js";

describe("parseQuery", () => {
  describe("field conditions", () => {
    it("parses simple field condition", () => {
      const result = parseQuery("lore where subject = ^self");
      expect(result).toEqual({
        entity: "lore",
        conditions: [{ kind: "field", field: "subject", value: "^self" }],
      });
    });

    it("parses field with string value", () => {
      const result = parseQuery('opinion where confidence = "high"');
      expect(result).toEqual({
        entity: "opinion",
        conditions: [{ kind: "field", field: "confidence", value: '"high"' }],
      });
    });

    it("parses field with hyphenated name", () => {
      const result = parseQuery("reference where ref-type = article");
      expect(result).toEqual({
        entity: "reference",
        conditions: [{ kind: "field", field: "ref-type", value: "article" }],
      });
    });

    it("handles spaces around equals sign", () => {
      const result = parseQuery("lore where type=fact");
      expect(result).toEqual({
        entity: "lore",
        conditions: [{ kind: "field", field: "type", value: "fact" }],
      });
    });
  });

  describe("tag conditions", () => {
    it("parses tag condition", () => {
      const result = parseQuery("lore where #career");
      expect(result).toEqual({
        entity: "lore",
        conditions: [{ kind: "tag", tag: "career" }],
      });
    });

    it("parses tag with hyphen", () => {
      const result = parseQuery("lore where #my-tag");
      expect(result).toEqual({
        entity: "lore",
        conditions: [{ kind: "tag", tag: "my-tag" }],
      });
    });

    it("parses multiple tags", () => {
      const result = parseQuery("lore where #career and #education");
      expect(result).toEqual({
        entity: "lore",
        conditions: [
          { kind: "tag", tag: "career" },
          { kind: "tag", tag: "education" },
        ],
      });
    });
  });

  describe("link conditions", () => {
    it("parses link condition", () => {
      const result = parseQuery("lore where ^self");
      expect(result).toEqual({
        entity: "lore",
        conditions: [{ kind: "link", link: "self" }],
      });
    });

    it("parses link with path", () => {
      const result = parseQuery("lore where ^my/path/link");
      expect(result).toEqual({
        entity: "lore",
        conditions: [{ kind: "link", link: "my/path/link" }],
      });
    });
  });

  describe("combined conditions", () => {
    it("parses multiple conditions with and", () => {
      const result = parseQuery("lore where subject = ^self and #career");
      expect(result).toEqual({
        entity: "lore",
        conditions: [
          { kind: "field", field: "subject", value: "^self" },
          { kind: "tag", tag: "career" },
        ],
      });
    });

    it("parses three conditions", () => {
      const result = parseQuery("lore where subject = ^self and #career and #important");
      expect(result).toEqual({
        entity: "lore",
        conditions: [
          { kind: "field", field: "subject", value: "^self" },
          { kind: "tag", tag: "career" },
          { kind: "tag", tag: "important" },
        ],
      });
    });

    it("parses field, tag, and link together", () => {
      const result = parseQuery("lore where type = fact and #career and ^self");
      expect(result).toEqual({
        entity: "lore",
        conditions: [
          { kind: "field", field: "type", value: "fact" },
          { kind: "tag", tag: "career" },
          { kind: "link", link: "self" },
        ],
      });
    });
  });

  describe("entity only", () => {
    it("parses entity without conditions", () => {
      const result = parseQuery("lore");
      expect(result).toEqual({
        entity: "lore",
        conditions: [],
      });
    });

    it("parses different entity types", () => {
      expect(parseQuery("journal")?.entity).toBe("journal");
      expect(parseQuery("opinion")?.entity).toBe("opinion");
      expect(parseQuery("reference")?.entity).toBe("reference");
    });
  });

  describe("case sensitivity", () => {
    it("is case insensitive for where and and", () => {
      const result = parseQuery("lore WHERE subject = ^self AND #career");
      expect(result).toEqual({
        entity: "lore",
        conditions: [
          { kind: "field", field: "subject", value: "^self" },
          { kind: "tag", tag: "career" },
        ],
      });
    });

    it("preserves case for entity names", () => {
      const result = parseQuery("Lore where #tag");
      expect(result?.entity).toBe("Lore");
    });
  });

  describe("edge cases", () => {
    it("returns null for empty string", () => {
      const result = parseQuery("");
      expect(result).toBeNull();
    });

    it("returns null for invalid query", () => {
      const result = parseQuery("not a valid query format!!!");
      expect(result).toBeNull();
    });

    it("handles whitespace-only string", () => {
      const result = parseQuery("   ");
      expect(result).toBeNull();
    });
  });
});

describe("parseSourcesValue", () => {
  describe("single query", () => {
    it("parses single query", () => {
      const result = parseSourcesValue("lore where subject = ^self");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        entity: "lore",
        conditions: [{ kind: "field", field: "subject", value: "^self" }],
      });
    });

    it("parses single entity without where", () => {
      const result = parseSourcesValue("lore");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        entity: "lore",
        conditions: [],
      });
    });
  });

  describe("multiple queries", () => {
    it("parses multiple queries separated by comma", () => {
      const result = parseSourcesValue("lore where subject = ^self, journal where subject = ^self");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        entity: "lore",
        conditions: [{ kind: "field", field: "subject", value: "^self" }],
      });
      expect(result[1]).toEqual({
        entity: "journal",
        conditions: [{ kind: "field", field: "subject", value: "^self" }],
      });
    });

    it("handles whitespace around commas", () => {
      const result = parseSourcesValue("lore where #a ,  journal where #b");
      expect(result).toHaveLength(2);
      expect(result[0]?.entity).toBe("lore");
      expect(result[1]?.entity).toBe("journal");
    });

    it("handles complex query with multiple conditions", () => {
      const result = parseSourcesValue(
        "lore where subject = ^self and #career, lore where subject = ^self and #education",
      );
      expect(result).toHaveLength(2);
      expect(result[0]?.conditions).toHaveLength(2);
      expect(result[1]?.conditions).toHaveLength(2);
    });

    it("parses three queries", () => {
      const result = parseSourcesValue("lore, journal, opinion");
      expect(result).toHaveLength(3);
      expect(result.map((q) => q.entity)).toEqual(["lore", "journal", "opinion"]);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty string", () => {
      const result = parseSourcesValue("");
      expect(result).toEqual([]);
    });

    it("handles trailing comma", () => {
      const result = parseSourcesValue("lore where #a,");
      expect(result).toHaveLength(1);
    });

    it("handles leading comma", () => {
      const result = parseSourcesValue(",lore where #a");
      expect(result).toHaveLength(1);
    });

    it("skips empty queries between commas", () => {
      const result = parseSourcesValue("lore,,journal");
      expect(result).toHaveLength(2);
    });
  });
});
