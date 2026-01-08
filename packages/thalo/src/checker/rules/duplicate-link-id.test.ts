import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("duplicate-link-id rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
`,
      { filename: "schema.thalo" },
    );
  });

  it("reports duplicate explicit link IDs across different files", () => {
    // The rule detects duplicates across files
    // Within a single document, the linkIndex.definitions Map may collapse duplicates
    workspace.addDocument(
      `2026-01-05T17:00Z create lore "First entry" ^my-link #test
  type: fact
`,
      { filename: "file1.thalo" },
    );

    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Second entry" ^my-link #test
  type: insight
`,
      { filename: "file2.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-link-id");

    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].message).toContain("my-link");
    expect(errors[0].severity).toBe("error");
  });

  it("reports duplicate explicit link IDs across files", () => {
    workspace.addDocument(
      `2026-01-05T17:00Z create lore "First entry" ^shared-id #test
  type: fact
`,
      { filename: "file1.thalo" },
    );

    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Second entry" ^shared-id #test
  type: insight
`,
      { filename: "file2.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-link-id");

    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].message).toContain("shared-id");
  });

  it("does not report unique link IDs", () => {
    workspace.addDocument(
      `2026-01-05T17:00Z create lore "First entry" ^link-1 #test
  type: fact

2026-01-05T18:00Z create lore "Second entry" ^link-2 #test
  type: insight
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-link-id");

    expect(errors).toHaveLength(0);
  });

  it("does not report duplicate timestamps (not link IDs)", () => {
    // Timestamps are not link IDs - only explicit ^link-id creates links
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "First entry" #test
  type: fact

2026-01-05T18:00Z create lore "Second entry" #test
  type: insight
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-link-id");

    // Should not report, since timestamps aren't link IDs
    expect(errors).toHaveLength(0);
  });

  it("reports all instances of duplicate IDs across files", () => {
    workspace.addDocument(
      `2026-01-05T17:00Z create lore "First" ^dup #test
  type: fact
`,
      { filename: "file1.thalo" },
    );

    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Second" ^dup #test
  type: insight
`,
      { filename: "file2.thalo" },
    );

    workspace.addDocument(
      `2026-01-05T19:00Z create lore "Third" ^dup #test
  type: fact
`,
      { filename: "file3.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-link-id");

    // Should report on all 3 entries
    expect(errors).toHaveLength(3);
  });
});
