import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("duplicate-section-heading rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Metadata
  confidence: "high" | "medium" | "low"
  # Sections
  Claim
  Reasoning
  Caveats?
`,
      { filename: "schema.thalo" },
    );
  });

  it("reports duplicate section headings in content", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test" #test
  confidence: high

  # Claim
  First claim.

  # Reasoning
  My reasoning.

  # Claim
  Second claim (duplicate).
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-section-heading");

    expect(error).toBeDefined();
    expect(error!.message).toContain("Claim");
    expect(error!.message).toContain("Duplicate section heading");
    expect(error!.severity).toBe("error");
  });

  it("does not report unique section headings", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test" #test
  confidence: high

  # Claim
  My claim.

  # Reasoning
  My reasoning.

  # Caveats
  My caveats.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-section-heading");

    expect(error).toBeUndefined();
  });

  it("reports multiple duplicate headings", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test" #test
  confidence: high

  # Claim
  First claim.

  # Reasoning
  First reasoning.

  # Claim
  Second claim.

  # Reasoning
  Second reasoning.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-section-heading");

    expect(errors).toHaveLength(2);
    const messages = errors.map((e) => e.message).join(" ");
    expect(messages).toContain("Claim");
    expect(messages).toContain("Reasoning");
  });

  it("does not confuse sections across entries", () => {
    workspace.addDocument(
      `2026-01-05T17:00Z create opinion "First" #test
  confidence: high

  # Claim
  First claim.

  # Reasoning
  First reasoning.

2026-01-05T18:00Z create opinion "Second" #test
  confidence: low

  # Claim
  Second claim.

  # Reasoning
  Second reasoning.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-section-heading");

    // Same section names in different entries should be fine
    expect(error).toBeUndefined();
  });
});
