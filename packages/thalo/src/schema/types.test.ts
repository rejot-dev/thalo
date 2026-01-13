import { describe, it, expect } from "vitest";
import { TypeExpr } from "./types.js";
import type {
  ModelPrimitiveType,
  ModelLiteralType,
  ModelArrayType,
  ModelUnionType,
  ModelDefaultValue,
} from "../model/types.js";
import type {
  ValueContent,
  QuotedValue,
  DatetimeValue,
  DaterangeValue,
  Link,
  ValueArray,
} from "../ast/types.js";

// Helper functions to create type expressions
function primitive(
  name: "string" | "datetime" | "daterange" | "link" | "number",
): ModelPrimitiveType {
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

// Helper functions to create ValueContent for testing
// We use minimal mock objects since we only need the type and value properties for matching
function quotedValue(value: string): QuotedValue {
  return {
    type: "quoted_value",
    value,
  } as QuotedValue;
}

function linkValue(id: string): ValueContent {
  return {
    type: "link_value",
    link: { type: "link", id } as Link,
  } as ValueContent;
}

function datetimeValue(value: string): DatetimeValue {
  // Parse value to extract components
  const hasTime = value.includes("T");
  const date = hasTime ? value.split("T")[0] : value;
  const timePart = hasTime ? value.split("T")[1] : null;
  const time = timePart ? timePart.replace(/Z|[+-]\d{2}:\d{2}$/, "") : null;
  const tz = timePart ? (timePart.match(/Z|[+-]\d{2}:\d{2}$/)?.[0] ?? null) : null;
  return {
    type: "datetime_value",
    value,
    date,
    time,
    tz,
  } as DatetimeValue;
}

function dateRangeValue(raw: string): DaterangeValue {
  return {
    type: "daterange",
    raw,
  } as DaterangeValue;
}

function valueArray(elements: (Link | QuotedValue | DatetimeValue | DaterangeValue)[]): ValueArray {
  return {
    type: "value_array",
    elements,
  } as ValueArray;
}

function link(id: string): Link {
  return { type: "link", id } as Link;
}

// Helper functions to create ModelDefaultValue for testing
function quotedDefault(value: string): ModelDefaultValue {
  return { kind: "quoted", value, raw: `"${value}"` };
}

function linkDefault(id: string): ModelDefaultValue {
  return { kind: "link", id, raw: `^${id}` };
}

function datetimeDefault(value: string): ModelDefaultValue {
  return { kind: "datetime", value, raw: value };
}

describe("TypeExpr.matchesContent", () => {
  describe("primitive types", () => {
    it("matches string type with any content", () => {
      expect(TypeExpr.matchesContent(quotedValue("hello world"), primitive("string"))).toBe(true);
      expect(TypeExpr.matchesContent(linkValue("ref"), primitive("string"))).toBe(true);
      expect(TypeExpr.matchesContent(datetimeValue("2024-05-11"), primitive("string"))).toBe(true);
    });

    it("matches link type with link_value only", () => {
      expect(TypeExpr.matchesContent(linkValue("my-link"), primitive("link"))).toBe(true);
      expect(TypeExpr.matchesContent(linkValue("self"), primitive("link"))).toBe(true);
      expect(TypeExpr.matchesContent(quotedValue("^my-link"), primitive("link"))).toBe(false);
      expect(TypeExpr.matchesContent(quotedValue(""), primitive("link"))).toBe(false);
    });

    it("matches datetime type with datetime_value without time", () => {
      expect(TypeExpr.matchesContent(datetimeValue("2024-05-11"), primitive("datetime"))).toBe(
        true,
      );
      // With time component is not a date
      expect(
        TypeExpr.matchesContent(datetimeValue("2024-05-11T10:30Z"), primitive("datetime")),
      ).toBe(false);
      expect(TypeExpr.matchesContent(quotedValue("2024-05-11"), primitive("datetime"))).toBe(false);
    });

    it("matches daterange type with daterange content", () => {
      expect(TypeExpr.matchesContent(dateRangeValue("2020 ~ 2024"), primitive("daterange"))).toBe(
        true,
      );
      expect(
        TypeExpr.matchesContent(dateRangeValue("2020-01 ~ 2024-12"), primitive("daterange")),
      ).toBe(true);
      expect(TypeExpr.matchesContent(quotedValue("2020 ~ 2024"), primitive("daterange"))).toBe(
        false,
      );
      expect(TypeExpr.matchesContent(datetimeValue("2024-05-11"), primitive("daterange"))).toBe(
        false,
      );
    });
  });

  describe("literal types", () => {
    it("matches quoted values with exact content", () => {
      expect(TypeExpr.matchesContent(quotedValue("high"), literal("high"))).toBe(true);
      expect(TypeExpr.matchesContent(quotedValue("medium"), literal("medium"))).toBe(true);
      expect(TypeExpr.matchesContent(quotedValue("low"), literal("low"))).toBe(true);
    });

    it("rejects non-quoted content", () => {
      expect(TypeExpr.matchesContent(linkValue("high"), literal("high"))).toBe(false);
      expect(TypeExpr.matchesContent(datetimeValue("2024-05-11"), literal("2024-05-11"))).toBe(
        false,
      );
    });

    it("rejects wrong literal values", () => {
      expect(TypeExpr.matchesContent(quotedValue("wrong"), literal("high"))).toBe(false);
      expect(TypeExpr.matchesContent(quotedValue("HIGH"), literal("high"))).toBe(false);
    });
  });

  describe("union types", () => {
    it("matches any member of the union", () => {
      const type = union(literal("high"), literal("medium"), literal("low"));
      expect(TypeExpr.matchesContent(quotedValue("high"), type)).toBe(true);
      expect(TypeExpr.matchesContent(quotedValue("medium"), type)).toBe(true);
      expect(TypeExpr.matchesContent(quotedValue("low"), type)).toBe(true);
      expect(TypeExpr.matchesContent(quotedValue("other"), type)).toBe(false);
    });

    it("matches mixed primitive and literal unions", () => {
      const type = union(primitive("string"), primitive("link"));
      expect(TypeExpr.matchesContent(quotedValue("some text"), type)).toBe(true);
      expect(TypeExpr.matchesContent(linkValue("my-link"), type)).toBe(true);
    });
  });

  describe("array types", () => {
    describe("link[]", () => {
      const type = array(primitive("link"));

      it("matches single link value", () => {
        expect(TypeExpr.matchesContent(linkValue("link1"), type)).toBe(true);
      });

      it("matches value_array of links", () => {
        expect(TypeExpr.matchesContent(valueArray([link("link1"), link("link2")]), type)).toBe(
          true,
        );
        expect(
          TypeExpr.matchesContent(valueArray([link("link1"), link("link2"), link("link3")]), type),
        ).toBe(true);
      });

      it("rejects non-link values in array", () => {
        expect(
          TypeExpr.matchesContent(valueArray([link("link1"), quotedValue("text")]), type),
        ).toBe(false);
      });

      it("rejects empty arrays", () => {
        expect(TypeExpr.matchesContent(valueArray([]), type)).toBe(false);
      });
    });

    describe("string[]", () => {
      const type = array(primitive("string"));

      it("matches single quoted string", () => {
        expect(TypeExpr.matchesContent(quotedValue("hello"), type)).toBe(true);
      });

      it("matches value_array of quoted strings", () => {
        expect(
          TypeExpr.matchesContent(valueArray([quotedValue("hello"), quotedValue("world")]), type),
        ).toBe(true);
      });

      it("rejects empty strings in arrays", () => {
        expect(TypeExpr.matchesContent(quotedValue(""), type)).toBe(false);
      });
    });

    describe("datetime[]", () => {
      const type = array(primitive("datetime"));

      it("matches single datetime", () => {
        expect(TypeExpr.matchesContent(datetimeValue("2024-05-11"), type)).toBe(true);
      });

      it("rejects datetime with time component", () => {
        expect(TypeExpr.matchesContent(datetimeValue("2024-05-11T10:30Z"), type)).toBe(false);
      });

      it("matches value_array of datetimes", () => {
        expect(
          TypeExpr.matchesContent(
            valueArray([datetimeValue("2024-01-01"), datetimeValue("2024-06-15")]),
            type,
          ),
        ).toBe(true);
      });
    });

    describe("(string | link)[]", () => {
      const type = array(union(primitive("string"), primitive("link")));

      it("matches quoted strings", () => {
        expect(TypeExpr.matchesContent(quotedValue("hello"), type)).toBe(true);
      });

      it("matches links", () => {
        expect(TypeExpr.matchesContent(linkValue("link1"), type)).toBe(true);
      });

      it("matches mixed array", () => {
        expect(
          TypeExpr.matchesContent(valueArray([quotedValue("Jane Doe"), link("author-ref")]), type),
        ).toBe(true);
      });

      it("rejects empty strings", () => {
        expect(TypeExpr.matchesContent(quotedValue(""), type)).toBe(false);
      });
    });

    describe("literal array types", () => {
      const type = array(union(literal("foo"), literal("bar")));

      it("matches quoted literals", () => {
        expect(TypeExpr.matchesContent(quotedValue("foo"), type)).toBe(true);
        expect(TypeExpr.matchesContent(quotedValue("bar"), type)).toBe(true);
        expect(
          TypeExpr.matchesContent(valueArray([quotedValue("foo"), quotedValue("bar")]), type),
        ).toBe(true);
      });

      it("rejects invalid literals", () => {
        expect(TypeExpr.matchesContent(quotedValue("baz"), type)).toBe(false);
        expect(
          TypeExpr.matchesContent(valueArray([quotedValue("foo"), quotedValue("baz")]), type),
        ).toBe(false);
      });
    });
  });
});

describe("TypeExpr.matchesDefaultValue", () => {
  describe("primitive types", () => {
    it("matches string type with any default", () => {
      expect(TypeExpr.matchesDefaultValue(quotedDefault("hello"), primitive("string"))).toBe(true);
      expect(TypeExpr.matchesDefaultValue(linkDefault("ref"), primitive("string"))).toBe(true);
      expect(TypeExpr.matchesDefaultValue(datetimeDefault("2024-05-11"), primitive("string"))).toBe(
        true,
      );
    });

    it("matches link type with link default only", () => {
      expect(TypeExpr.matchesDefaultValue(linkDefault("my-link"), primitive("link"))).toBe(true);
      expect(TypeExpr.matchesDefaultValue(quotedDefault("^my-link"), primitive("link"))).toBe(
        false,
      );
    });

    it("matches datetime type with datetime default without time", () => {
      expect(
        TypeExpr.matchesDefaultValue(datetimeDefault("2024-05-11"), primitive("datetime")),
      ).toBe(true);
      expect(
        TypeExpr.matchesDefaultValue(datetimeDefault("2024-05-11T10:30Z"), primitive("datetime")),
      ).toBe(false);
      expect(TypeExpr.matchesDefaultValue(quotedDefault("2024-05-11"), primitive("datetime"))).toBe(
        false,
      );
    });

    it("rejects daterange (not supported as default)", () => {
      expect(
        TypeExpr.matchesDefaultValue(quotedDefault("2020 ~ 2024"), primitive("daterange")),
      ).toBe(false);
    });
  });

  describe("literal types", () => {
    it("matches quoted defaults with exact content", () => {
      expect(TypeExpr.matchesDefaultValue(quotedDefault("high"), literal("high"))).toBe(true);
      expect(TypeExpr.matchesDefaultValue(quotedDefault("medium"), literal("medium"))).toBe(true);
    });

    it("rejects non-quoted defaults", () => {
      expect(TypeExpr.matchesDefaultValue(linkDefault("high"), literal("high"))).toBe(false);
    });

    it("rejects wrong literal values", () => {
      expect(TypeExpr.matchesDefaultValue(quotedDefault("wrong"), literal("high"))).toBe(false);
    });
  });

  describe("union types", () => {
    it("matches any member of the union", () => {
      const type = union(literal("high"), literal("medium"), literal("low"));
      expect(TypeExpr.matchesDefaultValue(quotedDefault("high"), type)).toBe(true);
      expect(TypeExpr.matchesDefaultValue(quotedDefault("medium"), type)).toBe(true);
      expect(TypeExpr.matchesDefaultValue(quotedDefault("other"), type)).toBe(false);
    });
  });

  describe("array types (single element defaults)", () => {
    it("matches link default for link[]", () => {
      const type = array(primitive("link"));
      expect(TypeExpr.matchesDefaultValue(linkDefault("ref"), type)).toBe(true);
    });

    it("matches quoted default for string[]", () => {
      const type = array(primitive("string"));
      expect(TypeExpr.matchesDefaultValue(quotedDefault("hello"), type)).toBe(true);
      expect(TypeExpr.matchesDefaultValue(quotedDefault(""), type)).toBe(false);
    });

    it("matches literal default for literal array", () => {
      const type = array(union(literal("foo"), literal("bar")));
      expect(TypeExpr.matchesDefaultValue(quotedDefault("foo"), type)).toBe(true);
      expect(TypeExpr.matchesDefaultValue(quotedDefault("baz"), type)).toBe(false);
    });
  });
});

describe("TypeExpr.toString", () => {
  it("formats primitive types", () => {
    expect(TypeExpr.toString(primitive("string"))).toBe("string");
    expect(TypeExpr.toString(primitive("link"))).toBe("link");
    expect(TypeExpr.toString(primitive("datetime"))).toBe("datetime");
    expect(TypeExpr.toString(primitive("daterange"))).toBe("daterange");
    expect(TypeExpr.toString(primitive("number"))).toBe("number");
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
    expect(TypeExpr.toString(array(primitive("daterange")))).toBe("daterange[]");
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
