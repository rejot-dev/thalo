import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("empty-required-value rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  optional?: string
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports empty value for required field", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  subject:
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "empty-required-value");

    expect(error).toBeDefined();
    expect(error!.message).toContain("subject");
    expect(error!.message).toContain("empty value");
    expect(error!.severity).toBe("error");
  });

  it("does not report non-empty required field", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  subject: "my subject"
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "empty-required-value");

    expect(error).toBeUndefined();
  });

  it("does not report empty value for optional field", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  subject: "test"
  optional:
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "empty-required-value");

    expect(error).toBeUndefined();
  });

  it('reports empty quoted string ""', () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  subject: ""
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "empty-required-value");

    expect(error).toBeDefined();
    expect(error!.message).toContain("subject");
  });

  it("does not report field with default value", () => {
    const workspaceWithDefaults = new Workspace();
    workspaceWithDefaults.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight" = "fact"
  subject: string
`,
      { filename: "schema.ptall" },
    );

    workspaceWithDefaults.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type:
  subject: "test"
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspaceWithDefaults);
    const error = diagnostics.find((d) => d.code === "empty-required-value");

    // type has a default, so empty is allowed
    expect(error).toBeUndefined();
  });
});
