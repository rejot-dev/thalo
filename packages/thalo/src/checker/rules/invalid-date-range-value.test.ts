import { describe, it, expect, beforeEach } from "vitest";
import { createWorkspace } from "../../parser.native.js";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("invalid-date-range-value rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string
  period?: daterange
`,
      { filename: "schema.thalo" },
    );
  });

  it("reports invalid date range format", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  period: "from 2022 to 2024"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-range-value");

    expect(error).toBeDefined();
    expect(error!.message).toContain("from 2022 to 2024");
    expect(error!.message).toContain("Invalid date range format");
    expect(error!.severity).toBe("error");
  });

  it("accepts YYYY ~ YYYY format", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  period: 2022 ~ 2024
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-range-value");

    expect(error).toBeUndefined();
  });

  it("accepts YYYY-MM ~ YYYY-MM format", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  period: 2022-01 ~ 2024-12
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-range-value");

    expect(error).toBeUndefined();
  });

  it("accepts YYYY-MM-DD ~ YYYY-MM-DD format", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  period: 2022-01-01 ~ 2024-12-31
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-range-value");

    expect(error).toBeUndefined();
  });

  it("accepts mixed precision date ranges", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  period: 2022 ~ 2024-12-31
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-range-value");

    expect(error).toBeUndefined();
  });

  it("reports missing tilde separator", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  period: "2022 - 2024"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-range-value");

    expect(error).toBeDefined();
  });

  it("reports single date for date-range field", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  period: "2024"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-range-value");

    expect(error).toBeDefined();
  });

  it("does not check non-date-range fields", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "not a date range"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-range-value");

    // type is string, not date-range, so no validation
    expect(error).toBeUndefined();
  });

  it("accepts whitespace around tilde", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  period: 2022~2024
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-date-range-value");

    expect(error).toBeUndefined();
  });
});
