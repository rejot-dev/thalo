import { describe, it, expect, beforeEach } from "vitest";
import { parseDocument } from "./parser.js";
import { Document } from "./model/document.js";
import { Workspace } from "./model/workspace.js";
import { check } from "./checker/check.js";
import { isIdentityMap } from "./source-map.js";

describe("Parser", () => {
  it("parses a ptall file", () => {
    const source = `2026-01-05T18:00 create lore "Test entry" #test
  type: "fact"
  subject: ^self

  Some content here.
`;
    const result = parseDocument(source, { fileType: "ptall" });

    expect(result.blocks).toHaveLength(1);
    expect(isIdentityMap(result.blocks[0].sourceMap)).toBe(true);
    expect(result.blocks[0].tree.rootNode.type).toBe("source_file");
  });

  it("parses using filename heuristic", () => {
    const source = `2026-01-05T18:00 create lore "Test entry" #test
  type: "fact"
`;
    const result = parseDocument(source, { filename: "test.ptall" });

    expect(result.blocks).toHaveLength(1);
  });

  it("extracts ptall blocks from markdown", () => {
    const source = `# My Document

Some text.

\`\`\`ptall
2026-01-05T18:00 create lore "Test entry" #test
  type: "fact"
\`\`\`

More text.

\`\`\`ptall
2026-01-05T19:00 create lore "Another entry" #test
  type: "insight"
\`\`\`
`;
    const result = parseDocument(source, { fileType: "markdown" });

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].source).toContain("Test entry");
    expect(result.blocks[1].source).toContain("Another entry");
  });

  it("extracts ptall blocks from markdown by filename", () => {
    const source = `# My Document

\`\`\`ptall
2026-01-05T18:00 create lore "Test entry" #test
  type: "fact"
\`\`\`
`;
    const result = parseDocument(source, { filename: "test.md" });

    expect(result.blocks).toHaveLength(1);
  });
});

describe("Document", () => {
  it("parses entries from source", () => {
    const source = `2026-01-05T18:00 create lore "Test entry" ^my-lore #test
  type: "fact"
  subject: ^self

  Some content here.
`;
    const doc = Document.parse(source, { filename: "test.ptall" });

    expect(doc.entries).toHaveLength(1);
    expect(doc.instanceEntries).toHaveLength(1);

    const entry = doc.instanceEntries[0];
    expect(entry.timestamp).toBe("2026-01-05T18:00");
    expect(entry.directive).toBe("create");
    expect(entry.entity).toBe("lore");
    expect(entry.title).toBe("Test entry");
    expect(entry.linkId).toBe("my-lore");
    expect(entry.tags).toEqual(["test"]);
    expect(entry.metadata.get("type")?.raw).toBe('"fact"');
    expect(entry.metadata.get("subject")?.linkId).toBe("self");
  });

  it("builds link index", () => {
    const source = `2026-01-05T18:00 create lore "Test entry" ^my-lore #test
  type: "fact"
  related: ^other-entry
`;
    const doc = Document.parse(source, { filename: "test.ptall" });

    // Only explicit link ID creates a definition (timestamps are not link IDs)
    expect(doc.linkIndex.definitions.has("2026-01-05T18:00")).toBe(false);
    expect(doc.linkIndex.definitions.has("my-lore")).toBe(true);

    // Related is a reference
    expect(doc.linkIndex.references.has("other-entry")).toBe(true);
    expect(doc.linkIndex.references.get("other-entry")).toHaveLength(1);
  });
});

describe("SchemaRegistry", () => {
  it("resolves entity schemas", () => {
    const source = `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  date?: date-range
  # Sections
  Summary?
`;
    const workspace = new Workspace();
    workspace.addDocument(source, { filename: "schema.ptall" });

    const schema = workspace.schemaRegistry.get("lore");

    expect(schema).toBeDefined();
    expect(schema!.name).toBe("lore");
    expect(schema!.fields.has("type")).toBe(true);
    expect(schema!.fields.get("type")!.optional).toBe(false);
    expect(schema!.fields.get("date")!.optional).toBe(true);
    expect(schema!.sections.has("Summary")).toBe(true);
    expect(schema!.sections.get("Summary")!.optional).toBe(true);
  });
});

