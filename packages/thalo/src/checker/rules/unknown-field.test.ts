import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("unknown-field rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
`,
      { filename: "schema.thalo" },
    );
  });

  it("reports unknown field", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"
  unknown-field: "value"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "unknown-field");

    expect(warning).toBeDefined();
    expect(warning!.message).toContain("unknown-field");
    expect(warning!.severity).toBe("warning");
  });

  it("does not report known fields", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "unknown-field");

    expect(warning).toBeUndefined();
  });

  it("reports multiple unknown fields", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"
  foo: "bar"
  baz: "qux"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "unknown-field");

    expect(warnings).toHaveLength(2);
    const messages = warnings.map((w) => w.message).join(" ");
    expect(messages).toContain("foo");
    expect(messages).toContain("baz");
  });

  it("can be configured to error", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"
  unknown: "value"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace, { rules: { "unknown-field": "error" } });
    const diag = diagnostics.find((d) => d.code === "unknown-field");

    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("error");
  });

  it("can be turned off", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"
  unknown: "value"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace, { rules: { "unknown-field": "off" } });
    const warning = diagnostics.find((d) => d.code === "unknown-field");

    expect(warning).toBeUndefined();
  });
});
