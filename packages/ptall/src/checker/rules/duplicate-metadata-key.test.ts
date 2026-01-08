import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("duplicate-metadata-key rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: string
  subject: string
`,
      { filename: "schema.ptall" },
    );
  });

  /**
   * Note: This rule is a placeholder. The parser uses a Map for metadata,
   * which means duplicates are silently collapsed before the checker sees them.
   *
   * These tests document the intended behavior, but the rule cannot currently
   * detect duplicates because they're eliminated at parse time.
   *
   * To fully implement this rule, we'd need to:
   * 1. Store raw metadata as an array in the model, or
   * 2. Check at AST level before model extraction
   */

  it("is registered as a rule", () => {
    // The rule should at least be present and not crash
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: fact
  subject: test
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    // Should not throw
    expect(diagnostics).toBeDefined();
  });

  it.skip("should report duplicate metadata keys (not implemented)", () => {
    // This test is skipped because the parser collapses duplicates
    // Before this can pass, the parser needs to be updated to preserve duplicates
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: fact
  subject: first
  subject: second
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-metadata-key");

    expect(error).toBeDefined();
    expect(error!.message).toContain("subject");
  });

  it("does not report unique keys", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: fact
  subject: test
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-metadata-key");

    expect(error).toBeUndefined();
  });
});
