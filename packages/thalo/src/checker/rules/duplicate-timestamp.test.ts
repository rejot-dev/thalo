import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("duplicate-timestamp rule", () => {
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

  it("reports duplicate timestamps without link IDs", () => {
    workspace.addDocument(
      `2026-01-05T10:00Z create lore "First entry" #test
  type: fact

2026-01-05T10:00Z create lore "Second entry" #test
  type: insight
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    expect(errors).toHaveLength(2); // Both entries should be reported
    expect(errors[0].message).toContain("2026-01-05T10:00Z");
    expect(errors[0].message).toContain("^link-id");
    expect(errors[0].severity).toBe("error");
  });

  it("does not report duplicate timestamps with link IDs", () => {
    workspace.addDocument(
      `2026-01-05T10:00Z create lore "First entry" ^link-1 #test
  type: fact

2026-01-05T10:00Z create lore "Second entry" ^link-2 #test
  type: insight
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    expect(errors).toHaveLength(0);
  });

  it("does not report unique timestamps without link IDs", () => {
    workspace.addDocument(
      `2026-01-05T10:00Z create lore "First entry" #test
  type: fact

2026-01-05T11:00Z create lore "Second entry" #test
  type: insight
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    expect(errors).toHaveLength(0);
  });

  it("reports when some entries have link IDs but others do not", () => {
    workspace.addDocument(
      `2026-01-05T10:00Z create lore "First entry" ^link-1 #test
  type: fact

2026-01-05T10:00Z create lore "Second entry" #test
  type: insight

2026-01-05T10:00Z create lore "Third entry" #test
  type: fact
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    // The two entries without link IDs should be reported
    expect(errors).toHaveLength(2);
  });

  it("allows duplicate timestamps with different entry types", () => {
    workspace.addDocument(
      `2026-01-05T10:00Z define-synthesis "My Synthesis" ^synth-1
  sources: query(type: fact)
  prompt: "Analyze"

2026-01-05T10:00Z create lore "Instance entry" #test
  type: fact
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    // Different entry types (synthesis vs instance) should not conflict
    expect(errors).toHaveLength(0);
  });

  it("reports multiple duplicates in same file", () => {
    workspace.addDocument(
      `2026-01-05T10:00Z create lore "First" #test
  type: fact

2026-01-05T10:00Z create lore "Second" #test
  type: fact

2026-01-05T10:00Z create lore "Third" #test
  type: fact
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    // All 3 entries with duplicate timestamp should be reported
    expect(errors).toHaveLength(3);
    expect(errors[0].data?.["duplicateCount"]).toBe(3);
  });

  it("does not report duplicates across different files", () => {
    // Same timestamp in different files is fine - they're separate documents
    workspace.addDocument(
      `2026-01-05T10:00Z create lore "First entry" #test
  type: fact
`,
      { filename: "file1.thalo" },
    );

    workspace.addDocument(
      `2026-01-05T10:00Z create lore "Second entry" #test
  type: insight
`,
      { filename: "file2.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    expect(errors).toHaveLength(0);
  });

  it("reports duplicate timestamps for schema entries", () => {
    workspace.addDocument(
      `2026-01-05T10:00Z define-entity custom "Custom"
  # Metadata
  field1: string

2026-01-05T10:00Z define-entity another "Another"
  # Metadata
  field2: number
`,
      { filename: "schemas.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    // Both schema entries should be reported
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain("schema entry");
  });

  it("does not report for synthesis entries (always have link ID)", () => {
    workspace.addDocument(
      `2026-01-05T10:00Z define-synthesis "First" ^synth-1
  sources: query(type: fact)
  prompt: "Analyze"

2026-01-05T10:00Z define-synthesis "Second" ^synth-2
  sources: query(type: insight)
  prompt: "Summarize"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    // Synthesis entries always have linkId, so no conflict
    expect(errors).toHaveLength(0);
  });

  it("does not report for actualize entries (always have target)", () => {
    workspace.addDocument(
      `2026-01-05T09:00Z define-synthesis "My Synthesis" ^synth-1
  sources: query(type: fact)
  prompt: "Analyze"

2026-01-05T10:00Z actualize-synthesis ^synth-1

2026-01-05T10:00Z actualize-synthesis ^synth-1
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    // Actualize entries always have target (which acts as link ID)
    expect(errors).toHaveLength(0);
  });

  it("reports with non-UTC timezone offset", () => {
    workspace.addDocument(
      `2026-01-05T10:30+01:00 create lore "First entry" #test
  type: fact

2026-01-05T10:30+01:00 create lore "Second entry" #test
  type: insight
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain("2026-01-05T10:30+01:00");
  });

  it("provides helpful error message", () => {
    workspace.addDocument(
      `2026-01-05T10:00Z create lore "Entry 1" #test
  type: fact

2026-01-05T10:00Z create lore "Entry 2" #test
  type: fact
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain("Duplicate timestamp");
    expect(errors[0].message).toContain("2026-01-05T10:00Z");
    expect(errors[0].message).toContain("instance entry");
    expect(errors[0].message).toContain("Add a unique ^link-id");
  });
});
