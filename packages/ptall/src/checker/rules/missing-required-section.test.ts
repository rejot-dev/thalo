import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("missing-required-section rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity opinion "Opinion entries"
  # Metadata
  confidence: "high" | "medium" | "low"
  # Sections
  Claim
  Reasoning
  Caveats?
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports missing required section", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test" #test
  confidence: high

  # Claim
  My claim here.
`,
      { filename: "test.ptall" },
    );
    // Missing "Reasoning" which is required

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "missing-required-section");

    expect(error).toBeDefined();
    expect(error!.message).toContain("Reasoning");
    expect(error!.severity).toBe("error");
  });

  it("does not report when all required sections present", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test" #test
  confidence: high

  # Claim
  My claim here.

  # Reasoning
  My reasoning here.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "missing-required-section");

    expect(error).toBeUndefined();
  });

  it("does not report missing optional section", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test" #test
  confidence: high

  # Claim
  My claim here.

  # Reasoning
  My reasoning here.
`,
      { filename: "test.ptall" },
    );
    // Missing "Caveats" which is optional

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "missing-required-section");

    expect(error).toBeUndefined();
  });

  it("reports multiple missing required sections", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create opinion "Test" #test
  confidence: high

  # Caveats
  Some caveats.
`,
      { filename: "test.ptall" },
    );
    // Missing both "Claim" and "Reasoning"

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "missing-required-section");

    expect(errors).toHaveLength(2);
    const messages = errors.map((e) => e.message).join(" ");
    expect(messages).toContain("Claim");
    expect(messages).toContain("Reasoning");
  });
});
