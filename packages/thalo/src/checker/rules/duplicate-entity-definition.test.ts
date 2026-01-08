import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("duplicate-entity-definition rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("reports duplicate entity definitions in same file", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string

2026-01-01T01:00Z define-entity lore "Lore entries again"
  # Metadata
  subject: string
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-entity-definition");

    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].message).toContain("lore");
    expect(errors[0].message).toContain("Also defined at");
    expect(errors[0].severity).toBe("error");
  });

  it("reports duplicate entity definitions across files", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string
`,
      { filename: "schema1.thalo" },
    );

    workspace.addDocument(
      `2026-01-01T01:00Z define-entity lore "Lore entries again"
  # Metadata
  subject: string
`,
      { filename: "schema2.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-entity-definition");

    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].message).toContain("lore");
  });

  it("does not report unique entity definitions", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string

2026-01-01T01:00Z define-entity opinion "Opinion entries"
  # Metadata
  confidence: string
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-entity-definition");

    expect(errors).toHaveLength(0);
  });

  it("reports all instances of duplicate definitions", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "First"
  # Metadata
  a: string

2026-01-01T01:00Z define-entity lore "Second"
  # Metadata
  b: string

2026-01-01T02:00Z define-entity lore "Third"
  # Metadata
  c: string
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-entity-definition");

    // Should report on all 3 definitions
    expect(errors).toHaveLength(3);
  });

  it("does not confuse define-entity with alter-entity", () => {
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
    const errors = diagnostics.filter((d) => d.code === "duplicate-entity-definition");

    expect(errors).toHaveLength(0);
  });
});
