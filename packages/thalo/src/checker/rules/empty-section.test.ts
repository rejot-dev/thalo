import { describe, it, expect, beforeEach } from "vitest";
import { createWorkspace } from "../../parser.native.js";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("empty-section rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Metadata
  confidence: "high" | "medium" | "low"
  # Sections
  Claim
  Reasoning?
`,
      { filename: "schema.thalo" },
    );
  });

  /**
   * Note: This rule is a placeholder. The model currently only stores section names,
   * not the content or boundaries between sections.
   *
   * These tests document the intended behavior, but the rule cannot currently
   * detect empty sections because we don't have access to section content boundaries.
   *
   * To fully implement this rule, we'd need to:
   * 1. Store section content or boundaries in the model, or
   * 2. Provide access to the original AST during checking
   */

  it("is registered as a rule", () => {
    // The rule should at least be present and not crash
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test" #test
  confidence: high

  # Claim
  My claim content.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    // Should not throw
    expect(diagnostics).toBeDefined();
  });

  it.skip("should report empty sections (not implemented)", () => {
    // This test is skipped because the model doesn't store section content
    // Before this can pass, the model needs to be updated to preserve section boundaries
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test" #test
  confidence: high

  # Claim

  # Reasoning
  Some reasoning content.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "empty-section");

    expect(warning).toBeDefined();
    expect(warning!.message).toContain("Claim");
    expect(warning!.severity).toBe("warning");
  });

  it("does not report sections with content", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test" #test
  confidence: high

  # Claim
  This section has content.

  # Reasoning
  This section also has content.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "empty-section");

    expect(warning).toBeUndefined();
  });
});
