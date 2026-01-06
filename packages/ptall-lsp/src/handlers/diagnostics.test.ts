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
});
