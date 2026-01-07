import { describe, it, expect } from "vitest";
import { TypeExpr } from "./types.js";
import type {
  ModelPrimitiveType,
  ModelLiteralType,
  ModelArrayType,
  ModelUnionType,
} from "../model/types.js";

// Helper functions to create type expressions
function primitive(name: "string" | "datetime" | "date-range" | "link"): ModelPrimitiveType {
  return { kind: "primitive", name };
}

function literal(value: string): ModelLiteralType {
  return { kind: "literal", value };
}

function array(
  elementType: ModelPrimitiveType | ModelLiteralType | ModelUnionType,
): ModelArrayType {
  return { kind: "array", elementType };
}

function union(
  ...members: (ModelPrimitiveType | ModelLiteralType | ModelArrayType)[]
): ModelUnionType {
  return { kind: "union", members };
}

describe("TypeExpr.matches", () => {
  describe("primitive types", () => {
    it("matches string type with any value", () => {
      expect(TypeExpr.matches("hello world", primitive("string"))).toBe(true);
      expect(TypeExpr.matches("123", primitive("string"))).toBe(true);
      expect(TypeExpr.matches("", primitive("string"))).toBe(true);
    });

    it("matches link type with ^ prefix", () => {
      expect(TypeExpr.matches("^my-link", primitive("link"))).toBe(true);
      expect(TypeExpr.matches("^self", primitive("link"))).toBe(true);
      expect(TypeExpr.matches("my-link", primitive("link"))).toBe(false);
      expect(TypeExpr.matches("", primitive("link"))).toBe(false);
    });

    it("matches date type with valid formats", () => {
      // Datetime only accepts YYYY-MM-DD format (no partial dates)
      expect(TypeExpr.matches("2024-05-11", primitive("datetime"))).toBe(true);
      expect(TypeExpr.matches("2024", primitive("datetime"))).toBe(false);
      expect(TypeExpr.matches("2024-05", primitive("datetime"))).toBe(false);
      expect(TypeExpr.matches("not-a-date", primitive("datetime"))).toBe(false);
      expect(TypeExpr.matches("2024-5-11", primitive("datetime"))).toBe(false);
      expect(TypeExpr.matches("24-05-11", primitive("datetime"))).toBe(false);
    });

    it("matches date-range type with valid formats", () => {
      expect(TypeExpr.matches("2020 ~ 2024", primitive("date-range"))).toBe(true);
      expect(TypeExpr.matches("2020-01 ~ 2024-12", primitive("date-range"))).toBe(true);
      expect(TypeExpr.matches("2020-01-01 ~ 2024-12-31", primitive("date-range"))).toBe(true);
      expect(TypeExpr.matches("2020~2024", primitive("date-range"))).toBe(true);
      expect(TypeExpr.matches("2024", primitive("date-range"))).toBe(false);
      expect(TypeExpr.matches("2020 - 2024", primitive("date-range"))).toBe(false);
    });
  });

  describe("literal types", () => {
    it("matches quoted literal values", () => {
      expect(TypeExpr.matches('"high"', literal("high"))).toBe(true);
      expect(TypeExpr.matches('"medium"', literal("medium"))).toBe(true);
      expect(TypeExpr.matches('"low"', literal("low"))).toBe(true);
    });

    it("rejects unquoted literal values", () => {
      expect(TypeExpr.matches("high", literal("high"))).toBe(false);
      expect(TypeExpr.matches("medium", literal("medium"))).toBe(false);
    });

    it("rejects wrong literal values", () => {
      expect(TypeExpr.matches('"wrong"', literal("high"))).toBe(false);
      expect(TypeExpr.matches('"HIGH"', literal("high"))).toBe(false);
    });
  });

  describe("union types", () => {
    it("matches any member of the union", () => {
      const type = union(literal("high"), literal("medium"), literal("low"));
      expect(TypeExpr.matches('"high"', type)).toBe(true);
      expect(TypeExpr.matches('"medium"', type)).toBe(true);
      expect(TypeExpr.matches('"low"', type)).toBe(true);
      expect(TypeExpr.matches('"other"', type)).toBe(false);
    });

    it("matches mixed primitive and literal unions", () => {
      const type = union(primitive("string"), primitive("link"));
      expect(TypeExpr.matches("some text", type)).toBe(true);
      expect(TypeExpr.matches("^my-link", type)).toBe(true);
    });
  });

  describe("array types", () => {
    describe("link[]", () => {
      const type = array(primitive("link"));

      it("matches single link", () => {
        expect(TypeExpr.matches("^link1", type)).toBe(true);
      });

      it("matches multiple links", () => {
        expect(TypeExpr.matches("^link1, ^link2", type)).toBe(true);
        expect(TypeExpr.matches("^link1, ^link2, ^link3", type)).toBe(true);
      });

      it("rejects non-link values", () => {
        expect(TypeExpr.matches("not-a-link", type)).toBe(false);
        expect(TypeExpr.matches("^link1, not-a-link", type)).toBe(false);
      });

      it("rejects empty arrays", () => {
        expect(TypeExpr.matches("", type)).toBe(false);
      });
    });

    describe("string[]", () => {
      const type = array(primitive("string"));

      it("matches single quoted string", () => {
        expect(TypeExpr.matches('"hello"', type)).toBe(true);
      });

      it("matches multiple quoted strings", () => {
        expect(TypeExpr.matches('"hello", "world"', type)).toBe(true);
        expect(TypeExpr.matches('"a", "b", "c"', type)).toBe(true);
      });

      it("rejects unquoted strings", () => {
        expect(TypeExpr.matches("hello", type)).toBe(false);
        expect(TypeExpr.matches('"hello", world', type)).toBe(false);
      });

      it("rejects empty arrays", () => {
        expect(TypeExpr.matches("", type)).toBe(false);
      });
    });

    describe("datetime[]", () => {
      const type = array(primitive("datetime"));

      it("matches single datetime (YYYY-MM-DD)", () => {
        expect(TypeExpr.matches("2024-05-11", type)).toBe(true);
        // Partial dates are not valid for datetime
        expect(TypeExpr.matches("2024", type)).toBe(false);
        expect(TypeExpr.matches("2024-05", type)).toBe(false);
      });

      it("matches multiple datetimes", () => {
        expect(TypeExpr.matches("2024-01-01, 2024-06-15, 2024-12-31", type)).toBe(true);
      });

      it("rejects invalid datetimes", () => {
        expect(TypeExpr.matches("not-a-date", type)).toBe(false);
        expect(TypeExpr.matches("2024-05-11, not-a-date", type)).toBe(false);
      });

      it("rejects empty arrays", () => {
        expect(TypeExpr.matches("", type)).toBe(false);
      });
    });

    describe("date-range[]", () => {
      const type = array(primitive("date-range"));

      it("matches single date range", () => {
        expect(TypeExpr.matches("2020 ~ 2024", type)).toBe(true);
        expect(TypeExpr.matches("2020-01 ~ 2024-12", type)).toBe(true);
      });

      it("matches multiple date ranges", () => {
        expect(TypeExpr.matches("2020 ~ 2022, 2023 ~ 2024", type)).toBe(true);
        expect(TypeExpr.matches("2020-01 ~ 2021-06, 2022-01 ~ 2024-12", type)).toBe(true);
      });

      it("rejects single dates (not ranges)", () => {
        expect(TypeExpr.matches("2024", type)).toBe(false);
        expect(TypeExpr.matches("2020, 2024", type)).toBe(false);
      });

      it("rejects empty arrays", () => {
        expect(TypeExpr.matches("", type)).toBe(false);
      });
    });

    describe("(string | link)[]", () => {
      const type = array(union(primitive("string"), primitive("link")));

      it("matches quoted strings", () => {
        expect(TypeExpr.matches('"hello"', type)).toBe(true);
        expect(TypeExpr.matches('"Jane Doe"', type)).toBe(true);
      });

      it("matches links", () => {
        expect(TypeExpr.matches("^link1", type)).toBe(true);
      });

      it("matches mixed quoted strings and links", () => {
        expect(TypeExpr.matches('"Jane Doe", ^author-ref', type)).toBe(true);
        expect(TypeExpr.matches('^ref1, "text", ^ref2', type)).toBe(true);
      });

      it("rejects unquoted strings", () => {
        expect(TypeExpr.matches("Jane Doe", type)).toBe(false);
        expect(TypeExpr.matches('"Jane Doe", John Smith', type)).toBe(false);
      });

      it("rejects empty arrays", () => {
        expect(TypeExpr.matches("", type)).toBe(false);
      });
    });

    describe("literal array types", () => {
      const type = array(union(literal("foo"), literal("bar")));

      it("matches quoted literals", () => {
        expect(TypeExpr.matches('"foo"', type)).toBe(true);
        expect(TypeExpr.matches('"bar"', type)).toBe(true);
        expect(TypeExpr.matches('"foo", "bar"', type)).toBe(true);
      });

      it("rejects unquoted literals", () => {
        expect(TypeExpr.matches("foo", type)).toBe(false);
        expect(TypeExpr.matches("foo, bar", type)).toBe(false);
      });

      it("rejects invalid literals", () => {
        expect(TypeExpr.matches('"baz"', type)).toBe(false);
        expect(TypeExpr.matches('"foo", "baz"', type)).toBe(false);
      });
    });
  });
});

