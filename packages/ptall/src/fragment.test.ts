import { describe, it, expect } from "vitest";
import { parseFragment, parseQuery } from "./fragment.js";

describe("parseFragment", () => {
  describe("query", () => {
    it("parses a simple query", () => {
      const result = parseFragment("query", 'lore where type = "fact"');

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("query");
      expect(result.node.childForFieldName("entity")?.text).toBe("lore");
    });

    it("parses a query with multiple conditions", () => {
      const result = parseFragment("query", 'lore where type = "fact" and #education');

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("query");

      const conditions = result.node.childForFieldName("conditions");
      expect(conditions).toBeDefined();
      // Should have 2 conditions: field_condition and tag_condition
      const queryConditions = conditions?.namedChildren.filter((c) => c.type === "query_condition");
      expect(queryConditions).toHaveLength(2);
    });

    it("parses a query with link condition", () => {
      const result = parseFragment("query", "opinion where ^my-opinion");

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("query");
    });

    it("parses a query with tag condition only", () => {
      const result = parseFragment("query", "journal where #reflection");

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("query");
    });

    it("reports error for invalid query syntax", () => {
      const result = parseFragment("query", "not a valid query");

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("value", () => {
    it("parses a quoted string value", () => {
      const result = parseFragment("value", '"hello world"');

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("value");
      expect(result.node.namedChildren[0]?.type).toBe("quoted_value");
    });

    it("parses a link value", () => {
      const result = parseFragment("value", "^my-link");

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("value");
      expect(result.node.namedChildren[0]?.type).toBe("link");
    });

    it("parses a datetime value", () => {
      const result = parseFragment("value", "2024-05-11");

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("value");
      expect(result.node.namedChildren[0]?.type).toBe("datetime_value");
    });

    it("parses a date range value", () => {
      const result = parseFragment("value", "2022-05 ~ 2024");

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("value");
      expect(result.node.namedChildren[0]?.type).toBe("date_range");
    });

    it("parses an array value", () => {
      const result = parseFragment("value", "^ref1, ^ref2, ^ref3");

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("value");
      expect(result.node.namedChildren[0]?.type).toBe("value_array");
    });

    it("parses a query as value", () => {
      const result = parseFragment("value", 'lore where type = "fact"');

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("value");
      expect(result.node.namedChildren[0]?.type).toBe("query");
    });
  });

  describe("type_expression", () => {
    it("parses a primitive type", () => {
      const result = parseFragment("type_expression", "string");

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("type_expression");
      expect(result.node.namedChildren[0]?.type).toBe("primitive_type");
    });

    it("parses a literal type", () => {
      const result = parseFragment("type_expression", '"fact"');

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("type_expression");
      expect(result.node.namedChildren[0]?.type).toBe("literal_type");
    });

    it("parses a union type", () => {
      const result = parseFragment("type_expression", '"fact" | "insight"');

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("type_expression");
      expect(result.node.namedChildren[0]?.type).toBe("union_type");
    });

    it("parses an array type", () => {
      const result = parseFragment("type_expression", "string[]");

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("type_expression");
      expect(result.node.namedChildren[0]?.type).toBe("array_type");
    });

    it("parses a union with array", () => {
      const result = parseFragment("type_expression", "string | link[]");

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("type_expression");
      expect(result.node.namedChildren[0]?.type).toBe("union_type");
    });

    it("parses a parenthesized union array", () => {
      const result = parseFragment("type_expression", "(string | link)[]");

      expect(result.valid).toBe(true);
      expect(result.node.type).toBe("type_expression");
      expect(result.node.namedChildren[0]?.type).toBe("array_type");
    });
  });
});

describe("parseQuery", () => {
  it("is a convenience wrapper for parseFragment query", () => {
    const result = parseQuery('lore where type = "fact"');

    expect(result.valid).toBe(true);
    expect(result.node.type).toBe("query");
  });

  it("extracts entity and conditions", () => {
    const result = parseQuery('reference where ref-type = "article" and #typescript');

    expect(result.valid).toBe(true);

    const entity = result.node.childForFieldName("entity");
    expect(entity?.text).toBe("reference");

    const conditions = result.node.childForFieldName("conditions");
    expect(conditions).toBeDefined();
  });
});
