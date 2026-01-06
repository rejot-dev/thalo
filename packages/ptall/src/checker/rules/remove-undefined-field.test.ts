import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("remove-undefined-field rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  /**
   * Note: Field removal uses `# Remove Metadata` header followed by field names.
   * The syntax is:
   *   # Remove Metadata
   *   fieldname
   *   anotherfield
   *
   * NOT `-fieldname` syntax. These tests use the correct syntax.
   */

  it.skip("should report removing a field that does not exist (not tested - needs model support)", () => {
    // This test documents intended behavior but needs model.removeFields support
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: string
  subject: string

2026-01-01T01:00 alter-entity lore "Remove nonexistent field"
  # Remove Metadata
  nonexistent
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "remove-undefined-field");

    expect(warning).toBeDefined();
  });

  it.skip("should not report removing an existing field (not tested - needs model support)", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: string
  subject: string
  obsolete: string

2026-01-01T01:00 alter-entity lore "Remove obsolete field"
  # Remove Metadata
  obsolete
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "remove-undefined-field");

    expect(warning).toBeUndefined();
  });

  it.skip("should report multiple undefined field removals (not tested - needs model support)", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: string

2026-01-01T01:00 alter-entity lore "Remove fields"
  # Remove Metadata
  foo
  bar
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "remove-undefined-field");

    expect(warnings).toHaveLength(2);
  });

  it("does not report when entity is undefined (handled by other rule)", () => {
    workspace.addDocument(
      `2026-01-01T01:00 alter-entity unknown "Remove field from unknown"
  # Metadata
  type: string
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "remove-undefined-field");

    // Should not report - alter-undefined-entity handles this
    expect(warning).toBeUndefined();
  });
});