describe("Checker", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();

    // Add schema definitions
    const schemaSource = `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  # Sections
  Summary

2026-01-01T00:01 define-entity opinion "Opinion entries"
  # Metadata
  confidence: "high" | "medium" | "low"
  # Sections
  Claim
  Reasoning
`;
    workspace.addDocument(schemaSource, { filename: "schemas.ptall" });
  });

  it("reports unknown entity", () => {
    // "journal" is a valid entity keyword but not defined in our test schema
    const source = `2026-01-05T18:00 create journal "Test" #test
  field: "value"
`;
    workspace.addDocument(source, { filename: "test.ptall" });
    const diagnostics = check(workspace);

    const unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
    expect(unknownEntity).toBeDefined();
    expect(unknownEntity!.message).toContain("journal");
  });

  it("reports missing required field", () => {
    const source = `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
`;
    // Missing "subject" which is required
    workspace.addDocument(source, { filename: "test.ptall" });
    const diagnostics = check(workspace);

    const missingField = diagnostics.find((d) => d.code === "missing-required-field");
    expect(missingField).toBeDefined();
    expect(missingField!.message).toContain("subject");
  });

  it("reports unknown field", () => {
    const source = `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  subject: "test"
  unknown-field: "value"
`;
    workspace.addDocument(source, { filename: "test.ptall" });
    const diagnostics = check(workspace);

    const unknownField = diagnostics.find((d) => d.code === "unknown-field");
    expect(unknownField).toBeDefined();
    expect(unknownField!.message).toContain("unknown-field");
  });

  it("reports invalid field type", () => {
    const source = `2026-01-05T18:00 create lore "Test" #test
  type: "invalid-value"
  subject: "test"
`;
    workspace.addDocument(source, { filename: "test.ptall" });
    const diagnostics = check(workspace);

    const invalidType = diagnostics.find((d) => d.code === "invalid-field-type");
    expect(invalidType).toBeDefined();
    expect(invalidType!.message).toContain("invalid-value");
  });

  it("reports missing required section", () => {
    const source = `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  subject: "test"

  Just some content without the required Summary section.
`;
    workspace.addDocument(source, { filename: "test.ptall" });
    const diagnostics = check(workspace);

    const missingSection = diagnostics.find((d) => d.code === "missing-required-section");
    expect(missingSection).toBeDefined();
    expect(missingSection!.message).toContain("Summary");
  });

  it("reports unresolved link", () => {
    const source = `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  subject: "test"
  related: ^nonexistent-link

  # Summary
  Test summary.
`;
    workspace.addDocument(source, { filename: "test.ptall" });
    const diagnostics = check(workspace);

    const unresolvedLink = diagnostics.find((d) => d.code === "unresolved-link");
    expect(unresolvedLink).toBeDefined();
    expect(unresolvedLink!.message).toContain("nonexistent-link");
  });

  it("passes with valid entry", () => {
    const source = `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  subject: "test"

  # Summary
  Test summary.
`;
    workspace.addDocument(source, { filename: "test.ptall" });
    const diagnostics = check(workspace);

    // Should only have no errors (warnings may exist for unknown section if any)
    const errors = diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("allows configuring rule severity", () => {
    const source = `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  subject: "test"
  unknown-field: "value"

  # Summary
  Test summary.
`;
    workspace.addDocument(source, { filename: "test.ptall" });

    // With default config, unknown-field is a warning
    const withWarning = check(workspace);
    expect(withWarning.find((d) => d.code === "unknown-field")?.severity).toBe("warning");

    // With custom config, turn it off
    const withOff = check(workspace, { rules: { "unknown-field": "off" } });
    expect(withOff.find((d) => d.code === "unknown-field")).toBeUndefined();

    // With custom config, make it an error
    const withError = check(workspace, { rules: { "unknown-field": "error" } });
    expect(withError.find((d) => d.code === "unknown-field")?.severity).toBe("error");
  });
});
