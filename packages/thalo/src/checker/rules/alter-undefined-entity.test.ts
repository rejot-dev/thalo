import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("alter-undefined-entity rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("reports alter-entity for undefined entity", () => {
    workspace.addDocument(
      `2026-01-01T01:00Z alter-entity lore "Add subject field"
  # Metadata
  subject: string
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "alter-undefined-entity");

    expect(error).toBeDefined();
    expect(error!.message).toContain("lore");
    expect(error!.message).toContain("Cannot alter undefined entity");
    expect(error!.severity).toBe("error");
  });

  it("does not report alter-entity for defined entity", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string

2026-01-01T01:00Z alter-entity lore "Add subject field"
  # Metadata
  subject: string
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "alter-undefined-entity");

    expect(error).toBeUndefined();
  });

  it("reports when definition is in different file", () => {
    workspace.addDocument(
      `2026-01-01T01:00Z alter-entity lore "Add subject field"
  # Metadata
  subject: string
`,
      { filename: "alter.thalo" },
    );

    // No define-entity for "lore" anywhere

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "alter-undefined-entity");

    expect(error).toBeDefined();
    expect(error!.message).toContain("lore");
  });

  it("finds definition in another file", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string
`,
      { filename: "definitions.thalo" },
    );

    workspace.addDocument(
      `2026-01-01T01:00Z alter-entity lore "Add subject field"
  # Metadata
  subject: string
`,
      { filename: "alterations.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "alter-undefined-entity");

    expect(error).toBeUndefined();
  });

  it("reports multiple undefined alters", () => {
    workspace.addDocument(
      `2026-01-01T01:00Z alter-entity lore "Add field"
  # Metadata
  field: string

2026-01-01T02:00Z alter-entity opinion "Add field"
  # Metadata
  confidence: string
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "alter-undefined-entity");

    expect(errors).toHaveLength(2);
    const messages = errors.map((e) => e.message).join(" ");
    expect(messages).toContain("lore");
    expect(messages).toContain("opinion");
  });
});
