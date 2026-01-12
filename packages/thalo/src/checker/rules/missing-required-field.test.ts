import { describe, it, expect, beforeEach } from "vitest";
import { createWorkspace } from "../../parser.native.js";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("missing-required-field rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: link
  optional-field?: string
`,
      { filename: "schema.thalo" },
    );
  });

  it("reports missing required field", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
`,
      { filename: "test.thalo" },
    );
    // Missing "subject" which is required

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "missing-required-field");

    expect(error).toBeDefined();
    expect(error!.message).toContain("subject");
    expect(error!.severity).toBe("error");
  });

  it("does not report when all required fields present", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: ^test-subject
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "missing-required-field");

    expect(error).toBeUndefined();
  });

  it("does not report missing optional field", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: ^test-subject
`,
      { filename: "test.thalo" },
    );
    // Missing "optional-field" which is optional

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "missing-required-field");

    expect(error).toBeUndefined();
  });

  it("reports multiple missing required fields", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  optional-field: "something"
`,
      { filename: "test.thalo" },
    );
    // Missing both "type" and "subject"

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "missing-required-field");

    expect(errors.length).toBeGreaterThanOrEqual(2);
    const messages = errors.map((e) => e.message).join(" ");
    expect(messages).toContain("type");
    expect(messages).toContain("subject");
  });

  it("does not report for field with default value", () => {
    const workspaceWithDefaults = createWorkspace();
    workspaceWithDefaults.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight" = "fact"
  subject: link
`,
      { filename: "schema.thalo" },
    );

    workspaceWithDefaults.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  subject: ^test-subject
`,
      { filename: "test.thalo" },
    );
    // Missing "type" but it has a default

    const diagnostics = check(workspaceWithDefaults);
    const error = diagnostics.find((d) => d.code === "missing-required-field");

    expect(error).toBeUndefined();
  });
});
