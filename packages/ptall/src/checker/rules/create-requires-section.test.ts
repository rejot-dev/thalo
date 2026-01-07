import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("create-requires-section rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string

  # Sections
  Content: The main content
`,
      { filename: "schema.ptall" },
    );
  });

  it("reports error when create has no sections", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Test entry" #test
  type: fact
  subject: test

  This is just plain content without a section heading.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "create-requires-section");

    expect(error).toBeDefined();
    expect(error!.message).toContain("Test entry");
    expect(error!.message).toContain("at least one section");
    expect(error!.severity).toBe("error");
  });

  it("reports error for create with only metadata", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Metadata only" #test
  type: fact
  subject: test
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "create-requires-section");

    expect(error).toBeDefined();
    expect(error!.message).toContain("Metadata only");
  });

  it("accepts create with one section", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Valid entry" #test
  type: fact
  subject: test

  # Content
  This is the main content.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "create-requires-section");

    expect(error).toBeUndefined();
  });

  it("accepts create with multiple sections", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Multi-section entry" #test
  type: insight
  subject: test

  # Content
  Main content here.

  # Notes
  Additional notes.
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "create-requires-section");

    expect(error).toBeUndefined();
  });

  it("does not report error for update without sections", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "Original entry" ^original #test
  type: fact
  subject: test

  # Content
  Original content.

2026-01-06T10:00 update lore "Update without sections" #test
  supersedes: ^original
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "create-requires-section");

    expect(errors.length).toBe(0);
  });

  it("reports multiple errors for multiple creates without sections", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "First entry" #test
  type: fact
  subject: test

2026-01-05T19:00 create lore "Second entry" #test
  type: insight
  subject: test
`,
      { filename: "test.ptall" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "create-requires-section");

    expect(errors.length).toBe(2);
    expect(errors.some((e) => e.message.includes("First entry"))).toBe(true);
    expect(errors.some((e) => e.message.includes("Second entry"))).toBe(true);
  });

  it("works across multiple files", () => {
    workspace.addDocument(
      `2026-01-05T18:00 create lore "File 1 entry" #test
  type: fact
  subject: test
`,
      { filename: "file1.ptall" },
    );

    workspace.addDocument(
      `2026-01-05T19:00 create lore "File 2 entry" #test
  type: insight
  subject: test
`,
      { filename: "file2.ptall" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "create-requires-section");

    expect(errors.length).toBe(2);
    expect(errors.some((e) => e.file === "file1.ptall")).toBe(true);
    expect(errors.some((e) => e.file === "file2.ptall")).toBe(true);
  });
});
