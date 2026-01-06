import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("duplicate-timestamp rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports duplicate timestamps in same file", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "First entry" #test
  type: fact

2026-01-05T18:00 create lore "Second entry" #test
  type: insight
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toContain("2026-01-05T18:00");
    expect(warnings[0].severity).toBe("warning");
  });

  it("reports duplicate timestamps across files", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "First entry" #test
  type: fact
`,
      { filename: "file1.ptall" },
    );

    workspace.addDocument(
      `2026-01-05T18:00 create lore "Second entry" #test
  type: insight
`,
      { filename: "file2.ptall" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("does not report unique timestamps", () => {
    workspace.addDocument(
      `2026-01-05T17:00 create lore "First entry" #test
  type: fact

2026-01-05T18:00 create lore "Second entry" #test
  type: insight

2026-01-05T19:00 create lore "Third entry" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    // Only the schema timestamp (00:00) is shared, let's filter for test entries
    expect(warnings).toHaveLength(0);
  });

  it("reports all instances of duplicate timestamps", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "First" #test
  type: fact

2026-01-05T18:00 create lore "Second" #test
  type: insight

2026-01-05T18:00 create lore "Third" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    // Should report on all 3 entries
    expect(warnings).toHaveLength(3);
  });

  it("includes other locations in message", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "First" #test
  type: fact

2026-01-05T18:00 create lore "Second" #test
  type: insight
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "duplicate-timestamp");

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain("Also at:");
  });

  it("can be configured to error", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "First" #test
  type: fact

2026-01-05T18:00 create lore "Second" #test
  type: insight
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace, { rules: { "duplicate-timestamp": "error" } });
    const diag = diagnostics.find((d) => d.code === "duplicate-timestamp");

    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("error");
  });
});
