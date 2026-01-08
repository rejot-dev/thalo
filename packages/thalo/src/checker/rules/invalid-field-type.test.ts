import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("invalid-field-type rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string

  # Sections
  Content
`,
      { filename: "schema.thalo" },
    );
  });

  it("reports invalid enum value", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "invalid-value"
  subject: "test"

  # Content
  Test content.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeDefined();
    expect(error!.message).toContain("invalid-value");
    expect(error!.severity).toBe("error");
  });

  it("accepts quoted literal value", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "test"

  # Content
  Test content.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts any quoted string for string type", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
  subject: "any value here"

  # Content
  Test content.
`,
      { filename: "test.thalo" },
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
      `2026-01-01T00:00Z define-entity opinion "Opinions"
  # Metadata
  confidence: "high" | "medium" | "low"
  related?: link[]
  tags?: string[]
  authors?: (string | link)[]

  # Sections
  Claim
`,
      { filename: "schema.thalo" },
    );
  });

  it("accepts valid link array", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test opinion" #test
  confidence: "high"
  related: ^link1, ^link2

  # Claim
  Test claim.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts single link for link array", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test opinion" #test
  confidence: "high"
  related: ^single-link

  # Claim
  Test claim.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts valid quoted string array", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test opinion" #test
  confidence: "high"
  tags: "foo", "bar", "baz"

  # Claim
  Test claim.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts union array with quoted strings and links", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test opinion" #test
  confidence: "high"
  authors: "Jane Doe", ^author-ref, "John Smith"

  # Claim
  Test claim.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });
});

describe("invalid-field-type rule - datetime fields with datetime_value", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity reference "References"
  # Metadata
  ref-type: "article" | "book"
  published?: datetime

  # Sections
  Summary
`,
      { filename: "schema.thalo" },
    );
  });

  it("accepts datetime_value without time for datetime field", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create reference "Test" #test
  ref-type: "article"
  published: 2024-05-11

  # Summary
  Test summary.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("rejects datetime_value with time for datetime field", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create reference "Test" #test
  ref-type: "article"
  published: 2024-05-11T12:00Z

  # Summary
  Test summary.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeDefined();
    expect(error!.message).toContain("datetime");
  });
});

describe("invalid-field-type rule - datetime and date-range arrays", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  dates?: datetime[]
  periods?: date-range[]

  # Sections
  Content
`,
      { filename: "schema.thalo" },
    );
  });

  it("accepts valid datetime array", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test lore" #test
  type: "fact"
  subject: "test"
  dates: 2024-01-01, 2024-05-15, 2024-12-31

  # Content
  Test content.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts valid date-range array", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test lore" #test
  type: "fact"
  subject: "test"
  periods: 2020 ~ 2022, 2023-01 ~ 2024-06

  # Content
  Test content.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("accepts single date-range for date-range array", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test lore" #test
  type: "fact"
  subject: "test"
  periods: 2020-01-01 ~ 2024-12-31

  # Content
  Test content.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    expect(error).toBeUndefined();
  });

  it("reports invalid date-range array", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test lore" #test
  type: "fact"
  subject: "test"
  periods: "2020", "2024"

  # Content
  Test content.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-field-type");

    // Individual dates don't match date-range format
    expect(error).toBeDefined();
    expect(error!.message).toContain("date-range[]");
  });
});
