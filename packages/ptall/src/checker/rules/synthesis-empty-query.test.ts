import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("synthesis-empty-query rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("does not report when synthesis has valid queries", () => {
    workspace.addDocument(
      `2026-01-07T12:00 define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate a profile.
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "synthesis-empty-query");

    expect(error).toBeUndefined();
  });

  it("does not report when synthesis has multiple valid queries", () => {
    workspace.addDocument(
      `2026-01-07T12:00 define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self, journal where subject = ^self

  # Prompt
  Generate a profile.
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "synthesis-empty-query");

    expect(error).toBeUndefined();
  });

  it("does not report for synthesis without sources (covered by other rule)", () => {
    // This case is covered by synthesis-missing-sources rule
    workspace.addDocument(
      `2026-01-07T12:00 define-synthesis "My Profile" ^profile

  # Prompt
  Generate a profile.
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "synthesis-empty-query");

    // No error from this rule - the synthesis-missing-sources rule handles this case
    expect(error).toBeUndefined();
  });
});
