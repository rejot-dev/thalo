import { describe, it, expect } from "vitest";
import { Workspace } from "./workspace.js";

describe("Workspace", () => {
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

  it("should build link index for definitions", () => {
    const ws = new Workspace();
    ws.addDocument(
      `2026-01-05T10:00Z create lore "My entry" ^my-entry
`,
      { filename: "test.thalo" },
    );

    const linkIndex = ws.linkIndex;
    expect(linkIndex.definitions.has("my-entry")).toBe(true);
    expect(linkIndex.definitions.get("my-entry")!.file).toBe("test.thalo");
  });

  it("should build link index for references", () => {
    const ws = new Workspace();
    ws.addDocument(
      `2026-01-05T10:00Z create lore "My entry"
  subject: ^self
`,
      { filename: "test.thalo" },
    );

    const linkIndex = ws.linkIndex;
    expect(linkIndex.references.has("self")).toBe(true);
    const refs = linkIndex.references.get("self")!;
    expect(refs).toHaveLength(1);
    expect(refs[0].context).toBe("subject");
  });

  it("should merge links across documents", () => {
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

    const linkIndex = ws.linkIndex;
    // entry-1 is defined in first.thalo
    expect(linkIndex.definitions.has("entry-1")).toBe(true);
    expect(linkIndex.definitions.get("entry-1")!.file).toBe("first.thalo");
    // entry-1 is referenced in second.thalo
    expect(linkIndex.references.has("entry-1")).toBe(true);
    expect(linkIndex.references.get("entry-1")![0].file).toBe("second.thalo");
  });

  it("should clear models when clearing workspace", () => {
    const ws = new Workspace();
    ws.addDocument(
      `2026-01-05T10:00Z create lore "Test"
`,
      { filename: "test.thalo" },
    );

    expect(ws.allModels()).toHaveLength(1);
    ws.clear();
    expect(ws.allModels()).toHaveLength(0);
    expect(ws.linkIndex.definitions.size).toBe(0);
    expect(ws.linkIndex.references.size).toBe(0);
  });

  it("should remove model when removing document", () => {
    const ws = new Workspace();
    ws.addDocument(
      `2026-01-05T10:00Z create lore "Test" ^my-entry
`,
      { filename: "test.thalo" },
    );

    expect(ws.getModel("test.thalo")).toBeDefined();
    expect(ws.linkIndex.definitions.has("my-entry")).toBe(true);

    ws.removeDocument("test.thalo");

    expect(ws.getModel("test.thalo")).toBeUndefined();
    expect(ws.linkIndex.definitions.has("my-entry")).toBe(false);
  });

  it("should provide allEntries method", () => {
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

    const entries = ws.allEntries();
    expect(entries).toHaveLength(3);
    expect(entries[0].type).toBe("instance_entry");
  });

  it("should provide hasDocument and files methods", () => {
    const ws = new Workspace();
    ws.addDocument(
      `2026-01-05T10:00Z create lore "Test"
`,
      { filename: "test.thalo" },
    );

    expect(ws.hasDocument("test.thalo")).toBe(true);
    expect(ws.hasDocument("other.thalo")).toBe(false);
    expect(ws.files()).toContain("test.thalo");
  });

  it("should provide getLinkDefinition and getLinkReferences", () => {
    const ws = new Workspace();
    ws.addDocument(
      `2026-01-05T10:00Z create lore "Entry" ^my-entry
2026-01-05T11:00Z create lore "Ref"
  related: ^my-entry
`,
      { filename: "test.thalo" },
    );

    const def = ws.getLinkDefinition("my-entry");
    expect(def).toBeDefined();
    expect(def!.id).toBe("my-entry");

    const refs = ws.getLinkReferences("my-entry");
    expect(refs).toHaveLength(1);
    expect(refs[0].context).toBe("related");
  });

  it("should handle empty documents", () => {
    const ws = new Workspace();
    const model = ws.addDocument("", { filename: "empty.thalo" });

    expect(model).toBeDefined();
    expect(model.ast.entries).toHaveLength(0);
    expect(ws.hasDocument("empty.thalo")).toBe(true);
  });

  it("should populate schema registry from define-entity", () => {
    const ws = new Workspace();
    ws.addDocument(
      `2026-01-05T10:00Z define-entity person "A person"
  # Metadata
  name: string
`,
      { filename: "test.thalo" },
    );

    expect(ws.schemaRegistry.has("person")).toBe(true);
    const schema = ws.schemaRegistry.get("person");
    expect(schema).toBeDefined();
    expect(schema!.name).toBe("person");
    expect(schema!.fields.has("name")).toBe(true);
  });

  it("should replace document when adding same filename", () => {
    const ws = new Workspace();
    ws.addDocument(
      `2026-01-05T10:00Z create lore "First" ^first
`,
      { filename: "test.thalo" },
    );
    ws.addDocument(
      `2026-01-05T11:00Z create lore "Second" ^second
`,
      { filename: "test.thalo" },
    );

    expect(ws.allModels()).toHaveLength(1);
    expect(ws.linkIndex.definitions.has("first")).toBe(false);
    expect(ws.linkIndex.definitions.has("second")).toBe(true);
  });
});
