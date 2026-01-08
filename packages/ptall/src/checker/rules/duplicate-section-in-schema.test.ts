import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("duplicate-section-in-schema rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("reports duplicate section names in same schema entry", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Metadata
  confidence: string
  # Sections
  Claim
  Reasoning
  Claim
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-section-in-schema");

    expect(error).toBeDefined();
    expect(error!.message).toContain("Claim");
    expect(error!.message).toContain("Duplicate section");
    expect(error!.severity).toBe("error");
  });

  it("does not report unique section names", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Metadata
  confidence: string
  # Sections
  Claim
  Reasoning
  Caveats
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-section-in-schema");

    expect(error).toBeUndefined();
  });

  it("reports duplicates in alter-entity", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Metadata
  confidence: string
  # Sections
  Claim

2026-01-01T01:00Z alter-entity opinion "Add sections"
  # Sections
  Reasoning
  Reasoning
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-section-in-schema");

    expect(error).toBeDefined();
    expect(error!.message).toContain("Reasoning");
  });

  it("does not report same section in different schema entries", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Sections
  Summary

2026-01-01T01:00Z define-entity lore "Lore entries"
  # Sections
  Summary
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "duplicate-section-in-schema");

    expect(error).toBeUndefined();
  });

  it("reports multiple duplicate sections", () => {
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Sections
  Claim
  Reasoning
  Claim
  Reasoning
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "duplicate-section-in-schema");

    expect(errors).toHaveLength(2);
    const messages = errors.map((e) => e.message).join(" ");
    expect(messages).toContain("Claim");
    expect(messages).toContain("Reasoning");
  });
});
