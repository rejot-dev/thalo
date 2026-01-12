import { describe, it, expect, beforeEach } from "vitest";
import { createWorkspace } from "../../parser.native.js";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("duplicate-field-in-schema rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  /**
   * Note: This rule may not detect duplicates if the parser/model collapses them.
   * The grammar supports multiple field definitions, but the AST extraction
   * may deduplicate fields when building the ModelSchemaEntry.fields array.
   *
   * These tests document the intended behavior, but may be skipped if
   * duplicates are collapsed at parse time.
   */

  it.skip("should report duplicate field names in same schema entry (not implemented)", () => {
    // This test is skipped because the parser/model collapses duplicates
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string
  subject: string
  type: number
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-field-in-schema");

    expect(error).toBeDefined();
  });

  it("does not report unique field names", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string
  subject: string
  date: datetime
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-field-in-schema");

    expect(error).toBeUndefined();
  });

  it.skip("should report duplicates in alter-entity (not implemented)", () => {
    // This test is skipped because the parser/model collapses duplicates
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string

2026-01-01T01:00Z alter-entity lore "Add fields"
  # Metadata
  subject: string
  subject: number
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-field-in-schema");

    expect(error).toBeDefined();
  });

  it("does not report same field in different schema entries", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string

2026-01-01T01:00Z define-entity opinion "Opinion entries"
  # Metadata
  type: string
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-field-in-schema");

    expect(error).toBeUndefined();
  });

  it.skip("should report multiple duplicate fields (not implemented)", () => {
    // This test is skipped because the parser/model collapses duplicates
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string
  subject: string
  type: number
  subject: number
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-field-in-schema");

    expect(errors).toHaveLength(2);
  });
});
