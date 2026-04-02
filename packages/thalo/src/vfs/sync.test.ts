import { InMemoryFs } from "just-bash";
import { describe, expect, it } from "vitest";
import { createInitializedWorkspace } from "../parser.node.js";
import { applyWorkspaceFileChange } from "./sync.js";

describe("applyWorkspaceFileChange", () => {
  it("adds a created file to the workspace", async () => {
    const fs = new InMemoryFs({
      "/schema.thalo": '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
      "/entry.thalo": '2026-01-02T00:00Z create note "Created" ^created\n  # Content\n  New.\n',
    });
    const workspace = await createInitializedWorkspace();
    workspace.addDocument(await fs.readFile("/schema.thalo", "utf8"), {
      filename: "/schema.thalo",
    });

    await applyWorkspaceFileChange(workspace, fs, { path: "/entry.thalo", kind: "created" });

    expect(workspace.hasDocument("/entry.thalo")).toBe(true);
    expect(workspace.getModel("/entry.thalo")?.ast.entries).toHaveLength(1);
  });

  it("updates an existing workspace file", async () => {
    const fs = new InMemoryFs({
      "/schema.thalo": '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
      "/entry.thalo": '2026-01-02T00:00Z create note "Original" ^entry\n  # Content\n  Before.\n',
    });
    const workspace = await createInitializedWorkspace();
    workspace.addDocument(await fs.readFile("/schema.thalo", "utf8"), {
      filename: "/schema.thalo",
    });
    workspace.addDocument(await fs.readFile("/entry.thalo", "utf8"), { filename: "/entry.thalo" });

    await fs.writeFile(
      "/entry.thalo",
      '2026-01-02T00:00Z create note "Updated" ^entry\n  # Content\n  After.\n',
      "utf8",
    );

    await applyWorkspaceFileChange(workspace, fs, { path: "/entry.thalo", kind: "updated" });

    expect(workspace.getModel("/entry.thalo")?.source).toContain('"Updated"');
  });

  it("removes a deleted file from the workspace and purges its cached document", async () => {
    const fs = new InMemoryFs({
      "/schema.thalo": '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
      "/entry.thalo": '2026-01-02T00:00Z create note "Remove Me" ^entry\n  # Content\n  Gone.\n',
    });
    const workspace = await createInitializedWorkspace();
    workspace.addDocument(await fs.readFile("/schema.thalo", "utf8"), {
      filename: "/schema.thalo",
    });
    workspace.updateDocument("/entry.thalo", await fs.readFile("/entry.thalo", "utf8"));

    expect(workspace.getDocument("/entry.thalo")).toBeDefined();

    await fs.rm("/entry.thalo");
    await applyWorkspaceFileChange(workspace, fs, { path: "/entry.thalo", kind: "deleted" });

    expect(workspace.hasDocument("/entry.thalo")).toBe(false);
    expect(workspace.getDocument("/entry.thalo")).toBeUndefined();
  });
});
