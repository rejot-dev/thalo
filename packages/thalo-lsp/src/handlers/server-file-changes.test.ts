import { describe, it, expect, beforeEach } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { FileChangeType } from "vscode-languageserver";
import { createWorkspace, Workspace } from "@rejot-dev/thalo/native";
import { handleDefinition } from "./definition.js";
import type { Position } from "vscode-languageserver";

/**
 * These tests verify the server's file change handling logic.
 *
 * The server maintains two data structures:
 * 1. `state.documents` - Map of open documents (URI -> TextDocument)
 * 2. `state.workspace` - Workspace model containing all files
 *
 * When handling `onDidChangeWatchedFiles`:
 * - For Create/Changed events: skip if file is open (document sync handles it)
 * - For Deleted events: ALWAYS process, even if file is open
 *
 * This is because VSCode may keep deleted file tabs open, but the workspace
 * model should immediately reflect reality.
 */

/**
 * Simulates the server state for testing file change handling
 */
class MockServerState {
  workspace: Workspace;
  documents: Map<string, TextDocument>;

  constructor() {
    this.workspace = createWorkspace();
    this.documents = new Map();
  }

  /**
   * Simulate opening a document (like onDidOpenTextDocument)
   */
  openDocument(uri: string, content: string): void {
    const doc = TextDocument.create(uri, "thalo", 1, content);
    this.documents.set(uri, doc);

    // Also add to workspace
    const filePath = uriToPath(uri);
    this.workspace.addDocument(content, { filename: filePath, fileType: "thalo" });
  }

  /**
   * Simulate the fixed file change handling logic from server.ts
   * Returns true if the change was processed, false if skipped
   */
  handleFileChange(uri: string, changeType: FileChangeType, fileContent?: string): boolean {
    const filePath = uriToPath(uri);

    // Only process thalo and markdown files
    if (!filePath.endsWith(".thalo") && !filePath.endsWith(".md")) {
      return false;
    }

    // For delete events, always process - even if file is open in editor
    // (VSCode may keep deleted file tabs open, but workspace should reflect reality)
    if (changeType === FileChangeType.Deleted) {
      this.workspace.removeDocument(filePath);
      this.documents.delete(uri);
      return true;
    }

    // Skip create/change if the file is currently open (handled by document lifecycle)
    if (this.documents.has(uri)) {
      return false;
    }

    // Process create/change for non-open files
    if (changeType === FileChangeType.Created || changeType === FileChangeType.Changed) {
      if (fileContent) {
        this.workspace.updateDocument(filePath, fileContent);
        return true;
      }
    }

    return false;
  }
}

function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return decodeURIComponent(uri.slice(7));
  }
  return uri;
}

function createDocument(content: string, uri: string): TextDocument {
  return TextDocument.create(uri, "thalo", 1, content);
}

