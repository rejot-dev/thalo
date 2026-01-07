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

describe("Document synthesis entry parsing", () => {
  it("parses basic synthesis entry", () => {
    const doc = Document.parse(
      `2026-01-07T12:00 define-synthesis "My Profile" ^profile-synthesis
  sources: lore where subject = ^self

  # Prompt
  Generate a profile from the lore entries.
`,
      { filename: "test.ptall" },
    );

    expect(doc.synthesisEntries).toHaveLength(1);
    const synth = doc.synthesisEntries[0];
    expect(synth?.kind).toBe("synthesis");
    expect(synth?.timestamp).toBe("2026-01-07T12:00");
    expect(synth?.title).toBe("My Profile");
    expect(synth?.linkId).toBe("profile-synthesis");
  });

  it("parses sources query", () => {
    const doc = Document.parse(
      `2026-01-07T12:00 define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate profile.
`,
      { filename: "test.ptall" },
    );

    const synth = doc.synthesisEntries[0];
    expect(synth?.sources).toHaveLength(1);
    expect(synth?.sources[0]).toEqual({
      entity: "lore",
      conditions: [{ kind: "field", field: "subject", value: "^self" }],
    });
  });

  it("parses multiple source queries", () => {
    const doc = Document.parse(
      `2026-01-07T12:00 define-synthesis "Bio" ^bio
  sources: lore where subject = ^self and #career, journal where subject = ^self

  # Prompt
  Generate bio.
`,
      { filename: "test.ptall" },
    );

    const synth = doc.synthesisEntries[0];
    expect(synth?.sources).toHaveLength(2);
    expect(synth?.sources[0]).toEqual({
      entity: "lore",
      conditions: [
        { kind: "field", field: "subject", value: "^self" },
        { kind: "tag", tag: "career" },
      ],
    });
    expect(synth?.sources[1]).toEqual({
      entity: "journal",
      conditions: [{ kind: "field", field: "subject", value: "^self" }],
    });
  });

  it("parses prompt content", () => {
    const doc = Document.parse(
      `2026-01-07T12:00 define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate a narrative bio.
  Keep it professional but personal.
`,
      { filename: "test.ptall" },
    );

    const synth = doc.synthesisEntries[0];
    expect(synth?.prompt).toBe("Generate a narrative bio.\nKeep it professional but personal.");
  });

  it("parses tags on synthesis entries", () => {
    const doc = Document.parse(
      `2026-01-07T12:00 define-synthesis "Profile" ^profile #important #profile
  sources: lore where subject = ^self

  # Prompt
  Generate profile.
`,
      { filename: "test.ptall" },
    );

    const synth = doc.synthesisEntries[0];
    expect(synth?.tags).toEqual(["important", "profile"]);
  });

  it("indexes synthesis link definitions", () => {
    const doc = Document.parse(
      `2026-01-07T12:00 define-synthesis "Profile" ^my-synthesis
  sources: lore where subject = ^self

  # Prompt
  Generate.
`,
      { filename: "test.ptall" },
    );

    expect(doc.linkIndex.definitions.has("my-synthesis")).toBe(true);
    const def = doc.linkIndex.definitions.get("my-synthesis");
    expect(def?.id).toBe("my-synthesis");
    expect(def?.entry.kind).toBe("synthesis");
  });
});

describe("Document actualize entry parsing", () => {
  it("parses basic actualize entry", () => {
    const doc = Document.parse(
      `2026-01-07T12:01 actualize-synthesis ^profile
  updated: 2026-01-07T12:01
`,
      { filename: "test.ptall" },
    );

    expect(doc.actualizeEntries).toHaveLength(1);
    const act = doc.actualizeEntries[0];
    expect(act?.kind).toBe("actualize");
    expect(act?.timestamp).toBe("2026-01-07T12:01");
    expect(act?.target).toBe("profile");
  });

  it("parses updated timestamp from metadata", () => {
    const doc = Document.parse(
      `2026-01-07T15:30 actualize-synthesis ^my-synthesis
  updated: 2026-01-07T15:30
`,
      { filename: "test.ptall" },
    );

    const act = doc.actualizeEntries[0];
    expect(act?.metadata.get("updated")?.raw).toBe("2026-01-07T15:30");
  });

  it("indexes actualize target references", () => {
    const doc = Document.parse(
      `2026-01-07T12:01 actualize-synthesis ^target-synth
  updated: 2026-01-07T12:01
`,
      { filename: "test.ptall" },
    );

    expect(doc.linkIndex.references.has("target-synth")).toBe(true);
    const refs = doc.linkIndex.references.get("target-synth");
    expect(refs).toHaveLength(1);
    expect(refs?.[0]?.entry.kind).toBe("actualize");
  });

  it("actualize entries have null linkId", () => {
    const doc = Document.parse(
      `2026-01-07T12:01 actualize-synthesis ^profile
  updated: 2026-01-07T12:01
`,
      { filename: "test.ptall" },
    );

    const act = doc.actualizeEntries[0];
    expect(act?.linkId).toBeNull();
  });
});

describe("Document with mixed synthesis and instance entries", () => {
  it("parses file with synthesis, actualize, and instance entries", () => {
    const doc = Document.parse(
      `2026-01-07T12:00 define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate profile.

2026-01-07T12:01 actualize-synthesis ^profile
  updated: 2026-01-07T12:01

2026-01-07T12:05 create lore "New fact" #career
  type: "fact"
  subject: ^self

  # Content
  A new career fact.
`,
      { filename: "test.ptall" },
    );

    expect(doc.entries).toHaveLength(3);
    expect(doc.synthesisEntries).toHaveLength(1);
    expect(doc.actualizeEntries).toHaveLength(1);
    expect(doc.instanceEntries).toHaveLength(1);
  });

  it("findEntry works with synthesis linkId", () => {
    const doc = Document.parse(
      `2026-01-07T12:00 define-synthesis "Profile" ^my-profile
  sources: lore where subject = ^self

  # Prompt
  Generate.
`,
      { filename: "test.ptall" },
    );

    const entry = doc.findEntry("my-profile");
    expect(entry?.kind).toBe("synthesis");
  });
});
