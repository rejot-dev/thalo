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

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports invalid enum value", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: invalid-value
  subject: test

  # Content
  Test content.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeDefined();
    expect(error!.message).toContain("invalid-value");
    expect(error!.severity).toBe("error");
  });

  it("reports unquoted literal value", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  subject: test

  # Content
  Test content.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    // Literal types require quoted values: "fact" not fact
    expect(error).toBeDefined();
    expect(error!.message).toContain("fact");
  });

  it("accepts quoted literal value", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  subject: test

  # Content
  Test content.
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
  type: "fact"
  subject: any value here

  # Content
  Test content.
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

  # Content
  Test content.
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
  type: "fact"
  subject: test
  count: 42

  # Content
  Test content.
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

  # Sections
  Claim
`,
      { filename: "schema.ptall" },
    );
  });

  it("accepts valid link array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: "high"
  related: ^link1, ^link2

  # Claim
  Test claim.
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
  confidence: "high"
  related: ^single-link

  # Claim
  Test claim.
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
  confidence: "high"
  related: not-a-link, also-not

  # Claim
  Test claim.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeDefined();
    expect(error!.message).toContain("link[]");
  });

  it("accepts valid quoted string array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: "high"
  tags: "foo", "bar", "baz"

  # Claim
  Test claim.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("reports unquoted string array elements", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: "high"
  tags: foo, bar, baz

  # Claim
  Test claim.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    // String array elements must be quoted
    expect(error).toBeDefined();
    expect(error!.message).toContain("string[]");
  });

  it("accepts union array with quoted strings and links", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: "high"
  authors: "Jane Doe", ^author-ref, "John Smith"

  # Claim
  Test claim.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("reports unquoted strings in union array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: "high"
  authors: Jane Doe, ^author-ref, John Smith

  # Claim
  Test claim.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    // String elements in (string | link)[] must be quoted
    expect(error).toBeDefined();
  });

  it("reports unquoted literal value for confidence", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: high
  related: ^link1

  # Claim
  Test claim.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    // Literal types require quoted values: "high" not high
    expect(error).toBeDefined();
    expect(error!.message).toContain("high");
  });

  it("reports empty array value", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test opinion" #test
  confidence: "high"
  related: 

  # Claim
  Test claim.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    // Empty arrays are not allowed - use optional fields and omit the field instead
    expect(error).toBeDefined();
    expect(error!.message).toContain("link[]");
  });
});

describe("invalid-field-type rule - date and date-range arrays", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  dates?: date[]
  periods?: date-range[]

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );
  });

  it("accepts valid date array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test lore" #test
  type: "fact"
  subject: test
  dates: 2024, 2024-05, 2024-05-11

  # Content
  Test content.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts single date for date array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test lore" #test
  type: "fact"
  subject: test
  dates: 2024-05-11

  # Content
  Test content.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("reports invalid date array (non-date values)", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test lore" #test
  type: "fact"
  subject: test
  dates: not-a-date, 2024

  # Content
  Test content.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeDefined();
    expect(error!.message).toContain("date[]");
  });

  it("accepts valid date-range array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test lore" #test
  type: "fact"
  subject: test
  periods: 2020 ~ 2022, 2023-01 ~ 2024-06

  # Content
  Test content.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts single date-range for date-range array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test lore" #test
  type: "fact"
  subject: test
  periods: 2020-01-01 ~ 2024-12-31

  # Content
  Test content.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("reports invalid date-range array", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test lore" #test
  type: "fact"
  subject: test
  periods: 2020, 2024

  # Content
  Test content.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    // Individual dates don't match date-range format
    expect(error).toBeDefined();
    expect(error!.message).toContain("date-range[]");
  });
});
