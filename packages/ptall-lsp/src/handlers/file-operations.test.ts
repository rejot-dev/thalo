import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Workspace } from "@wilco/ptall";
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
function createDocument(content: string, uri = "file:///test.ptall"): TextDocument {
  return TextDocument.create(uri, "ptall", 1, content);
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
    workspace = new Workspace();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptall-test-"));
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
      const fileAContent = `2026-01-06T10:00 create lore "Referencing entry" #test
  type: "fact"
  related: ^new-entry
`;
      workspace.addDocument(fileAContent, { filename: "/file-a.ptall" });

      // Definition shouldn't be found yet
      const docA = createDocument(fileAContent, "file:///file-a.ptall");
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).toBeNull();

      // Now "create" file B with the definition (simulating Save As / external creation)
      const fileBContent = `2026-01-06T12:00 create lore "The new entry" ^new-entry #test
  type: "fact"
  subject: ^self
`;
      workspace.addDocument(fileBContent, { filename: "/file-b.ptall" });

      // Now definition should be found
      result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///file-b.ptall");
      expect(result!.range.start.line).toBe(0);
    });

    it("should resolve references across files after new file is added", () => {
      // Create file A with a definition
      const fileAContent = `2026-01-06T10:00 create lore "Original entry" ^original-entry #test
  type: "fact"
`;
      workspace.addDocument(fileAContent, { filename: "/file-a.ptall" });

      // Create file B that references the definition in file A
      const fileBContent = `2026-01-06T12:00 create lore "Referencing entry" #test
  type: "fact"
  related: ^original-entry
`;
      workspace.addDocument(fileBContent, { filename: "/file-b.ptall" });

      // Find references should include both files
      const docA = createDocument(fileAContent, "file:///file-a.ptall");
      const positionOnLink: Position = { line: 0, character: 50 }; // on ^original-entry
      const result = handleReferences(workspace, docA, positionOnLink, {
        includeDeclaration: true,
      });

      expect(result).not.toBeNull();
      expect(result!.length).toBe(2); // definition + reference
    });

    it("should handle schema definition in external file", () => {
      // File A uses a custom entity type
      const fileAContent = `2026-01-06T10:00 create custom "Test instance" #test
  name: test value
`;
      workspace.addDocument(fileAContent, { filename: "/instance.ptall" });

      // Initially, the entity 'custom' is not defined
      const docA = createDocument(fileAContent, "file:///instance.ptall");
      const positionOnEntity: Position = { line: 0, character: 24 }; // on 'custom'
      let result = handleDefinition(workspace, docA, positionOnEntity);
      expect(result).toBeNull();

      // Add schema file with define-entity
      const schemaContent = `2026-01-05T10:00 define-entity custom "Custom entity type"
  # Metadata
  name: string
`;
      workspace.addDocument(schemaContent, { filename: "/schema.ptall" });

      // Now definition should be found
      result = handleDefinition(workspace, docA, positionOnEntity);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///schema.ptall");
    });
  });

  describe("file deletion scenarios", () => {
    it("should not find definition after file is removed from workspace", () => {
      // Add file A with reference
      const fileAContent = `2026-01-06T10:00 create lore "Referencing entry" #test
  type: "fact"
  related: ^deleted-entry
`;
      workspace.addDocument(fileAContent, { filename: "/file-a.ptall" });

      // Add file B with definition
      const fileBContent = `2026-01-06T12:00 create lore "Entry to be deleted" ^deleted-entry #test
  type: "fact"
`;
      workspace.addDocument(fileBContent, { filename: "/file-b.ptall" });

      // Definition should be found
      const docA = createDocument(fileAContent, "file:///file-a.ptall");
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).not.toBeNull();

      // Remove file B (simulating deletion)
      workspace.removeDocument("/file-b.ptall");

      // Definition should no longer be found
      result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).toBeNull();
    });
  });

  describe("file rename scenarios", () => {
    it("should find definition after file is renamed (old path removed, new path added)", () => {
      // Add file A with reference
      const fileAContent = `2026-01-06T10:00 create lore "Referencing entry" #test
  type: "fact"
  related: ^renamed-entry
`;
      workspace.addDocument(fileAContent, { filename: "/file-a.ptall" });

      // Add file B with definition at old path
      const fileBContent = `2026-01-06T12:00 create lore "Entry that will be renamed" ^renamed-entry #test
  type: "fact"
`;
      workspace.addDocument(fileBContent, { filename: "/old-name.ptall" });

      // Definition should be found at old location
      const docA = createDocument(fileAContent, "file:///file-a.ptall");
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///old-name.ptall");

      // Simulate rename: remove old, add new
      workspace.removeDocument("/old-name.ptall");
      workspace.addDocument(fileBContent, { filename: "/new-name.ptall" });

      // Definition should be found at new location
      result = handleDefinition(workspace, docA, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///new-name.ptall");
    });
  });

  describe("copy content to new file scenario", () => {
    it("should find definition when link-id is copied to new file", () => {
      // This is the exact user scenario:
      // 1. User has entry A with ^link-id
      // 2. User copies the entry to a new file B
      // 3. Go-to-definition from a reference to ^link-id should find it in file B

      // Original file with the entry
      const originalContent = `2026-01-06T10:00 create lore "Entry with link" ^my-link #test
  type: "fact"
`;
      workspace.addDocument(originalContent, { filename: "/original.ptall" });

      // Another file that references the link
      const referencingContent = `2026-01-06T11:00 create lore "Referencing entry" #test
  type: "fact"
  related: ^my-link
`;
      workspace.addDocument(referencingContent, { filename: "/referencing.ptall" });

      // Initially, definition is in original.ptall
      const refDoc = createDocument(referencingContent, "file:///referencing.ptall");
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(workspace, refDoc, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///original.ptall");

      // User copies the entry to a new file (Save As)
      // The new file has the same content with the ^my-link definition
      const copiedContent = `2026-01-06T10:00 create lore "Entry with link" ^my-link #test
  type: "fact"
`;
      workspace.addDocument(copiedContent, { filename: "/copied.ptall" });

      // Now there are two definitions - the first one found should be returned
      result = handleDefinition(workspace, refDoc, positionOnLink);
      expect(result).not.toBeNull();
      // The definition should be found (either file is valid)
      expect(["file:///original.ptall", "file:///copied.ptall"]).toContain(result!.uri);
    });

    it("should find new definition after original is removed", () => {
      // Start with original file only
      const originalContent = `2026-01-06T10:00 create lore "Original entry" ^moved-link #test
  type: "fact"
`;
      workspace.addDocument(originalContent, { filename: "/original.ptall" });

      const referencingContent = `2026-01-06T11:00 create lore "Referencing entry" #test
  type: "fact"
  related: ^moved-link
`;
      workspace.addDocument(referencingContent, { filename: "/referencing.ptall" });

      // Simulate: user moves entry to new file (copies then deletes original)
      const movedContent = `2026-01-06T10:00 create lore "Original entry" ^moved-link #test
  type: "fact"
`;
      workspace.addDocument(movedContent, { filename: "/new-location.ptall" });
      workspace.removeDocument("/original.ptall");

      // Definition should now be found in the new location
      const refDoc = createDocument(referencingContent, "file:///referencing.ptall");
      const positionOnLink: Position = { line: 2, character: 15 };
      const result = handleDefinition(workspace, refDoc, positionOnLink);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///new-location.ptall");
    });
  });

  describe("real file system integration", () => {
    it("should work with files on disk", () => {
      // Create a real file on disk
      const filePath = path.join(tempDir, "test.ptall");
      const content = `2026-01-06T10:00 create lore "Disk-based entry" ^disk-entry #test
  type: "fact"
`;
      fs.writeFileSync(filePath, content);

      // Load it into workspace
      const source = fs.readFileSync(filePath, "utf-8");
      workspace.addDocument(source, { filename: filePath, fileType: "ptall" });

      // Create another file that references it
      const refPath = path.join(tempDir, "ref.ptall");
      const refContent = `2026-01-06T11:00 create lore "Referencing entry" #test
  type: "fact"
  related: ^disk-entry
`;
      fs.writeFileSync(refPath, refContent);
      workspace.addDocument(refContent, { filename: refPath, fileType: "ptall" });

      // Go-to-definition should work
      const refDoc = createDocument(refContent, pathToUri(refPath));
      const positionOnLink: Position = { line: 2, character: 15 };
      const result = handleDefinition(workspace, refDoc, positionOnLink);

      expect(result).not.toBeNull();
      expect(result!.uri).toBe(pathToUri(filePath));
    });

    it("should handle file creation on disk", () => {
      // Start with a reference file
      const refPath = path.join(tempDir, "ref.ptall");
      const refContent = `2026-01-06T11:00 create lore "Referencing entry" #test
  type: "fact"
  related: ^future-entry
`;
      fs.writeFileSync(refPath, refContent);
      workspace.addDocument(refContent, { filename: refPath, fileType: "ptall" });

      // Definition doesn't exist yet
      const refDoc = createDocument(refContent, pathToUri(refPath));
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(workspace, refDoc, positionOnLink);
      expect(result).toBeNull();

      // Create the definition file on disk (simulating Save As)
      const defPath = path.join(tempDir, "definition.ptall");
      const defContent = `2026-01-06T10:00 create lore "Future entry" ^future-entry #test
  type: "fact"
`;
      fs.writeFileSync(defPath, defContent);

      // Simulate the file watcher notification: load the new file
      const source = fs.readFileSync(defPath, "utf-8");
      workspace.addDocument(source, { filename: defPath, fileType: "ptall" });

      // Now definition should be found
      result = handleDefinition(workspace, refDoc, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe(pathToUri(defPath));
    });
  });
});
