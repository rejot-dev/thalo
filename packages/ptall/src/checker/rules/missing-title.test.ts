import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("missing-title rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports missing title on instance entry", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "missing-title");

    expect(error).toBeDefined();
    expect(error!.message).toContain("missing a title");
    expect(error!.severity).toBe("error");
  });

  it("does not report entry with title", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "My title" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "missing-title");

    expect(error).toBeUndefined();
  });

  it("reports whitespace-only title", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "   " #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "missing-title");

    expect(error).toBeDefined();
  });

  it("reports missing title on schema entry", () => {
    const workspaceWithBadSchema = new Workspace();
    workspaceWithBadSchema.addDocument(
      `2026-01-01T00:00 define-entity lore ""
  # Metadata
  type: string
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspaceWithBadSchema);
    const error = diagnostics.find((d) => d.code === "missing-title");

    expect(error).toBeDefined();
    expect(error!.message).toContain("Schema entry is missing a title");
  });

  it("reports on both instance and schema entries", () => {
    const workspaceWithMissingTitles = new Workspace();
    workspaceWithMissingTitles.addDocument(
      `2026-01-01T00:00 define-entity lore ""
  # Metadata
  type: string
`,
      { filename: "schema.ptall" },
    );

    workspaceWithMissingTitles.addDocument(
      `2026-01-05T18:00 create lore "" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspaceWithMissingTitles);
    const errors = diagnostics.filter((d) => d.code === "missing-title");

    expect(errors).toHaveLength(2);
  });

  it("can be configured to warning", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace, { rules: { "missing-title": "warning" } });
    const diag = diagnostics.find((d) => d.code === "missing-title");

    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("warning");
  });

  it("can be turned off", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace, { rules: { "missing-title": "off" } });
    const error = diagnostics.find((d) => d.code === "missing-title");

    expect(error).toBeUndefined();
  });
});
