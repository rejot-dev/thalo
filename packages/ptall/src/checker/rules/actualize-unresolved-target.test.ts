import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("actualize-unresolved-target rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("reports when actualize references undefined synthesis", () => {
    workspace.addDocument(
      `2026-01-07T12:00 actualize-synthesis ^nonexistent
  updated: 2026-01-07T12:00
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "actualize-unresolved-target");

    expect(error).toBeDefined();
    expect(error!.severity).toBe("error");
    expect(error!.message).toContain("nonexistent");
    expect(error!.message).toContain("undefined synthesis");
  });

  it("does not report when actualize references defined synthesis", () => {
    workspace.addDocument(
      `2026-01-07T10:00 define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T12:00 actualize-synthesis ^profile
  updated: 2026-01-07T12:00
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "actualize-unresolved-target");

    expect(error).toBeUndefined();
  });

  it("reports when actualize references non-synthesis entry", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore"
  # Metadata
  type: string

  # Sections
  Content

2026-01-07T10:00 create lore "A fact" ^my-fact
  type: fact

  # Content
  Some fact.

2026-01-07T12:00 actualize-synthesis ^my-fact
  updated: 2026-01-07T12:00
`,
      { filename: "entries.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "actualize-unresolved-target");

    expect(error).toBeDefined();
    expect(error!.message).toContain("my-fact");
    expect(error!.message).toContain("not a synthesis definition");
    expect(error!.message).toContain("instance");
  });

  it("resolves synthesis across files", () => {
    workspace.addDocument(
      `2026-01-07T10:00 define-synthesis "My Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.
`,
      { filename: "synthesis.ptall" },
    );

    workspace.addDocument(
      `2026-01-07T12:00 actualize-synthesis ^profile
  updated: 2026-01-07T12:00
`,
      { filename: "actualize.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "actualize-unresolved-target");

    expect(error).toBeUndefined();
  });

  it("reports multiple unresolved targets", () => {
    workspace.addDocument(
      `2026-01-07T12:00 actualize-synthesis ^unknown1
  updated: 2026-01-07T12:00

2026-01-07T13:00 actualize-synthesis ^unknown2
  updated: 2026-01-07T13:00
`,
      { filename: "profile.ptall" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "actualize-unresolved-target");

    expect(errors).toHaveLength(2);
  });
});
