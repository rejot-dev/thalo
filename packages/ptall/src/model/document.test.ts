import { describe, it, expect } from "vitest";
import { Document } from "./document.js";
import type { ModelTypeExpression } from "./types.js";

describe("Document type expression parsing", () => {
  function getFieldType(source: string, fieldName: string): ModelTypeExpression | undefined {
    const doc = Document.parse(source, { filename: "test.ptall" });
    const schemaEntry = doc.schemaEntries[0];
    return schemaEntry?.fields.find((f) => f.name === fieldName)?.type;
  }

  describe("primitive types", () => {
    it("parses string type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  name: string

  # Sections
  Content
`,
        "name",
      );
      expect(type).toEqual({ kind: "primitive", name: "string" });
    });

    it("parses link type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  ref: link

  # Sections
  Content
`,
        "ref",
      );
      expect(type).toEqual({ kind: "primitive", name: "link" });
    });

    it("parses date type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  published: date

  # Sections
  Content
`,
        "published",
      );
      expect(type).toEqual({ kind: "primitive", name: "date" });
    });

    it("parses date-range type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  period: date-range

  # Sections
  Content
`,
        "period",
      );
      expect(type).toEqual({ kind: "primitive", name: "date-range" });
    });
  });

  describe("literal types", () => {
    it("parses single literal type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  status: "active"

  # Sections
  Content
`,
        "status",
      );
      expect(type).toEqual({ kind: "literal", value: "active" });
    });
  });

  describe("union types", () => {
    it("parses literal union type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  confidence: "high" | "medium" | "low"

  # Sections
  Content
`,
        "confidence",
      );
      expect(type).toEqual({
        kind: "union",
        members: [
          { kind: "literal", value: "high" },
          { kind: "literal", value: "medium" },
          { kind: "literal", value: "low" },
        ],
      });
    });

    it("parses primitive union type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  author: string | link

  # Sections
  Content
`,
        "author",
      );
      expect(type).toEqual({
        kind: "union",
        members: [
          { kind: "primitive", name: "string" },
          { kind: "primitive", name: "link" },
        ],
      });
    });
  });

  describe("array types", () => {
    it("parses link[] type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  related: link[]

  # Sections
  Content
`,
        "related",
      );
      expect(type).toEqual({
        kind: "array",
        elementType: { kind: "primitive", name: "link" },
      });
    });

    it("parses string[] type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  tags: string[]

  # Sections
  Content
`,
        "tags",
      );
      expect(type).toEqual({
        kind: "array",
        elementType: { kind: "primitive", name: "string" },
      });
    });

    it("parses date[] type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  dates: date[]

  # Sections
  Content
`,
        "dates",
      );
      expect(type).toEqual({
        kind: "array",
        elementType: { kind: "primitive", name: "date" },
      });
    });

    it("parses date-range[] type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  periods: date-range[]

  # Sections
  Content
`,
        "periods",
      );
      expect(type).toEqual({
        kind: "array",
        elementType: { kind: "primitive", name: "date-range" },
      });
    });

    it("parses (string | link)[] type", () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  authors: (string | link)[]

  # Sections
  Content
`,
        "authors",
      );
      expect(type).toEqual({
        kind: "array",
        elementType: {
          kind: "union",
          members: [
            { kind: "primitive", name: "string" },
            { kind: "primitive", name: "link" },
          ],
        },
      });
    });

    it('parses ("foo" | "bar")[] type', () => {
      const type = getFieldType(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  options: ("foo" | "bar")[]

  # Sections
  Content
`,
        "options",
      );
      expect(type).toEqual({
        kind: "array",
        elementType: {
          kind: "union",
          members: [
            { kind: "literal", value: "foo" },
            { kind: "literal", value: "bar" },
          ],
        },
      });
    });
  });

  describe("field metadata", () => {
    it("parses optional fields", () => {
      const doc = Document.parse(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  required: string
  optional?: string

  # Sections
  Content
`,
        { filename: "test.ptall" },
      );
      const schema = doc.schemaEntries[0];
      expect(schema?.fields.find((f) => f.name === "required")?.optional).toBe(false);
      expect(schema?.fields.find((f) => f.name === "optional")?.optional).toBe(true);
    });

    it("parses default values", () => {
      const doc = Document.parse(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  status?: "active" | "inactive" = "active"

  # Sections
  Content
`,
        { filename: "test.ptall" },
      );
      const schema = doc.schemaEntries[0];
      const field = schema?.fields.find((f) => f.name === "status");
      expect(field?.defaultValue).toBe('"active"');
    });

    it("parses descriptions", () => {
      const doc = Document.parse(
        `2026-01-01T00:00 define-entity test "Test"
  # Metadata
  name: string ; "The name of the thing"

  # Sections
  Content
`,
        { filename: "test.ptall" },
      );
      const schema = doc.schemaEntries[0];
      const field = schema?.fields.find((f) => f.name === "name");
      expect(field?.description).toBe("The name of the thing");
    });
  });
});

describe("Document instance entry parsing", () => {
  it("parses metadata values", () => {
    const doc = Document.parse(
      `2026-01-01T00:00 create lore "Test" #tag
  type: "fact"
  subject: my subject
  ref: ^my-ref

  # Content
  Some content.
`,
      { filename: "test.ptall" },
    );

    const entry = doc.instanceEntries[0];
    expect(entry?.metadata.get("type")?.raw).toBe('"fact"');
    expect(entry?.metadata.get("subject")?.raw).toBe("my subject");
    expect(entry?.metadata.get("ref")?.raw).toBe("^my-ref");
    expect(entry?.metadata.get("ref")?.linkId).toBe("my-ref");
  });

  it("parses array metadata values", () => {
    const doc = Document.parse(
      `2026-01-01T00:00 create opinion "Test" #tag
  confidence: "high"
  related: ^ref1, ^ref2, ^ref3

  # Claim
  Test claim.
`,
      { filename: "test.ptall" },
    );

    const entry = doc.instanceEntries[0];
    expect(entry?.metadata.get("related")?.raw).toBe("^ref1, ^ref2, ^ref3");
  });
});
