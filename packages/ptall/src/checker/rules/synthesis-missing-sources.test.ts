import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("synthesis-missing-sources rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("reports when synthesis has no sources field", () => {
    workspace.addDocument(
      `2026-01-07T12:00 define-synthesis "My Profile" ^profile

  # Prompt
  Generate a profile.
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "synthesis-missing-sources");

    expect(error).toBeDefined();
    expect(error!.severity).toBe("error");
    expect(error!.message).toContain("My Profile");
    expect(error!.message).toContain("missing a 'sources:' field");
  });

  it("does not report when synthesis has sources", () => {
    workspace.addDocument(
      `2026-01-07T12:00 define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate a profile.
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "synthesis-missing-sources");

    expect(error).toBeUndefined();
  });

  it("does not report for non-synthesis entries", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore"
  # Metadata
  type: string

  # Sections
  Content

2026-01-07T12:00 create lore "Test" #test
  type: fact

  # Content
  Test content.
`,
      { filename: "entries.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "synthesis-missing-sources");

    expect(error).toBeUndefined();
  });
});
