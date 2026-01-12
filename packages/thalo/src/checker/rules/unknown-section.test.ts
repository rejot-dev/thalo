import { describe, it, expect, beforeEach } from "vitest";
import { createWorkspace } from "../../parser.native.js";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("unknown-section rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Metadata
  confidence: "high" | "medium" | "low"
  # Sections
  Claim
  Reasoning
`,
      { filename: "schema.thalo" },
    );
  });

  it("reports unknown section", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test" #test
  confidence: high

  # Claim
  My claim.

  # Reasoning
  My reasoning.

  # Extra
  This section is not defined.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "unknown-section");

    expect(warning).toBeDefined();
    expect(warning!.message).toContain("Extra");
    expect(warning!.severity).toBe("warning");
  });

  it("does not report known sections", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test" #test
  confidence: high

  # Claim
  My claim.

  # Reasoning
  My reasoning.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "unknown-section");

    expect(warning).toBeUndefined();
  });

  it("reports multiple unknown sections", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test" #test
  confidence: high

  # Claim
  My claim.

  # Reasoning
  My reasoning.

  # Extra1
  Extra content.

  # Extra2
  More extra content.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "unknown-section");

    expect(warnings).toHaveLength(2);
    const messages = warnings.map((w) => w.message).join(" ");
    expect(messages).toContain("Extra1");
    expect(messages).toContain("Extra2");
  });

  it("can be configured to error", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create opinion "Test" #test
  confidence: high

  # Claim
  Claim.

  # Reasoning
  Reasoning.

  # Unknown
  Unknown section.
`,
      { filename: "test.thalo" },
    );

    const diagnostics = check(workspace, { rules: { "unknown-section": "error" } });
    const diag = diagnostics.find((d) => d.code === "unknown-section");

    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("error");
  });
});
