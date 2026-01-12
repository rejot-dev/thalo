import { describe, it, expect, beforeEach } from "vitest";
import { createWorkspace } from "../../parser.native.js";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("synthesis-missing-prompt rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  it("reports when synthesis has no prompt section", () => {
    workspace.addDocument(
      `2026-01-07T12:00Z define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self
`,
      { filename: "profile.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "synthesis-missing-prompt");

    expect(warning).toBeDefined();
    expect(warning!.severity).toBe("warning");
    expect(warning!.message).toContain("My Profile");
    expect(warning!.message).toContain("missing a '# Prompt' section");
  });

  it("reports when prompt section is empty", () => {
    workspace.addDocument(
      `2026-01-07T12:00Z define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
`,
      { filename: "profile.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "synthesis-missing-prompt");

    expect(warning).toBeDefined();
  });

  it("does not report when synthesis has prompt content", () => {
    workspace.addDocument(
      `2026-01-07T12:00Z define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate a narrative profile from the lore entries.
  Keep it professional but personal.
`,
      { filename: "profile.thalo" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "synthesis-missing-prompt");

    expect(warning).toBeUndefined();
  });

  it("can be configured to error", () => {
    workspace.addDocument(
      `2026-01-07T12:00Z define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self
`,
      { filename: "profile.thalo" },
    );

    const diagnostics = check(workspace, { rules: { "synthesis-missing-prompt": "error" } });
    const error = diagnostics.find((d) => d.code === "synthesis-missing-prompt");

    expect(error).toBeDefined();
    expect(error!.severity).toBe("error");
  });

  it("can be turned off", () => {
    workspace.addDocument(
      `2026-01-07T12:00Z define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self
`,
      { filename: "profile.thalo" },
    );

    const diagnostics = check(workspace, { rules: { "synthesis-missing-prompt": "off" } });
    const warning = diagnostics.find((d) => d.code === "synthesis-missing-prompt");

    expect(warning).toBeUndefined();
  });
});
