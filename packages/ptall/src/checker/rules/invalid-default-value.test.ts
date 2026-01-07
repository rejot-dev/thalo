import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("invalid-default-value rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("reports default value that does not match enum type", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight" = "invalid"

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeDefined();
    expect(error!.message).toContain("invalid");
    expect(error!.message).toContain("Invalid default value");
    expect(error!.severity).toBe("error");
  });

  it("accepts valid default value for enum type", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight" = "fact"

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeUndefined();
  });

  it("accepts valid default value with union type", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  status: "unread" | "read" | "processed" = "unread"

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeUndefined();
  });

  it("accepts any quoted default value for string type", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  subject: string = "default subject"

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeUndefined();
  });

  it("accepts link default value for link type", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  ref: link = ^default-ref

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeUndefined();
  });

  it("reports wrong type for link default", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  ref: link = "not-a-link"

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeDefined();
    expect(error!.message).toContain("Invalid default value");
  });

  it("accepts datetime default value for datetime type", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  created: datetime = 2026-01-01

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeUndefined();
  });

  it("reports datetime with time as invalid for datetime type", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  created: datetime = 2026-01-01T10:30

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeDefined();
    expect(error!.message).toContain("Invalid default value");
  });

  it("checks defaults in alter-entity too", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: string

  # Sections
  Content

2026-01-01T01:00 alter-entity lore "Add field with bad default"
  # Metadata
  status: "active" | "inactive" = "pending"
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeDefined();
    expect(error!.message).toContain("pending");
  });

  it("does not report fields without defaults", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeUndefined();
  });

  it("accepts link default for link array type", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  refs: link[] = ^default-ref

  # Sections
  Content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "invalid-default-value");

    expect(error).toBeUndefined();
  });
});