describe("server file change handling", () => {
  let state: MockServerState;

  beforeEach(() => {
    state = new MockServerState();
  });

  describe("file deletion while document is open", () => {
    it("should remove file from workspace even if document is open", () => {
      // This is the key bug fix scenario:
      // 1. File is open in VSCode (in state.documents)
      // 2. File is deleted externally or via file explorer
      // 3. onDidChangeWatchedFiles receives Deleted event
      // 4. File should be removed from workspace model immediately

      const fileAContent = `2026-01-06T10:00Z create lore "Referencing entry" #test
  type: "fact"
  related: ^open-file-entry
`;
      const fileBContent = `2026-01-06T12:00Z create lore "Entry in open file" ^open-file-entry #test
  type: "fact"
`;

      // Open both files (simulating user has both tabs open)
      state.openDocument("file:///file-a.thalo", fileAContent);
      state.openDocument("file:///file-b.thalo", fileBContent);

      // Verify definition is found before deletion
      const docA = createDocument(fileAContent, "file:///file-a.thalo");
      const positionOnLink: Position = { line: 2, character: 15 };
      let result = handleDefinition(state.workspace, docA, positionOnLink);
      expect(result).not.toBeNull();
      expect(result!.uri).toBe("file:///file-b.thalo");

      // File B is deleted while still "open" in VSCode
      // (VSCode shows tab with "(deleted)" but document is still in state.documents)
      const wasProcessed = state.handleFileChange("file:///file-b.thalo", FileChangeType.Deleted);

      // Delete should be processed even though document was open
      expect(wasProcessed).toBe(true);

      // Document should be removed from both workspace and documents map
      expect(state.documents.has("file:///file-b.thalo")).toBe(false);
      expect(state.workspace.hasDocument("/file-b.thalo")).toBe(false);

      // Definition should no longer be found
      result = handleDefinition(state.workspace, docA, positionOnLink);
      expect(result).toBeNull();
    });

    it("should remove schema definitions when file is deleted while open", () => {
      // Entity schema defined in a file that gets deleted while open
      const schemaContent = `2026-01-05T10:00Z define-entity custom "Custom entity"
  # Metadata
  name: string
`;
      const instanceContent = `2026-01-06T10:00Z create custom "Test instance" #test
  name: "test"
`;

      // Open both files
      state.openDocument("file:///schema.thalo", schemaContent);
      state.openDocument("file:///instance.thalo", instanceContent);

      // Verify schema is registered
      const schema = state.workspace.schemaRegistry.get("custom");
      expect(schema).toBeDefined();

      // Delete schema file while it's open
      const wasProcessed = state.handleFileChange("file:///schema.thalo", FileChangeType.Deleted);

      expect(wasProcessed).toBe(true);

      // Schema should be removed
      const schemaAfter = state.workspace.schemaRegistry.get("custom");
      expect(schemaAfter).toBeUndefined();
    });
  });

  describe("create/change events for open files", () => {
    it("should skip create event for already open file", () => {
      const content = `2026-01-06T10:00Z create lore "Test entry" #test
  type: "fact"
`;

      // File is already open
      state.openDocument("file:///test.thalo", content);

      // External create event (shouldn't happen, but test the logic)
      const wasProcessed = state.handleFileChange(
        "file:///test.thalo",
        FileChangeType.Created,
        "new content",
      );

      // Should be skipped - document sync handles open files
      expect(wasProcessed).toBe(false);
    });

    it("should skip change event for already open file", () => {
      const content = `2026-01-06T10:00Z create lore "Test entry" #test
  type: "fact"
`;

      // File is already open
      state.openDocument("file:///test.thalo", content);

      // External change event
      const wasProcessed = state.handleFileChange(
        "file:///test.thalo",
        FileChangeType.Changed,
        "modified content",
      );

      // Should be skipped - document sync handles open files
      expect(wasProcessed).toBe(false);
    });
  });

  describe("events for non-open files", () => {
    it("should process create event for non-open file", () => {
      const content = `2026-01-06T10:00Z create lore "New entry" ^new-entry #test
  type: "fact"
`;

      // File is NOT open, but we receive a create event (external file creation)
      const wasProcessed = state.handleFileChange(
        "file:///new-file.thalo",
        FileChangeType.Created,
        content,
      );

      expect(wasProcessed).toBe(true);
      expect(state.workspace.hasDocument("/new-file.thalo")).toBe(true);

      // Link should be resolvable
      const linkDef = state.workspace.getLinkDefinition("new-entry");
      expect(linkDef).toBeDefined();
    });

    it("should process delete event for non-open file", () => {
      const content = `2026-01-06T10:00Z create lore "Entry to delete" ^delete-me #test
  type: "fact"
`;

      // Add file to workspace (not open in editor)
      state.workspace.addDocument(content, { filename: "/deletable.thalo", fileType: "thalo" });

      // Verify it's in workspace
      expect(state.workspace.hasDocument("/deletable.thalo")).toBe(true);

      // Delete event
      const wasProcessed = state.handleFileChange(
        "file:///deletable.thalo",
        FileChangeType.Deleted,
      );

      expect(wasProcessed).toBe(true);
      expect(state.workspace.hasDocument("/deletable.thalo")).toBe(false);
    });
  });

  describe("file type filtering", () => {
    it("should ignore non-thalo/markdown files", () => {
      const wasProcessed = state.handleFileChange("file:///test.js", FileChangeType.Deleted);

      expect(wasProcessed).toBe(false);
    });

    it("should process .thalo files", () => {
      state.workspace.addDocument("", { filename: "/test.thalo", fileType: "thalo" });

      const wasProcessed = state.handleFileChange("file:///test.thalo", FileChangeType.Deleted);

      expect(wasProcessed).toBe(true);
    });

    it("should process .md files", () => {
      state.workspace.addDocument("", { filename: "/test.md", fileType: "markdown" });

      const wasProcessed = state.handleFileChange("file:///test.md", FileChangeType.Deleted);

      expect(wasProcessed).toBe(true);
    });
  });
});
