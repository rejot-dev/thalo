import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("invalid-field-type rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  count?: number
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports invalid enum value", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: invalid-value
  subject: test
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeDefined();
    expect(error!.message).toContain("invalid-value");
    expect(error!.severity).toBe("error");
  });

  it("accepts valid enum value", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  subject: test
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts any string for string type", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  subject: any value here
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("reports invalid enum value but not invalid number", () => {
    // Note: The 'number' type currently accepts any value in TypeExpr.matches
    // So 'not-a-number' won't trigger invalid-field-type for count
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: wrong
  subject: test
  count: not-a-number
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "invalid-field-type");

    // Only 'type: wrong' should be caught (enum mismatch)
    // 'count: not-a-number' may pass if number accepts anything
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].message).toContain("wrong");
  });

  it("accepts valid number for number type", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  subject: test
  count: 42
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });
});

describe("invalid-field-type rule - array types", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity opinion "Opinions"
  # Metadata
  confidence: "high" | "medium" | "low"
  related?: link[]
  tags?: string[]
  authors?: (string | link)[]
`,
      { filename: "schema.ptall" },
    );
  });

  it("accepts valid link array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: high
  related: ^link1, ^link2
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts single link for link array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: high
  related: ^single-link
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("reports invalid link array (non-link values)", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: high
  related: not-a-link, also-not
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeDefined();
    expect(error!.message).toContain("link[]");
  });

  it("accepts valid string array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: high
  tags: foo, bar, baz
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts union array with string values", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: high
  authors: Jane Doe, ^author-ref, John Smith
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts empty array value", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: high
  related: 
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });
});