describe("TypeExpr.toString", () => {
  it("formats primitive types", () => {
    expect(TypeExpr.toString(primitive("string"))).toBe("string");
    expect(TypeExpr.toString(primitive("link"))).toBe("link");
    expect(TypeExpr.toString(primitive("datetime"))).toBe("datetime");
    expect(TypeExpr.toString(primitive("date-range"))).toBe("date-range");
  });

  it("formats literal types with quotes", () => {
    expect(TypeExpr.toString(literal("high"))).toBe('"high"');
    expect(TypeExpr.toString(literal("medium"))).toBe('"medium"');
  });

  it("formats union types with pipe separator", () => {
    expect(TypeExpr.toString(union(literal("high"), literal("low")))).toBe('"high" | "low"');
    expect(TypeExpr.toString(union(primitive("string"), primitive("link")))).toBe("string | link");
  });

  it("formats simple array types", () => {
    expect(TypeExpr.toString(array(primitive("link")))).toBe("link[]");
    expect(TypeExpr.toString(array(primitive("string")))).toBe("string[]");
    expect(TypeExpr.toString(array(primitive("datetime")))).toBe("datetime[]");
    expect(TypeExpr.toString(array(primitive("date-range")))).toBe("date-range[]");
  });

  it("formats union array types with parentheses", () => {
    expect(TypeExpr.toString(array(union(primitive("string"), primitive("link"))))).toBe(
      "(string | link)[]",
    );
    expect(TypeExpr.toString(array(union(literal("foo"), literal("bar"))))).toBe(
      '("foo" | "bar")[]',
    );
  });
});
