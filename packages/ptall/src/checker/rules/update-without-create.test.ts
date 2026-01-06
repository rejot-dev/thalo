import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("update-without-create rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity opinion "Opinion entries"
  # Metadata
  confidence: "high" | "medium" | "low"
  supersedes?: string
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports update superseding a non-create entry", () => {
    workspace.addDocument(
      `2026-01-05T17:00 create opinion "Original" ^original #test
  confidence: high

2026-01-05T18:00 update opinion "First update" ^first-update #test
  confidence: medium
  supersedes: ^original

2026-01-05T19:00 update opinion "Second update" #test
  confidence: low
  supersedes: ^first-update
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "update-without-create");

    expect(warning).toBeDefined();
    expect(warning!.message).toContain("supersedes another 'update' entry");
    expect(warning!.severity).toBe("warning");
  });

  it("does not report update superseding a create entry", () => {
    workspace.addDocument(
      `2026-01-05T17:00 create opinion "Original" ^original #test
  confidence: high

2026-01-05T18:00 update opinion "Updated" #test
  confidence: medium
  supersedes: ^original
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "update-without-create");

    expect(warning).toBeUndefined();
  });

  it("does not report update without supersedes field", () => {
    workspace.addDocument(
      `2026-01-05T18:00 update opinion "Update without supersedes" #test
  confidence: medium
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "update-without-create");

    expect(warning).toBeUndefined();
  });

  it("reports update superseding different entity type", () => {
    workspace.addDocument(
      `2026-01-01T00:01 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  supersedes?: string
`,
      { filename: "schema2.ptall" },
    );

    workspace.addDocument(
      `2026-01-05T17:00 create lore "Lore entry" ^my-lore #test
  type: fact

2026-01-05T18:00 update opinion "Opinion update" #test
  confidence: medium
  supersedes: ^my-lore
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "update-without-create");

    expect(warning).toBeDefined();
    expect(warning!.message).toContain("Entity types should match");
  });

  it("does not report create entries", () => {
    workspace.addDocument(
      `2026-01-05T17:00 create opinion "First" ^first #test
  confidence: high

2026-01-05T18:00 create opinion "Second" #test
  confidence: medium
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "update-without-create");

    expect(warning).toBeUndefined();
  });

  it("works with timestamp references", () => {
    workspace.addDocument(
      `2026-01-05T17:00 create opinion "Original" #test
  confidence: high

2026-01-05T18:00 update opinion "Updated" #test
  confidence: medium
  supersedes: ^2026-01-05T17:00
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "update-without-create");

    expect(warning).toBeUndefined();
  });
});
