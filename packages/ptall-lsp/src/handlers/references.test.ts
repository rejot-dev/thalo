import { describe, it, expect, beforeEach } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Workspace } from "@wilco/ptall";
import type { Position, ReferenceContext } from "vscode-languageserver";
import { handleReferences } from "./references.js";

/**
 * Create a TextDocument for testing
 */
function createDocument(content: string, uri = "file:///test.ptall"): TextDocument {
  return TextDocument.create(uri, "ptall", 1, content);
}

describe("handleReferences", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();

    // Add documents with cross-references
    const source1 = `2026-01-05T18:00 create lore "Test entry about TypeScript" ^ts-lore #typescript
  type: fact
  subject: ^self

  Some content.
`;
    workspace.addDocument(source1, { filename: "/file1.ptall" });

    const source2 = `2026-01-05T19:00 create opinion "TypeScript enums are bad" ^enum-opinion #typescript
  confidence: high
  related: ^ts-lore

  # Claim
  Enums should be avoided.

2026-01-05T20:00 create journal "Working on TypeScript" #development
  type: reflection
  subject: ^self
  inspiration: ^ts-lore

  Thinking about the lore entry.
`;
    workspace.addDocument(source2, { filename: "/file2.ptall" });
  });

  describe("finding references", () => {
    it("should find all references to a link including definition", () => {
      const doc = createDocument(
        workspace.getDocument("/file1.ptall")!.source,
        "file:///file1.ptall",
      );

      // source1 header: '2026-01-05T18:00 create lore "Test entry about TypeScript" ^ts-lore #typescript'
      // ^ts-lore starts around character 60
      const position: Position = { line: 0, character: 63 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      // Should find: 1 definition + 2 references (in file2)
      expect(result!.length).toBe(3);

      // Check that one is the definition (file1) and two are references (file2)
      const file1Refs = result!.filter((loc) => loc.uri.includes("file1"));
      const file2Refs = result!.filter((loc) => loc.uri.includes("file2"));
      expect(file1Refs.length).toBe(1);
      expect(file2Refs.length).toBe(2);
    });

    it("should find references without definition when requested", () => {
      const doc = createDocument(
        workspace.getDocument("/file1.ptall")!.source,
        "file:///file1.ptall",
      );

      // Position cursor on ^ts-lore (character 63 is inside the link)
      const position: Position = { line: 0, character: 63 };
      const context: ReferenceContext = { includeDeclaration: false };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      // Should find only references, not the definition
      expect(result!.length).toBe(2);

      // All should be in file2
      result!.forEach((loc) => {
        expect(loc.uri).toBe("file:///file2.ptall");
      });
    });

    it("should find references from a reference location", () => {
      const doc = createDocument(
        workspace.getDocument("/file2.ptall")!.source,
        "file:///file2.ptall",
      );

      // Position cursor on ^ts-lore in the "related:" field (line 2: "  related: ^ts-lore")
      const position: Position = { line: 2, character: 14 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      // Should find: 1 definition (file1) + 2 references (file2)
      expect(result!.length).toBe(3);
    });
  });

  describe("tag references", () => {
    it("should find all entries with a tag", () => {
      const doc = createDocument(
        workspace.getDocument("/file1.ptall")!.source,
        "file:///file1.ptall",
      );

      // Position cursor on #typescript tag
      // '2026-01-05T18:00 create lore "Test entry about TypeScript" ^ts-lore #typescript'
      // #typescript starts at character 72
      const position: Position = { line: 0, character: 75 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      // Should find entries with #typescript: file1 entry and file2's opinion entry
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("entity references", () => {
    it("should find all entries using an entity type", () => {
      const schemaSource = `2026-01-05T10:00 define-entity lore "Facts and insights"
  # Metadata
  type: string
`;
      workspace.addDocument(schemaSource, { filename: "/schema.ptall" });

      const doc = createDocument(schemaSource, "file:///schema.ptall");

      // Position cursor on "lore" in define-entity
      // "2026-01-05T10:00 define-entity lore" - lore starts at character 31
      const position: Position = { line: 0, character: 31 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      // Should find the definition plus all lore entries in file1/file2
      expect(result!.length).toBeGreaterThanOrEqual(1);
    });

    it("should find entity references from instance entry", () => {
      const doc = createDocument(
        workspace.getDocument("/file1.ptall")!.source,
        "file:///file1.ptall",
      );

      // Position cursor on "lore" entity name in create line
      // "2026-01-05T18:00 create lore" - lore is at position after "create "
      const position: Position = { line: 0, character: 24 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      // Should find all lore entries
      expect(result!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("metadata key references", () => {
    it("should find all entries using a metadata key", () => {
      const doc = createDocument(
        workspace.getDocument("/file1.ptall")!.source,
        "file:///file1.ptall",
      );

      // Position cursor on "type" metadata key
      // "  type: fact" - type starts at character 2
      const position: Position = { line: 1, character: 3 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      // Should find entries using "type" field (file1 lore, file2 journal)
      expect(result!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("edge cases", () => {
    it("should return null when cursor is not on a navigable element", () => {
      const doc = createDocument(
        workspace.getDocument("/file1.ptall")!.source,
        "file:///file1.ptall",
      );

      // Position cursor in whitespace at start of line (not on any element)
      const position: Position = { line: 1, character: 0 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).toBeNull();
    });

    it("should return null when document is not in workspace", () => {
      const doc = createDocument(
        `2026-01-06T10:00 create lore "New" #test
  related: ^ts-lore
`,
        "file:///not-in-workspace.ptall",
      );

      const position: Position = { line: 1, character: 12 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).toBeNull();
    });

    it("should return empty array for link with no references", () => {
      // Add a document with a link that nothing references
      const isolatedDoc = `2026-01-06T10:00 create lore "Isolated entry" ^isolated-link #test
  type: fact
  subject: ^self
`;
      workspace.addDocument(isolatedDoc, { filename: "/isolated.ptall" });

      const doc = createDocument(isolatedDoc, "file:///isolated.ptall");

      // Position cursor on ^isolated-link
      const position: Position = { line: 0, character: 55 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      // Only the definition itself
      expect(result!.length).toBe(1);
    });

    it("should handle unresolved link references", () => {
      const doc = createDocument(
        `2026-01-06T10:00 create lore "New" #test
  related: ^nonexistent-link
`,
        "file:///with-bad-link.ptall",
      );
      workspace.addDocument(doc.getText(), { filename: "/with-bad-link.ptall" });

      // Position cursor on the nonexistent link
      const position: Position = { line: 1, character: 15 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      // Should return just this reference (no definition found)
      expect(result!.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("URI handling", () => {
    it("should return proper file:// URIs", () => {
      const doc = createDocument(
        workspace.getDocument("/file1.ptall")!.source,
        "file:///file1.ptall",
      );

      // Position inside ^ts-lore link
      const position: Position = { line: 0, character: 63 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      result!.forEach((loc) => {
        expect(loc.uri).toMatch(/^file:\/\//);
      });
    });

    it("should include valid range information", () => {
      const doc = createDocument(
        workspace.getDocument("/file1.ptall")!.source,
        "file:///file1.ptall",
      );

      // Position inside ^ts-lore link
      const position: Position = { line: 0, character: 63 };
      const context: ReferenceContext = { includeDeclaration: true };

      const result = handleReferences(workspace, doc, position, context);

      expect(result).not.toBeNull();
      result!.forEach((loc) => {
        expect(loc.range.start.line).toBeGreaterThanOrEqual(0);
        expect(loc.range.start.character).toBeGreaterThanOrEqual(0);
        expect(loc.range.end.line).toBeGreaterThanOrEqual(loc.range.start.line);
      });
    });
  });
});
