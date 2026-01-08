import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("timestamp-out-of-order rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports when a timestamp is earlier than the previous entry", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Later entry" #test
  type: fact

2026-01-05T17:00Z create lore "Earlier entry" #test
  type: insight
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "timestamp-out-of-order");

    expect(warning).toBeDefined();
    expect(warning!.message).toContain("2026-01-05T17:00Z");
    expect(warning!.message).toContain("2026-01-05T18:00Z");
    expect(warning!.message).toContain("earlier than previous entry");
    expect(warning!.severity).toBe("warning");
  });

  it("does not report when timestamps are in chronological order", () => {
    workspace.addDocument(
      `2026-01-05T17:00Z create lore "First entry" #test
  type: fact

2026-01-05T18:00Z create lore "Second entry" #test
  type: insight

2026-01-05T19:00Z create lore "Third entry" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "timestamp-out-of-order");

    expect(warning).toBeUndefined();
  });

  it("does not report when timestamps are equal", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "First entry" #test
  type: fact

2026-01-05T18:00Z create lore "Second entry" #test
  type: insight
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "timestamp-out-of-order");

    expect(warning).toBeUndefined();
  });

  it("reports multiple out-of-order entries", () => {
    workspace.addDocument(
      `2026-01-05T19:00Z create lore "Third" #test
  type: fact

2026-01-05T17:00Z create lore "First" #test
  type: insight

2026-01-05T18:00Z create lore "Second" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "timestamp-out-of-order");

    // First entry (19:00) is followed by 17:00 (out of order)
    // Then 17:00 is followed by 18:00 (in order)
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("2026-01-05T17:00Z");
  });

  it("checks each document independently", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Later" #test
  type: fact

2026-01-05T17:00Z create lore "Earlier" #test
  type: insight
`,
      { filename: "file1.ptall" },
    );

    workspace.addDocument(
      `2026-01-05T10:00Z create lore "Morning" #test
  type: fact

2026-01-05T11:00Z create lore "Later morning" #test
  type: insight
`,
      { filename: "file2.ptall" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "timestamp-out-of-order");

    // Only file1.ptall has out-of-order entries
    expect(warnings).toHaveLength(1);
    expect(warnings[0].file).toBe("file1.ptall");
  });

  it("does not report for a single entry", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Only entry" #test
  type: fact
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "timestamp-out-of-order");

    expect(warning).toBeUndefined();
  });

  it("handles entries across different days", () => {
    workspace.addDocument(
      `2026-01-06T10:00Z create lore "Next day" #test
  type: fact

2026-01-05T23:00Z create lore "Previous day" #test
  type: insight
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "timestamp-out-of-order");

    expect(warning).toBeDefined();
    expect(warning!.message).toContain("2026-01-05T23:00Z");
    expect(warning!.message).toContain("2026-01-06T10:00Z");
  });

  it("includes timestamp data in diagnostic", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Later" #test
  type: fact

2026-01-05T17:00Z create lore "Earlier" #test
  type: insight
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "timestamp-out-of-order");

    expect(warning).toBeDefined();
    expect(warning!.data).toEqual({
      timestamp: "2026-01-05T17:00Z",
      previousTimestamp: "2026-01-05T18:00Z",
    });
  });
});
