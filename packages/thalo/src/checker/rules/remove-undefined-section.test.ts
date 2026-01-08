import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("remove-undefined-section rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  /**
   * Note: Section removal uses `# Remove Sections` header followed by section names.
   * The syntax is:
   *   # Remove Sections
   *   SectionName
   *   AnotherSection
   *
   * NOT `-SectionName` syntax. These tests use the correct syntax.
   */

  it.skip("should report removing a section that does not exist (not tested - needs model support)", () => {
    // This test documents intended behavior but needs model.removeSections support
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Sections
  Claim
  Reasoning

2026-01-01T01:00Z alter-entity opinion "Remove nonexistent section"
  # Remove Sections
  Nonexistent
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "remove-undefined-section");

    expect(warning).toBeDefined();
  });

  it.skip("should not report removing an existing section (not tested - needs model support)", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Sections
  Claim
  Reasoning
  Obsolete

2026-01-01T01:00Z alter-entity opinion "Remove obsolete section"
  # Remove Sections
  Obsolete
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "remove-undefined-section");

    expect(warning).toBeUndefined();
  });

  it.skip("should report multiple undefined section removals (not tested - needs model support)", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Sections
  Claim

2026-01-01T01:00Z alter-entity opinion "Remove sections"
  # Remove Sections
  Foo
  Bar
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "remove-undefined-section");

    expect(warnings).toHaveLength(2);
  });

  it("does not report when entity is undefined (handled by other rule)", () => {
    workspace.addDocument(
      `2026-01-01T01:00Z alter-entity unknown "Remove section from unknown"
  # Sections
  Claim
`,
      { filename: "schema.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "remove-undefined-section");

    // Should not report - alter-undefined-entity handles this
    expect(warning).toBeUndefined();
  });
});
