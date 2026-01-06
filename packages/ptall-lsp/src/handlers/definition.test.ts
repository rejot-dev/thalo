import { describe, it, expect, beforeEach } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Workspace } from "@wilco/ptall";
import type { Position } from "vscode-languageserver";
import { handleDefinition } from "./definition.js";

/**
 * Create a TextDocument for testing
 */
function createDocument(content: string, uri = "file:///test.ptall"): TextDocument {
  return TextDocument.create(uri, "ptall", 1, content);
}

describe("handleDefinition", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();

    // Add a document with entries that can be linked to
    const source = `2026-01-05T18:00 create lore "Test entry about TypeScript" ^ts-lore #typescript
  type: fact
  subject: ^self

  Some content.

2026-01-05T19:00 create opinion "TypeScript enums are bad" ^enum-opinion #typescript
  confidence: high
  related: ^ts-lore

  # Claim
  Enums should be avoided.
`;
    workspace.addDocument(source, { filename: "/test.ptall" });
  });

  describe("link navigation", () => {
    it("should return definition location for explicit link ID", () => {
      // Document with cursor on ^ts-lore reference
      // Line 2: "  related: ^ts-lore" - ^ is at char 11, ts-lore ends at 19
      const source = `2026-01-06T10:00 create lore "New entry" #test
  type: fact
  related: ^ts-lore
`;
      // Important: URI must match the filename in workspace for lookup to work
      const doc = createDocument(source, "file:///test2.ptall");
      workspace.addDocument(doc.getText(), { filename: "/test2.ptall" });

      // Position cursor in the middle of ^ts-lore (character 15 = middle of "ts-lore")
      const position: Position = { line: 2, character: 15 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///test.ptall");
      expect(result!.range.start.line).toBe(0);
    });

    it("should return definition location for timestamp link", () => {
      // Timestamp links like "^2026-01-05T18:00" should be fully matched
      const source = `2026-01-06T10:00 create lore "New entry" #test
  type: fact
  related: ^2026-01-05T18:00
`;
      const doc = createDocument(source, "file:///test2.ptall");
      workspace.addDocument(doc.getText(), { filename: "/test2.ptall" });

      // Position cursor inside the timestamp link
      const position: Position = { line: 2, character: 20 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///test.ptall");
    });

    it("should return null when cursor is not on a link", () => {
      const doc = createDocument(`2026-01-06T10:00 create lore "New entry" #test
  type: fact
  subject: test
`);
      workspace.addDocument(doc.getText(), { filename: "/test2.ptall" });

      // Position cursor on "type: fact" (no link)
      const position: Position = { line: 1, character: 5 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).toBeNull();
    });

    it("should return null for unresolved link", () => {
      const doc = createDocument(`2026-01-06T10:00 create lore "New entry" #test
  type: fact
  related: ^nonexistent-link
`);
      workspace.addDocument(doc.getText(), { filename: "/test2.ptall" });

      // Position cursor on the nonexistent link
      const position: Position = { line: 2, character: 15 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).toBeNull();
    });

    it("should return null when document is not in workspace", () => {
      // Create document but don't add to workspace
      const doc = createDocument(
        `2026-01-06T10:00 create lore "New entry" #test
  related: ^ts-lore
`,
        "file:///not-in-workspace.ptall",
      );

      const position: Position = { line: 1, character: 12 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).toBeNull();
    });
  });

  describe("cross-file navigation", () => {
    it("should navigate to definition in different file", () => {
      // Add another file that references the first
      const secondFile = `2026-01-06T10:00 create journal "Reflection" #journal
  type: reflection
  subject: ^self
  related: ^enum-opinion
`;
      workspace.addDocument(secondFile, { filename: "/second.ptall" });

      const doc = createDocument(secondFile, "file:///second.ptall");

      // Position cursor on ^enum-opinion
      const position: Position = { line: 3, character: 12 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///test.ptall"); // Definition is in test.ptall
    });
  });

  describe("edge cases", () => {
    it("should handle cursor inside link text", () => {
      // "  related: ^ts-lore" - ^ at 11, ts-lore is 12-18
      const doc = createDocument(`  related: ^ts-lore`, "file:///test2.ptall");
      workspace.addDocument(doc.getText(), { filename: "/test2.ptall" });

      // Position inside "ts-lore" (character 14)
      const position: Position = { line: 0, character: 14 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
    });

    it("should handle cursor at end of link", () => {
      // "  related: ^ts-lore" is 19 chars, ^ at 11, link ends at 19
      const doc = createDocument(`  related: ^ts-lore`, "file:///test2.ptall");
      workspace.addDocument(doc.getText(), { filename: "/test2.ptall" });

      // Position at the last char of link (18 = 'e' in lore)
      const position: Position = { line: 0, character: 18 };

      const result = handleDefinition(workspace, doc, position);

      expect(result).not.toBeNull();
    });

    it("should handle empty workspace", () => {
      const emptyWorkspace = new Workspace();
      const doc = createDocument(`  related: ^ts-lore`, "file:///empty.ptall");
      emptyWorkspace.addDocument(doc.getText(), { filename: "/empty.ptall" });

      const position: Position = { line: 0, character: 15 };

      const result = handleDefinition(emptyWorkspace, doc, position);

      // Link exists but definition doesn't
      expect(result).toBeNull();
    });
  });
});
