import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("unknown-entity rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    // Define a single entity for testing
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports unknown entity type", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create journal "Test" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "unknown-entity");

    expect(error).toBeDefined();
    expect(error!.message).toContain("journal");
    expect(error!.severity).toBe("error");
  });

  it("does not report known entity type", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "unknown-entity");

    expect(error).toBeUndefined();
  });

  it("reports multiple unknown entities", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create journal "Test 1" #test
  field: value

2026-01-05T19:00 create opinion "Test 2" #test
  field: value
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "unknown-entity");

    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain("journal");
    expect(errors[1].message).toContain("opinion");
  });

  it("can be configured to warning", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create journal "Test" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace, { rules: { "unknown-entity": "warning" } });
    const diag = diagnostics.find((d) => d.code === "unknown-entity");

    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("warning");
  });

  it("can be turned off", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create journal "Test" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace, { rules: { "unknown-entity": "off" } });
    const error = diagnostics.find((d) => d.code === "unknown-entity");

    expect(error).toBeUndefined();
  });
});
