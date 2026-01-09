import { describe, it, expect, beforeEach } from "vitest";
import { parseDocument } from "./parser.js";
import { Workspace } from "./model/workspace.js";
import { check } from "./checker/check.js";
import { isIdentityMap } from "./source-map.js";

describe("Parser", () => {
  it("parses a thalo file", () => {
    const source = `2026-01-05T18:00Z create lore "Test entry" #test
  type: "fact"
  subject: ^self

  Some content here.
`;
    const result = parseDocument(source, { fileType: "thalo" });

    expect(result.blocks).toHaveLength(1);
    expect(isIdentityMap(result.blocks[0].sourceMap)).toBe(true);
    expect(result.blocks[0].tree.rootNode.type).toBe("source_file");
  });

  it("parses using filename heuristic", () => {
    const source = `2026-01-05T18:00Z create lore "Test entry" #test
  type: "fact"
`;
    const result = parseDocument(source, { filename: "test.thalo" });

    expect(result.blocks).toHaveLength(1);
  });

  it("extracts thalo blocks from markdown", () => {
    const source = `# My Document

Some text.

\`\`\`thalo
2026-01-05T18:00Z create lore "Test entry" #test
  type: "fact"
\`\`\`

More text.

\`\`\`thalo
2026-01-05T19:00Z create lore "Another entry" #test
  type: "insight"
\`\`\`
`;
    const result = parseDocument(source, { fileType: "markdown" });

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].source).toContain("Test entry");
    expect(result.blocks[1].source).toContain("Another entry");
  });

  it("extracts thalo blocks from markdown by filename", () => {
    const source = `# My Document

\`\`\`thalo
2026-01-05T18:00Z create lore "Test entry" #test
  type: "fact"
\`\`\`
`;
    const result = parseDocument(source, { filename: "test.md" });

    expect(result.blocks).toHaveLength(1);
  });
});

describe("SchemaRegistry", () => {
  it("resolves entity schemas", () => {
    const source = `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  date?: date-range
  # Sections
  Summary?
`;
    const workspace = new Workspace();
    workspace.addDocument(source, { filename: "schema.thalo" });

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
    const schemaSource = `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  # Sections
  Summary

2026-01-01T00:01Z define-entity opinion "Opinion entries"
  # Metadata
  confidence: "high" | "medium" | "low"
  # Sections
  Claim
  Reasoning
`;
    workspace.addDocument(schemaSource, { filename: "schemas.thalo" });
  });

  it("reports unknown entity", () => {
    // "journal" is a valid entity keyword but not defined in our test schema
    const source = `2026-01-05T18:00Z create journal "Test" #test
  field: "value"
`;
    workspace.addDocument(source, { filename: "test.thalo" });
    const diagnostics = check(workspace);

    const unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
    expect(unknownEntity).toBeDefined();
    expect(unknownEntity!.message).toContain("journal");
  });

  it("reports missing required field", () => {
    const source = `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
`;
    // Missing "subject" which is required
    workspace.addDocument(source, { filename: "test.thalo" });
    const diagnostics = check(workspace);

    const missingField = diagnostics.find((d) => d.code === "missing-required-field");
    expect(missingField).toBeDefined();
    expect(missingField!.message).toContain("subject");
  });

  it("reports unknown field", () => {
    const source = `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"
  unknown-field: "value"
`;
    workspace.addDocument(source, { filename: "test.thalo" });
    const diagnostics = check(workspace);

    const unknownField = diagnostics.find((d) => d.code === "unknown-field");
    expect(unknownField).toBeDefined();
    expect(unknownField!.message).toContain("unknown-field");
  });

  it("reports invalid field type", () => {
    const source = `2026-01-05T18:00Z create lore "Test" #test
  type: "invalid-value"
  subject: "test"
`;
    workspace.addDocument(source, { filename: "test.thalo" });
    const diagnostics = check(workspace);

    const invalidType = diagnostics.find((d) => d.code === "invalid-field-type");
    expect(invalidType).toBeDefined();
    expect(invalidType!.message).toContain("invalid-value");
  });

  it("reports missing required section", () => {
    const source = `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"

  Just some content without the required Summary section.
`;
    workspace.addDocument(source, { filename: "test.thalo" });
    const diagnostics = check(workspace);

    const missingSection = diagnostics.find((d) => d.code === "missing-required-section");
    expect(missingSection).toBeDefined();
    expect(missingSection!.message).toContain("Summary");
  });

  it("reports unresolved link", () => {
    const source = `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"
  related: ^nonexistent-link

  # Summary
  Test summary.
`;
    workspace.addDocument(source, { filename: "test.thalo" });
    const diagnostics = check(workspace);

    const unresolvedLink = diagnostics.find((d) => d.code === "unresolved-link");
    expect(unresolvedLink).toBeDefined();
    expect(unresolvedLink!.message).toContain("nonexistent-link");
  });

  it("passes with valid entry", () => {
    const source = `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"

  # Summary
  Test summary.
`;
    workspace.addDocument(source, { filename: "test.thalo" });
    const diagnostics = check(workspace);

    // Should only have no errors (warnings may exist for unknown section if any)
    const errors = diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("allows configuring rule severity", () => {
    const source = `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"
  unknown-field: "value"

  # Summary
  Test summary.
`;
    workspace.addDocument(source, { filename: "test.thalo" });

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
