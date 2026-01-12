import { describe, it, expect, beforeEach } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createWorkspace, Workspace } from "@rejot-dev/thalo/native";
import type { Position } from "vscode-languageserver";
import { handleDefinition } from "./definition.js";

/**
 * Create a TextDocument for testing
 */
function createDocument(content: string, uri = "file:///test.thalo"): TextDocument {
  return TextDocument.create(uri, "thalo", 1, content);
}

describe("handleDefinition", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();

    // Add a document with entries that can be linked to
    const source = `2026-01-05T18:00Z create lore "Test entry about TypeScript" ^ts-lore #typescript
  type: "fact"
  subject: ^self

  Some content.

2026-01-05T19:00Z create opinion "TypeScript enums are bad" ^enum-opinion #typescript
  confidence: "high"
  related: ^ts-lore

  # Claim
  Enums should be avoided.
`;
    workspace.addDocument(source, { filename: "/test.thalo" });
  });

  describe("link navigation", () => {
    it("should return definition location for explicit link ID", () => {
      // Document with cursor on ^ts-lore reference
      // Line 2: "  related: ^ts-lore" - ^ is at char 11, ts-lore ends at 19
      const source = `2026-01-06T10:00Z create lore "New entry" #test
  type: "fact"
  related: ^ts-lore
`;
      // Important: URI must match the filename in workspace for lookup to work
      const doc = createDocument(source, "file:///test2.thalo");
      workspace.addDocument(doc.getText(), { filename: "/test2.thalo" });

      // Position cursor in the middle of ^ts-lore (character 15 = middle of "ts-lore")
      const position: Position = { line: 2, character: 15 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///test.thalo");
      expect(result!.range.start.line).toBe(0);
    });

    it("should return null for timestamp link (timestamps are not link IDs)", () => {
      // Timestamps are not link IDs - only explicit ^link-id creates links
      const source = `2026-01-06T10:00Z create lore "New entry" #test
  type: "fact"
  related: ^2026-01-05T18:00Z
`;
      const doc = createDocument(source, "file:///test2.thalo");
      workspace.addDocument(doc.getText(), { filename: "/test2.thalo" });

      // Position cursor inside the timestamp link
      const position: Position = { line: 2, character: 20 };

      const result = handleDefinition(workspace, doc, position);

      // Should return null because timestamps are not valid link targets
      expect(result).toBeNull();
    });

    it("should return null when cursor is not on a link", () => {
      const doc = createDocument(`2026-01-06T10:00Z create lore "New entry" #test
  type: "fact"
  subject: ^test
`);
      workspace.addDocument(doc.getText(), { filename: "/test2.thalo" });

      // Position cursor on "type: "fact"" (no link)
      const position: Position = { line: 1, character: 5 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).toBeNull();
    });

    it("should return null for unresolved link", () => {
      const doc = createDocument(`2026-01-06T10:00Z create lore "New entry" #test
  type: "fact"
  related: ^nonexistent-link
`);
      workspace.addDocument(doc.getText(), { filename: "/test2.thalo" });

      // Position cursor on the nonexistent link
      const position: Position = { line: 2, character: 15 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).toBeNull();
    });

    it("should navigate from document not in workspace when link is defined", () => {
      // Create document but don't add to workspace
      // Navigation should still work because the link IS defined in the workspace
      const doc = createDocument(
        `2026-01-06T10:00Z create lore "New entry" #test
  related: ^ts-lore
`,
        "file:///not-in-workspace.thalo",
      );

      const position: Position = { line: 1, character: 12 };

      const result = handleDefinition(workspace, doc, position);

      // The link ^ts-lore is defined in the workspace, so navigation works
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///test.thalo");
    });
  });

  describe("cross-file navigation", () => {
    it("should navigate to definition in different file", () => {
      // Add another file that references the first
      const secondFile = `2026-01-06T10:00Z create journal "Reflection" #journal
  type: "reflection"
  subject: ^self
  related: ^enum-opinion
`;
      workspace.addDocument(secondFile, { filename: "/second.thalo" });

      const doc = createDocument(secondFile, "file:///second.thalo");

      // Position cursor on ^enum-opinion
      const position: Position = { line: 3, character: 12 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///test.thalo"); // Definition is in test.thalo
    });
  });

  describe("entity navigation", () => {
    it("should navigate from entity name to define-entity", () => {
      // Add a schema with entity definition
      const schemaSource = `2026-01-05T10:00Z define-entity custom "Custom entity"
  # Metadata
  name: string
`;
      workspace.addDocument(schemaSource, { filename: "/schema.thalo" });

      const instanceSource = `2026-01-06T10:00Z create custom "Test custom entry"
  name: test
`;
      const doc = createDocument(instanceSource, "file:///instance.thalo");
      workspace.addDocument(doc.getText(), { filename: "/instance.thalo" });

      // Position cursor on "custom" entity name in create line
      // "2026-01-06T10:00Z create custom" - custom starts at character 26
      const position: Position = { line: 0, character: 26 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///schema.thalo");
      expect(result!.range.start.line).toBe(0);
    });

    it("should navigate from alter-entity to define-entity", () => {
      const schemaSource = `2026-01-05T10:00Z define-entity lore "Facts and insights"
  # Metadata
  type: string
`;
      workspace.addDocument(schemaSource, { filename: "/schema.thalo" });

      const alterSource = `2026-01-06T10:00Z alter-entity lore "Add subject field"
  # Metadata
  subject: string
`;
      const doc = createDocument(alterSource, "file:///alter.thalo");
      workspace.addDocument(doc.getText(), { filename: "/alter.thalo" });

      // Position cursor on "lore" entity name in alter-entity line
      // "2026-01-06T10:00Z alter-entity lore" - lore starts at character 31
      const position: Position = { line: 0, character: 31 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///schema.thalo");
    });
  });

  describe("metadata key navigation", () => {
    it("should navigate from metadata key to field definition", () => {
      const schemaSource = `2026-01-05T10:00Z define-entity opinion "Stances"
  # Metadata
  confidence: "high" | "medium" | "low"
`;
      workspace.addDocument(schemaSource, { filename: "/schema.thalo" });

      const instanceSource = `2026-01-06T10:00Z create opinion "Test opinion"
  confidence: "high"
`;
      const doc = createDocument(instanceSource, "file:///instance.thalo");
      workspace.addDocument(doc.getText(), { filename: "/instance.thalo" });

      // Position cursor on "confidence" metadata key
      // "  confidence: "high"" - confidence starts at character 2
      const position: Position = { line: 1, character: 5 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///schema.thalo");
    });
  });

  describe("section header navigation", () => {
    it("should navigate from section header to section definition", () => {
      const schemaSource = `2026-01-05T10:00Z define-entity opinion "Stances"
  # Metadata
  confidence: string
  # Sections
  Claim
  Reasoning
`;
      workspace.addDocument(schemaSource, { filename: "/schema.thalo" });

      const instanceSource = `2026-01-06T10:00Z create opinion "Test opinion"
  confidence: "high"

  # Claim
  This is my claim.
`;
      const doc = createDocument(instanceSource, "file:///instance.thalo");
      workspace.addDocument(doc.getText(), { filename: "/instance.thalo" });

      // Position cursor on "Claim" section header
      // "  # Claim" - Claim starts at character 4
      const position: Position = { line: 3, character: 5 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///schema.thalo");
    });
  });

  describe("synthesis entry navigation", () => {
    it("should navigate from actualize-synthesis target to define-synthesis", () => {
      // Add a synthesis definition
      const synthesisSource = `2026-01-05T10:00Z define-synthesis "Career Summary" ^career-summary #career
  sources: lore where #career

  # Prompt
  Write a professional career summary.
`;
      workspace.addDocument(synthesisSource, { filename: "/synthesis.thalo" });

      // Create an actualize entry
      const actualizeSource = `2026-01-06T15:00Z actualize-synthesis ^career-summary
  updated: 2026-01-06T15:00Z
`;
      const doc = createDocument(actualizeSource, "file:///actualize.thalo");
      workspace.addDocument(doc.getText(), { filename: "/actualize.thalo" });

      // Position cursor on ^career-summary target link
      // "2026-01-06T15:00Z actualize-synthesis ^career-summary"
      // ^career-summary starts around character 37
      const position: Position = { line: 0, character: 45 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///synthesis.thalo");
      expect(result!.range.start.line).toBe(0);
    });

    it("should navigate from link reference to synthesis definition", () => {
      // Add a synthesis definition
      const synthesisSource = `2026-01-05T10:00Z define-synthesis "Career Summary" ^career-summary #career
  sources: lore where #career

  # Prompt
  Write a professional career summary.
`;
      workspace.addDocument(synthesisSource, { filename: "/synthesis.thalo" });

      // Reference the synthesis from another entry
      const referenceSource = `2026-01-06T12:00Z create lore "Related lore" #career
  type: "fact"
  related: ^career-summary
`;
      const doc = createDocument(referenceSource, "file:///reference.thalo");
      workspace.addDocument(doc.getText(), { filename: "/reference.thalo" });

      // Position cursor on ^career-summary
      const position: Position = { line: 2, character: 15 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///synthesis.thalo");
    });

    it("should return null for unresolved synthesis target", () => {
      const actualizeSource = `2026-01-06T15:00Z actualize-synthesis ^nonexistent-synthesis
  updated: 2026-01-06T15:00Z
`;
      const doc = createDocument(actualizeSource, "file:///actualize.thalo");
      workspace.addDocument(doc.getText(), { filename: "/actualize.thalo" });

      // Position cursor on the nonexistent link
      const position: Position = { line: 0, character: 45 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle cursor inside link text", () => {
      // "  related: ^ts-lore" - ^ at 11, ts-lore is 12-18
      const doc = createDocument(`  related: ^ts-lore`, "file:///test2.thalo");
      workspace.addDocument(doc.getText(), { filename: "/test2.thalo" });

      // Position inside "ts-lore" (character 14)
      const position: Position = { line: 0, character: 14 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
    });

    it("should handle cursor at end of link", () => {
      // "  related: ^ts-lore" is 19 chars, ^ at 11, link ends at 19
      const doc = createDocument(`  related: ^ts-lore`, "file:///test2.thalo");
      workspace.addDocument(doc.getText(), { filename: "/test2.thalo" });

      // Position at the last char of link (18 = 'e' in lore)
      const position: Position = { line: 0, character: 18 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
    });

    it("should handle empty workspace", () => {
      const emptyWorkspace = createWorkspace();
      const doc = createDocument(`  related: ^ts-lore`, "file:///empty.thalo");
      emptyWorkspace.addDocument(doc.getText(), { filename: "/empty.thalo" });

      const position: Position = { line: 0, character: 15 };

      const result = handleDefinition(emptyWorkspace, doc, position);

      // Link exists but definition doesn't
      expect(result).toBeNull();
    });
  });
});
