import { describe, it, expect } from "vitest";
import { Workspace } from "./workspace.js";

describe("Workspace", () => {
  describe("SemanticModel support", () => {
    it("should create SemanticModel when adding document", () => {
      const ws = new Workspace();
      ws.addDocument(
        `2026-01-05T10:00Z create lore "Test entry"
  subject: ^self
`,
        { filename: "test.thalo" },
      );

      const model = ws.getModel("test.thalo");
      expect(model).toBeDefined();
      expect(model!.file).toBe("test.thalo");
      expect(model!.ast.entries).toHaveLength(1);
    });

    it("should provide allModels method", () => {
      const ws = new Workspace();
      ws.addDocument(
        `2026-01-05T10:00Z create lore "First entry"
`,
        { filename: "first.thalo" },
      );
      ws.addDocument(
        `2026-01-05T11:00Z create lore "Second entry"
`,
        { filename: "second.thalo" },
      );

      const models = ws.allModels();
      expect(models).toHaveLength(2);
    });

    it("should build semantic link index for definitions", () => {
      const ws = new Workspace();
      ws.addDocument(
        `2026-01-05T10:00Z create lore "My entry" ^my-entry
`,
        { filename: "test.thalo" },
      );

      const linkIndex = ws.semanticLinkIndex;
      expect(linkIndex.definitions.has("my-entry")).toBe(true);
      expect(linkIndex.definitions.get("my-entry")!.file).toBe("test.thalo");
    });

    it("should build semantic link index for references", () => {
      const ws = new Workspace();
      ws.addDocument(
        `2026-01-05T10:00Z create lore "My entry"
  subject: ^self
`,
        { filename: "test.thalo" },
      );

      const linkIndex = ws.semanticLinkIndex;
      expect(linkIndex.references.has("self")).toBe(true);
      const refs = linkIndex.references.get("self")!;
      expect(refs).toHaveLength(1);
      expect(refs[0].context).toBe("subject");
    });

    it("should merge semantic links across documents", () => {
      const ws = new Workspace();
      ws.addDocument(
        `2026-01-05T10:00Z create lore "First" ^entry-1
`,
        { filename: "first.thalo" },
      );
      ws.addDocument(
        `2026-01-05T11:00Z create lore "Second"
  related: ^entry-1
`,
        { filename: "second.thalo" },
      );

      const linkIndex = ws.semanticLinkIndex;
      // entry-1 is defined in first.thalo
      expect(linkIndex.definitions.has("entry-1")).toBe(true);
      expect(linkIndex.definitions.get("entry-1")!.file).toBe("first.thalo");
      // entry-1 is referenced in second.thalo
      expect(linkIndex.references.has("entry-1")).toBe(true);
      expect(linkIndex.references.get("entry-1")![0].file).toBe("second.thalo");
    });

    it("should clear semantic models when clearing workspace", () => {
      const ws = new Workspace();
      ws.addDocument(
        `2026-01-05T10:00Z create lore "Test"
`,
        { filename: "test.thalo" },
      );

      expect(ws.allModels()).toHaveLength(1);
      ws.clear();
      expect(ws.allModels()).toHaveLength(0);
      expect(ws.semanticLinkIndex.definitions.size).toBe(0);
      expect(ws.semanticLinkIndex.references.size).toBe(0);
    });

    it("should remove semantic model when removing document", () => {
      const ws = new Workspace();
      ws.addDocument(
        `2026-01-05T10:00Z create lore "Test" ^my-entry
`,
        { filename: "test.thalo" },
      );

      expect(ws.getModel("test.thalo")).toBeDefined();
      expect(ws.semanticLinkIndex.definitions.has("my-entry")).toBe(true);

      ws.removeDocument("test.thalo");

      expect(ws.getModel("test.thalo")).toBeUndefined();
      expect(ws.semanticLinkIndex.definitions.has("my-entry")).toBe(false);
    });

    it("should provide allAstEntries method", () => {
      const ws = new Workspace();
      ws.addDocument(
        `2026-01-05T10:00Z create lore "First"
`,
        { filename: "first.thalo" },
      );
      ws.addDocument(
        `2026-01-05T11:00Z create lore "Second"
2026-01-05T12:00Z create lore "Third"
`,
        { filename: "second.thalo" },
      );

      const entries = ws.allAstEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].type).toBe("instance_entry");
    });

    it("should maintain backward compatibility with Document methods", () => {
      const ws = new Workspace();
      ws.addDocument(
        `2026-01-05T10:00Z create lore "Test"
`,
        { filename: "test.thalo" },
      );

      // Old methods should still work
      expect(ws.getDocument("test.thalo")).toBeDefined();
      expect(ws.allDocuments()).toHaveLength(1);
      expect(ws.allEntries()).toHaveLength(1);
      expect(ws.hasDocument("test.thalo")).toBe(true);
      expect(ws.files()).toContain("test.thalo");
    });
  });
});
