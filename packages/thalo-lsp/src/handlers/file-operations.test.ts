import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { TextDocument } from "vscode-languageserver-textdocument";
import { initParser, createWorkspace, Workspace } from "@rejot-dev/thalo/node";

// Initialize parser once for all tests
beforeAll(async () => {
  await initParser();
});
import type { Position } from "vscode-languageserver";
import { handleDefinition } from "./definition.js";
import { handleReferences } from "./references.js";

/**
 * These tests verify that file operations (create, delete, rename) are properly
 * handled by the LSP server, ensuring cross-file features like go-to-definition
 * work correctly when files are created externally (e.g., via Save As).
 */

/**
 * Create a TextDocument for testing
 */
function createDocument(content: string, uri = "file:///test.thalo"): TextDocument {
  return TextDocument.create(uri, "thalo", 1, content);
}

/**
 * Convert a file path to a URI
 */
function pathToUri(filePath: string): string {
  return `file://${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;
}

describe("file operations - cross-file definition resolution", () => {
  let workspace: Workspace;
  let tempDir: string;

  beforeEach(() => {
    workspace = createWorkspace();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "thalo-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("file creation scenarios", () => {
    it("should find definition after new file is added to workspace", () => {
      // Scenario: User has file A with a reference to ^new-entry.
      // User creates file B with ^new-entry definition via Save As.
      // The LSP should find the definition after the new file is loaded.

      // File A references ^new-entry (but definition doesn't exist yet)
      const fileAContent = `2026-01-06T10:00Z create lore "Referencing entry" #test
  type: "fact"
  related: ^new-entry
`;
      workspace.addDocument(fileAContent, { filename: "/file-a.thalo" });

      // Definition shouldn't be found yet
      const docA = createDocument(fileAContent, "file:///file-a.thalo");
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).toBeNull();

      // Now "create" file B with the definition (simulating Save As / external creation)
      const fileBContent = `2026-01-06T12:00Z create lore "The new entry" ^new-entry #test
  type: "fact"
  subject: ^self
`;
      workspace.addDocument(fileBContent, { filename: "/file-b.thalo" });

      // Now definition should be found
      result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///file-b.thalo");
      expect(result!.range.start.line).toBe(0);
    });

    it("should resolve references across files after new file is added", () => {
      // Create file A with a definition
      const fileAContent = `2026-01-06T10:00Z create lore "Original entry" ^original-entry #test
  type: "fact"
`;
      workspace.addDocument(fileAContent, { filename: "/file-a.thalo" });

      // Create file B that references the definition in file A
      const fileBContent = `2026-01-06T12:00Z create lore "Referencing entry" #test
  type: "fact"
  related: ^original-entry
`;
      workspace.addDocument(fileBContent, { filename: "/file-b.thalo" });

      // Find references should include both files
      const docA = createDocument(fileAContent, "file:///file-a.thalo");
      const positionOnLink: Position = { line: 0, character: 50 }; // on ^original-entry
      const result = handleReferences(workspace, docA, positionOnLink, {
        includeDeclaration: true,
      });

      expect(result).not.toBeNull();
      expect(result!.length).toBe(2); // definition + reference
    });

    it("should handle schema definition in external file", () => {
      // File A uses a custom entity type
      const fileAContent = `2026-01-06T10:00Z create custom "Test instance" #test
  name: test value
`;
      workspace.addDocument(fileAContent, { filename: "/instance.thalo" });

      // Initially, the entity 'custom' is not defined
      const docA = createDocument(fileAContent, "file:///instance.thalo");
      const positionOnEntity: Position = { line: 0, character: 26 }; // on 'custom'
      let result = handleDefinition(workspace, docA, positionOnEntity);
      expect(result).toBeNull();

      // Add schema file with define-entity
      const schemaContent = `2026-01-05T10:00Z define-entity custom "Custom entity type"
  # Metadata
  name: string
`;
      workspace.addDocument(schemaContent, { filename: "/schema.thalo" });

      // Now definition should be found
      result = handleDefinition(workspace, docA, positionOnEntity);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///schema.thalo");
    });
  });

  describe("file deletion scenarios", () => {
    it("should not find definition after file is removed from workspace", () => {
      // Add file A with reference
      const fileAContent = `2026-01-06T10:00Z create lore "Referencing entry" #test
  type: "fact"
  related: ^deleted-entry
`;
      workspace.addDocument(fileAContent, { filename: "/file-a.thalo" });

      // Add file B with definition
      const fileBContent = `2026-01-06T12:00Z create lore "Entry to be deleted" ^deleted-entry #test
  type: "fact"
`;
      workspace.addDocument(fileBContent, { filename: "/file-b.thalo" });

      // Definition should be found
      const docA = createDocument(fileAContent, "file:///file-a.thalo");
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).not.toBeNull();

      // Remove file B (simulating deletion)
      workspace.removeDocument("/file-b.thalo");

      // Definition should no longer be found
      result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).toBeNull();
    });
  });

  describe("file rename scenarios", () => {
    it("should find definition after file is renamed (old path removed, new path added)", () => {
      // Add file A with reference
      const fileAContent = `2026-01-06T10:00Z create lore "Referencing entry" #test
  type: "fact"
  related: ^renamed-entry
`;
      workspace.addDocument(fileAContent, { filename: "/file-a.thalo" });

      // Add file B with definition at old path
      const fileBContent = `2026-01-06T12:00Z create lore "Entry that will be renamed" ^renamed-entry #test
  type: "fact"
`;
      workspace.addDocument(fileBContent, { filename: "/old-name.thalo" });

      // Definition should be found at old location
      const docA = createDocument(fileAContent, "file:///file-a.thalo");
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///old-name.thalo");

      // Simulate rename: remove old, add new
      workspace.removeDocument("/old-name.thalo");
      workspace.addDocument(fileBContent, { filename: "/new-name.thalo" });

      // Definition should be found at new location
      result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///new-name.thalo");
    });
  });

  describe("copy content to new file scenario", () => {
    it("should find definition when link-id is copied to new file", () => {
      // This is the exact user scenario:
      // 1. User has entry A with ^link-id
      // 2. User copies the entry to a new file B
      // 3. Go-to-definition from a reference to ^link-id should find it in file B

      // Original file with the entry
      const originalContent = `2026-01-06T10:00Z create lore "Entry with link" ^my-link #test
  type: "fact"
`;
      workspace.addDocument(originalContent, { filename: "/original.thalo" });

      // Another file that references the link
      const referencingContent = `2026-01-06T11:00Z create lore "Referencing entry" #test
  type: "fact"
  related: ^my-link
`;
      workspace.addDocument(referencingContent, { filename: "/referencing.thalo" });

      // Initially, definition is in original.thalo
      const refDoc = createDocument(referencingContent, "file:///referencing.thalo");
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(workspace, refDoc, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///original.thalo");

      // User copies the entry to a new file (Save As)
      // The new file has the same content with the ^my-link definition
      const copiedContent = `2026-01-06T10:00Z create lore "Entry with link" ^my-link #test
  type: "fact"
`;
      workspace.addDocument(copiedContent, { filename: "/copied.thalo" });

      // Now there are two definitions - the first one found should be returned
      result = handleDefinition(workspace, refDoc, positionOnLink);
      expect(result).not.toBeNull();
      // The definition should be found (either file is valid)
      expect(["file:///original.thalo", "file:///copied.thalo"]).toContain(result!.uri);
    });

    it("should find new definition after original is removed", () => {
      // Start with original file only
      const originalContent = `2026-01-06T10:00Z create lore "Original entry" ^moved-link #test
  type: "fact"
`;
      workspace.addDocument(originalContent, { filename: "/original.thalo" });

      const referencingContent = `2026-01-06T11:00Z create lore "Referencing entry" #test
  type: "fact"
  related: ^moved-link
`;
      workspace.addDocument(referencingContent, { filename: "/referencing.thalo" });

      // Simulate: user moves entry to new file (copies then deletes original)
      const movedContent = `2026-01-06T10:00Z create lore "Original entry" ^moved-link #test
  type: "fact"
`;
      workspace.addDocument(movedContent, { filename: "/new-location.thalo" });
      workspace.removeDocument("/original.thalo");

      // Definition should now be found in the new location
      const refDoc = createDocument(referencingContent, "file:///referencing.thalo");
      const positionOnLink: Position = { line: 2, character: 15 };
      const result = handleDefinition(workspace, refDoc, positionOnLink);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///new-location.thalo");
    });
  });

  describe("real file system integration", () => {
    it("should work with files on disk", () => {
      // Create a real file on disk
      const filePath = path.join(tempDir, "test.thalo");
      const content = `2026-01-06T10:00Z create lore "Disk-based entry" ^disk-entry #test
  type: "fact"
`;
      fs.writeFileSync(filePath, content);

      // Load it into workspace
      const source = fs.readFileSync(filePath, "utf-8");
      workspace.addDocument(source, { filename: filePath, fileType: "thalo" });

      // Create another file that references it
      const refPath = path.join(tempDir, "ref.thalo");
      const refContent = `2026-01-06T11:00Z create lore "Referencing entry" #test
  type: "fact"
  related: ^disk-entry
`;
      fs.writeFileSync(refPath, refContent);
      workspace.addDocument(refContent, { filename: refPath, fileType: "thalo" });

      // Go-to-definition should work
      const refDoc = createDocument(refContent, pathToUri(refPath));
      const positionOnLink: Position = { line: 2, character: 15 };
      const result = handleDefinition(workspace, refDoc, positionOnLink);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe(pathToUri(filePath));
    });

    it("should handle file creation on disk", () => {
      // Start with a reference file
      const refPath = path.join(tempDir, "ref.thalo");
      const refContent = `2026-01-06T11:00Z create lore "Referencing entry" #test
  type: "fact"
  related: ^future-entry
`;
      fs.writeFileSync(refPath, refContent);
      workspace.addDocument(refContent, { filename: refPath, fileType: "thalo" });

      // Definition doesn't exist yet
      const refDoc = createDocument(refContent, pathToUri(refPath));
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(workspace, refDoc, positionOnLink);
      expect(result).toBeNull();

      // Create the definition file on disk (simulating Save As)
      const defPath = path.join(tempDir, "definition.thalo");
      const defContent = `2026-01-06T10:00Z create lore "Future entry" ^future-entry #test
  type: "fact"
`;
      fs.writeFileSync(defPath, defContent);

      // Simulate the file watcher notification: load the new file
      const source = fs.readFileSync(defPath, "utf-8");
      workspace.addDocument(source, { filename: defPath, fileType: "thalo" });

      // Now definition should be found
      result = handleDefinition(workspace, refDoc, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe(pathToUri(defPath));
    });
  });
});
