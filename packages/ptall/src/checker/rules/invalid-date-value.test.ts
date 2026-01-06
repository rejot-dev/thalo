import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("invalid-date-value rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: string
  published?: date
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports invalid date format", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  published: January 5th, 2026
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-value");

    expect(error).toBeDefined();
    expect(error!.message).toContain("January 5th, 2026");
    expect(error!.message).toContain("Invalid date format");
    expect(error!.severity).toBe("error");
  });

  it("accepts YYYY format", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  published: 2026
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-value");

    expect(error).toBeUndefined();
  });

  it("accepts YYYY-MM format", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  published: 2026-01
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-value");

    expect(error).toBeUndefined();
  });

  it("accepts YYYY-MM-DD format", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  published: 2026-01-05
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-value");

    expect(error).toBeUndefined();
  });

  it("reports invalid month format", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  published: 2026-1-05
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-value");

    expect(error).toBeDefined();
    expect(error!.message).toContain("2026-1-05");
  });

  it("reports date with time component", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  published: 2026-01-05T18:00
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-value");

    expect(error).toBeDefined();
  });

  it("does not check non-date fields", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: not-a-date-but-string-field
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-value");

    // type is string, not date, so no date validation
    expect(error).toBeUndefined();
  });
});
