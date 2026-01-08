import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("actualize-missing-updated rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("reports when actualize has no updated field", () => {
    workspace.addDocument(
      `2026-01-07T10:00Z define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T12:00Z actualize-synthesis ^profile
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "actualize-missing-updated");

    expect(error).toBeDefined();
    expect(error!.severity).toBe("error");
    expect(error!.message).toContain("missing 'updated:' field");
  });

  it("does not report when actualize has updated field", () => {
    workspace.addDocument(
      `2026-01-07T10:00Z define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T12:00Z actualize-synthesis ^profile
  updated: 2026-01-07T12:00Z
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "actualize-missing-updated");

    expect(error).toBeUndefined();
  });

  it("suggests the entry timestamp in error message", () => {
    workspace.addDocument(
      `2026-01-07T10:00Z define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T15:30Z actualize-synthesis ^profile
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "actualize-missing-updated");

    expect(error).toBeDefined();
    expect(error!.message).toContain("2026-01-07T15:30Z");
  });

  it("reports for multiple actualize entries missing updated", () => {
    workspace.addDocument(
      `2026-01-07T10:00Z define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T12:00Z actualize-synthesis ^profile

2026-01-07T14:00Z actualize-synthesis ^profile
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "actualize-missing-updated");

    expect(errors).toHaveLength(2);
  });

  it("can be configured to warning", () => {
    workspace.addDocument(
      `2026-01-07T10:00Z define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T12:00Z actualize-synthesis ^profile
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace, { rules: { "actualize-missing-updated": "warning" } });
    const diag = diagnostics.find((d) => d.code === "actualize-missing-updated");

    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("warning");
  });
});
