import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("unresolved-link rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  related?: string
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports unresolved link in metadata", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  subject: test
  related: ^nonexistent-link
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "unresolved-link");

    expect(warning).toBeDefined();
    expect(warning!.message).toContain("nonexistent-link");
    expect(warning!.severity).toBe("warning");
  });

  it("does not report resolved link by explicit ID", () => {
    workspace.addDocument(
      `2026-01-05T17:00 create lore "First entry" ^my-link #test
  type: fact
  subject: test

2026-01-05T18:00 create lore "Second entry" #test
  type: fact
  subject: test
  related: ^my-link
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "unresolved-link");

    expect(warning).toBeUndefined();
  });

  it("does not report resolved link by timestamp", () => {
    workspace.addDocument(
      `2026-01-05T17:00 create lore "First entry" #test
  type: fact
  subject: test

2026-01-05T18:00 create lore "Second entry" #test
  type: fact
  subject: test
  related: ^2026-01-05T17:00
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "unresolved-link");

    expect(warning).toBeUndefined();
  });

  it("reports multiple unresolved links", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  subject: ^unknown-subject
  related: ^another-unknown
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const warnings = diagnostics.filter((d) => d.code === "unresolved-link");

    expect(warnings).toHaveLength(2);
    const messages = warnings.map((w) => w.message).join(" ");
    expect(messages).toContain("unknown-subject");
    expect(messages).toContain("another-unknown");
  });

  it("resolves links across files", () => {
    workspace.addDocument(
      `2026-01-05T17:00 create lore "First entry" ^my-link #test
  type: fact
  subject: test
`,
      { filename: "file1.ptall" },
    );

    workspace.addDocument(
      `2026-01-05T18:00 create lore "Second entry" #test
  type: fact
  subject: test
  related: ^my-link
`,
      { filename: "file2.ptall" },
    );

    const diagnostics = check(workspace);
    const warning = diagnostics.find((d) => d.code === "unresolved-link");

    expect(warning).toBeUndefined();
  });

  it("can be configured to error", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test" #test
  type: fact
  subject: test
  related: ^nonexistent
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace, { rules: { "unresolved-link": "error" } });
    const diag = diagnostics.find((d) => d.code === "unresolved-link");

    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("error");
  });
});
