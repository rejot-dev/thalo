import { describe, it, expect, beforeEach } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Workspace } from "@wilco/ptall";
import { getDiagnostics } from "./diagnostics.js";

/**
 * Create a TextDocument for testing
 */
function createDocument(content: string, uri = "file:///test.ptall"): TextDocument {
  return TextDocument.create(uri, "ptall", 1, content);
}

describe("getDiagnostics", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();

    // Add schema definitions for validation
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
    workspace.addDocument(schemaSource, { filename: "/schemas.ptall" });
  });

  describe("valid documents", () => {
    it("should return no errors for valid entry", () => {
      const source = `2026-01-05T18:00 create lore "Valid entry" #test
  type: fact
  subject: test

  # Summary
  This is a valid summary.
`;
      workspace.addDocument(source, { filename: "/test.ptall" });
      const doc = createDocument(source);

      const diagnostics = getDiagnostics(workspace, doc);

      const errors = diagnostics.filter((d) => d.severity === 1);
      expect(errors).toHaveLength(0);
    });
  });

  describe("schema validation errors", () => {
    it("should report unknown entity", () => {
      // Use "journal" which is a valid keyword but not defined in our test schema
      const source = `2026-01-05T18:00 create journal "Test" #test
  field: value
`;
      workspace.addDocument(source, { filename: "/test.ptall" });
      const doc = createDocument(source);

      const diagnostics = getDiagnostics(workspace, doc);

      const unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
      expect(unknownEntity).toBeDefined();
      expect(unknownEntity!.message).toContain("journal");
    });

    it("should report missing required field", () => {
      const source = `2026-01-05T18:00 create lore "Missing subject" #test
  type: fact
`;
      // Missing "subject" which is required
      workspace.addDocument(source, { filename: "/test.ptall" });
      const doc = createDocument(source);

      const diagnostics = getDiagnostics(workspace, doc);

      const missingField = diagnostics.find((d) => d.code === "missing-required-field");
      expect(missingField).toBeDefined();
      expect(missingField!.message).toContain("subject");
    });

    it("should report unknown field", () => {
      const source = `2026-01-05T18:00 create lore "With unknown field" #test
  type: fact
  subject: test
  unknown-field: value

  # Summary
  Summary content.
`;
      workspace.addDocument(source, { filename: "/test.ptall" });
      const doc = createDocument(source);

      const diagnostics = getDiagnostics(workspace, doc);

      const unknownField = diagnostics.find((d) => d.code === "unknown-field");
      expect(unknownField).toBeDefined();
      expect(unknownField!.message).toContain("unknown-field");
    });

    it("should report invalid field type", () => {
      const source = `2026-01-05T18:00 create lore "Invalid type value" #test
  type: invalid-value
  subject: test

  # Summary
  Summary content.
`;
      workspace.addDocument(source, { filename: "/test.ptall" });
      const doc = createDocument(source);

      const diagnostics = getDiagnostics(workspace, doc);

      const invalidType = diagnostics.find((d) => d.code === "invalid-field-type");
      expect(invalidType).toBeDefined();
      expect(invalidType!.message).toContain("invalid-value");
    });

    it("should report missing required section", () => {
      const source = `2026-01-05T18:00 create lore "Missing section" #test
  type: fact
  subject: test

  Just content without required Summary section.
`;
      workspace.addDocument(source, { filename: "/test.ptall" });
      const doc = createDocument(source);

      const diagnostics = getDiagnostics(workspace, doc);

      const missingSection = diagnostics.find((d) => d.code === "missing-required-section");
      expect(missingSection).toBeDefined();
      expect(missingSection!.message).toContain("Summary");
    });
  });

  describe("link validation", () => {
    it("should report unresolved link", () => {
      const source = `2026-01-05T18:00 create lore "With bad link" #test
  type: fact
  subject: test
  related: ^nonexistent-link

  # Summary
  Summary content.
`;
      workspace.addDocument(source, { filename: "/test.ptall" });
      const doc = createDocument(source);

      const diagnostics = getDiagnostics(workspace, doc);

      const unresolvedLink = diagnostics.find((d) => d.code === "unresolved-link");
      expect(unresolvedLink).toBeDefined();
      expect(unresolvedLink!.message).toContain("nonexistent-link");
    });

    it("should not report error for valid link", () => {
      // First add an entry with a link ID
      const source1 = `2026-01-05T18:00 create lore "First entry" ^first-entry #test
  type: fact
  subject: test

  # Summary
  Summary content.
`;
      workspace.addDocument(source1, { filename: "/file1.ptall" });

      // Then reference it
      const source2 = `2026-01-05T19:00 create lore "Second entry" #test
  type: fact
  subject: test
  related: ^first-entry

  # Summary
  Summary content.
`;
      workspace.addDocument(source2, { filename: "/file2.ptall" });
      const doc = createDocument(source2, "file:///file2.ptall");

      const diagnostics = getDiagnostics(workspace, doc);

      const unresolvedLink = diagnostics.find((d) => d.code === "unresolved-link");
      expect(unresolvedLink).toBeUndefined();
    });
  });

  describe("diagnostic format", () => {
    it("should include proper range information", () => {
      const source = `2026-01-05T18:00 create lore "Test" #test
  type: invalid-value
  subject: test

  # Summary
  Content.
`;
      workspace.addDocument(source, { filename: "/test.ptall" });
      const doc = createDocument(source);

      const diagnostics = getDiagnostics(workspace, doc);

      const diagnostic = diagnostics.find((d) => d.code === "invalid-field-type");
      expect(diagnostic).toBeDefined();
      expect(diagnostic!.range.start.line).toBeGreaterThanOrEqual(0);
      expect(diagnostic!.range.start.character).toBeGreaterThanOrEqual(0);
      expect(diagnostic!.range.end.line).toBeGreaterThanOrEqual(diagnostic!.range.start.line);
    });

    it("should set source to ptall", () => {
      // Use "journal" - valid keyword but not in test schema
      const source = `2026-01-05T18:00 create journal "Test" #test
  field: value
`;
      workspace.addDocument(source, { filename: "/test.ptall" });
      const doc = createDocument(source);

      const diagnostics = getDiagnostics(workspace, doc);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach((d) => {
        expect(d.source).toBe("ptall");
      });
    });

    it("should map severity correctly", () => {
      const source = `2026-01-05T18:00 create lore "Test" #test
  type: fact
  subject: test
  unknown-field: value

  # Summary
  Content.
`;
      workspace.addDocument(source, { filename: "/test.ptall" });
      const doc = createDocument(source);

      const diagnostics = getDiagnostics(workspace, doc);

      // unknown-field is typically a warning (severity 2)
      const unknownField = diagnostics.find((d) => d.code === "unknown-field");
      expect(unknownField).toBeDefined();
      expect(unknownField!.severity).toBe(2); // Warning
    });
  });

  describe("edge cases", () => {
    it("should return empty array when document is not in workspace", () => {
      const doc = createDocument(
        `2026-01-05T18:00 create lore "Test" #test`,
        "file:///not-in-workspace.ptall",
      );

      const diagnostics = getDiagnostics(workspace, doc);

      expect(diagnostics).toHaveLength(0);
    });

    it("should handle empty document", () => {
      const source = ``;
      workspace.addDocument(source, { filename: "/empty.ptall" });
      const doc = createDocument(source, "file:///empty.ptall");

      const diagnostics = getDiagnostics(workspace, doc);

      // Empty document should have no diagnostics
      expect(diagnostics).toHaveLength(0);
    });

    it("should handle document with only whitespace", () => {
      const source = `
  
    
  `;
      workspace.addDocument(source, { filename: "/whitespace.ptall" });
      const doc = createDocument(source, "file:///whitespace.ptall");

      const diagnostics = getDiagnostics(workspace, doc);

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("cross-file diagnostics", () => {
    it("should report unknown entity when definition is not in workspace", () => {
      // Use 'reference' entity which is a valid keyword but not defined in our test schema
      const source = `2026-01-05T18:00 create reference "Test entry" #test
  url: "https://example.com"
  ref-type: article
`;
      workspace.addDocument(source, { filename: "/file2.ptall" });
      const doc = createDocument(source, "file:///file2.ptall");

      const diagnostics = getDiagnostics(workspace, doc);

      const unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
      expect(unknownEntity).toBeDefined();
      expect(unknownEntity!.message).toContain("reference");
    });

    it("should not report error when entity is defined in another file", () => {
      // File 1: defines 'reference' entity
      const schemaSource = `2026-01-02T00:00 define-entity reference "Reference entries"
  # Metadata
  url: string
  ref-type: string
`;
      workspace.addDocument(schemaSource, { filename: "/ref-schema.ptall" });

      // File 2: uses 'reference' entity
      const source = `2026-01-05T18:00 create reference "Test entry" #test
  url: "https://example.com"
  ref-type: article
`;
      workspace.addDocument(source, { filename: "/file2.ptall" });
      const doc = createDocument(source, "file:///file2.ptall");

      const diagnostics = getDiagnostics(workspace, doc);

      const unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
      expect(unknownEntity).toBeUndefined();
    });

    it("should report error after entity definition is removed from another file", () => {
      // Step 1: Add schema file with 'reference' entity definition
      const schemaSource = `2026-01-02T00:00 define-entity reference "Reference entries"
  # Metadata
  url: string
  ref-type: string
`;
      workspace.addDocument(schemaSource, { filename: "/ref-schema.ptall" });

      // Step 2: Add file using 'reference' entity
      const source = `2026-01-05T18:00 create reference "Test entry" #test
  url: "https://example.com"
  ref-type: article
`;
      workspace.addDocument(source, { filename: "/file2.ptall" });
      const doc = createDocument(source, "file:///file2.ptall");

      // Step 3: Verify no errors initially
      let diagnostics = getDiagnostics(workspace, doc);
      let unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
      expect(unknownEntity).toBeUndefined();

      // Step 4: Remove the entity definition by updating schema file
      const emptySchemaSource = `# Empty file - entity definition removed
`;
      workspace.addDocument(emptySchemaSource, { filename: "/ref-schema.ptall" });

      // Step 5: Verify file2 now has error (simulating cross-file diagnostic refresh)
      diagnostics = getDiagnostics(workspace, doc);
      unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
      expect(unknownEntity).toBeDefined();
      expect(unknownEntity!.message).toContain("reference");
    });

    it("should resolve error when entity definition is added to another file", () => {
      // Step 1: Add file using 'reference' entity (which doesn't exist yet in our test schema)
      const source = `2026-01-05T18:00 create reference "Test entry" #test
  url: "https://example.com"
  ref-type: article
`;
      workspace.addDocument(source, { filename: "/file1.ptall" });
      const doc = createDocument(source, "file:///file1.ptall");

      // Step 2: Verify error initially
      let diagnostics = getDiagnostics(workspace, doc);
      let unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
      expect(unknownEntity).toBeDefined();
      expect(unknownEntity!.message).toContain("reference");

      // Step 3: Add the entity definition in another file
      const schemaSource = `2026-01-02T00:00 define-entity reference "Reference entries"
  # Metadata
  url: string
  ref-type: string
`;
      workspace.addDocument(schemaSource, { filename: "/schema.ptall" });

      // Step 4: Verify file1 no longer has error
      diagnostics = getDiagnostics(workspace, doc);
      unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
      expect(unknownEntity).toBeUndefined();
    });

    it("should update link diagnostics when link definition changes in another file", () => {
      // Step 1: Add file with link definition
      const file1Source = `2026-01-05T18:00 create lore "First entry" ^my-link #test
  type: fact
  subject: test

  # Summary
  Content.
`;
      workspace.addDocument(file1Source, { filename: "/file1.ptall" });

      // Step 2: Add file referencing the link
      const file2Source = `2026-01-05T19:00 create lore "Second entry" #test
  type: fact
  subject: test
  related: ^my-link

  # Summary
  Content.
`;
      workspace.addDocument(file2Source, { filename: "/file2.ptall" });
      const doc2 = createDocument(file2Source, "file:///file2.ptall");

      // Step 3: Verify no unresolved link error initially
      let diagnostics = getDiagnostics(workspace, doc2);
      let unresolvedLink = diagnostics.find((d) => d.code === "unresolved-link");
      expect(unresolvedLink).toBeUndefined();

      // Step 4: Remove the link definition by updating file1 (remove ^my-link)
      const file1Updated = `2026-01-05T18:00 create lore "First entry" #test
  type: fact
  subject: test

  # Summary
  Content.
`;
      workspace.addDocument(file1Updated, { filename: "/file1.ptall" });

      // Step 5: Verify file2 now has unresolved link error
      diagnostics = getDiagnostics(workspace, doc2);
      unresolvedLink = diagnostics.find((d) => d.code === "unresolved-link");
      expect(unresolvedLink).toBeDefined();
      expect(unresolvedLink!.message).toContain("my-link");
    });

    it("should handle multiple files depending on same entity definition", () => {
      // Step 1: Add schema with 'journal' entity (valid grammar keyword, not in beforeEach schema)
      const schemaSource = `2026-01-02T00:00 define-entity journal "Journal entries"
  # Metadata
  mood: string
`;
      workspace.addDocument(schemaSource, { filename: "/schema.ptall" });

      // Step 2: Add multiple files using 'journal'
      const file1Source = `2026-01-05T18:00 create journal "Entry 1" #test
  mood: happy
`;
      const file2Source = `2026-01-05T18:01 create journal "Entry 2" #test
  mood: sad
`;
      const file3Source = `2026-01-05T18:02 create journal "Entry 3" #test
  mood: excited
`;
      workspace.addDocument(file1Source, { filename: "/file1.ptall" });
      workspace.addDocument(file2Source, { filename: "/file2.ptall" });
      workspace.addDocument(file3Source, { filename: "/file3.ptall" });

      const doc1 = createDocument(file1Source, "file:///file1.ptall");
      const doc2 = createDocument(file2Source, "file:///file2.ptall");
      const doc3 = createDocument(file3Source, "file:///file3.ptall");

      // Step 3: Verify no errors initially
      expect(
        getDiagnostics(workspace, doc1).find((d) => d.code === "unknown-entity"),
      ).toBeUndefined();
      expect(
        getDiagnostics(workspace, doc2).find((d) => d.code === "unknown-entity"),
      ).toBeUndefined();
      expect(
        getDiagnostics(workspace, doc3).find((d) => d.code === "unknown-entity"),
      ).toBeUndefined();

      // Step 4: Remove the entity definition
      workspace.addDocument("# Empty", { filename: "/schema.ptall" });

      // Step 5: All three files should now have errors
      expect(
        getDiagnostics(workspace, doc1).find((d) => d.code === "unknown-entity"),
      ).toBeDefined();
      expect(
        getDiagnostics(workspace, doc2).find((d) => d.code === "unknown-entity"),
      ).toBeDefined();
      expect(
        getDiagnostics(workspace, doc3).find((d) => d.code === "unknown-entity"),
      ).toBeDefined();
    });
  });
});
