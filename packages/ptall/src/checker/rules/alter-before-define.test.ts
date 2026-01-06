import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("alter-before-define rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("reports alter-entity with earlier timestamp than define-entity", () => {
    workspace.addDocument(
      `2026-01-01T00:00 alter-entity lore "Add subject field"
  # Metadata
  subject: string

2026-01-01T01:00 define-entity lore "Lore entries"
  # Metadata
  type: string
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "alter-before-define");

    expect(error).toBeDefined();
    expect(error!.message).toContain("2026-01-01T00:00");
    expect(error!.message).toContain("before the define-entity");
    expect(error!.severity).toBe("error");
  });

  it("does not report alter-entity with later timestamp", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: string

2026-01-01T01:00 alter-entity lore "Add subject field"
  # Metadata
  subject: string
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "alter-before-define");

    expect(error).toBeUndefined();
  });

  it("works across files", () => {
    workspace.addDocument(
      `2026-01-01T00:00 alter-entity lore "Add field early"
  # Metadata
  early: string
`,
      { filename: "alterations.ptall" },
    );

    workspace.addDocument(
      `2026-01-01T01:00 define-entity lore "Lore entries"
  # Metadata
  type: string
`,
      { filename: "definitions.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "alter-before-define");

    expect(error).toBeDefined();
  });

  it("does not report alter-entity with same timestamp as define-entity", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: string

2026-01-01T00:00 alter-entity lore "Add subject field"
  # Metadata
  subject: string
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "alter-before-define");

    // Same timestamp should not trigger the rule (timestamp is not before)
    expect(error).toBeUndefined();
  });

  it("uses earliest define-entity when there are duplicates", () => {
    workspace.addDocument(
      `2026-01-01T01:00 define-entity lore "First definition"
  # Metadata
  a: string

2026-01-01T03:00 define-entity lore "Second definition (duplicate)"
  # Metadata
  b: string

2026-01-01T02:00 alter-entity lore "Alter between definitions"
  # Metadata
  c: string
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "alter-before-define");

    // The alter at 02:00 is after the first define at 01:00
    expect(error).toBeUndefined();
  });

  it("does not report when entity is undefined (handled by other rule)", () => {
    workspace.addDocument(
      `2026-01-01T00:00 alter-entity unknown "Add field"
  # Metadata
  field: string
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "alter-before-define");

    // Should not report here - alter-undefined-entity handles this case
    expect(error).toBeUndefined();
  });
});
