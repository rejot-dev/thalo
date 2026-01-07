import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../../model/workspace.js";
import { check } from "../check.js";

describe("define-entity-requires-section rule", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("reports error when define-entity has no sections", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "define-entity-requires-section");

    expect(error).toBeDefined();
    expect(error!.message).toContain("lore");
    expect(error!.message).toContain("at least one section");
    expect(error!.severity).toBe("error");
  });

  it("reports error for entity with only metadata", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity opinion "Opinions"
  # Metadata
  confidence: "high" | "medium" | "low"
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "define-entity-requires-section");

    expect(error).toBeDefined();
    expect(error!.message).toContain("opinion");
  });

  it("accepts define-entity with one section", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"

  # Sections
  Content: The main content
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "define-entity-requires-section");

    expect(error).toBeUndefined();
  });

  it("accepts define-entity with multiple sections", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity opinion "Opinions"
  # Metadata
  confidence: "high" | "medium" | "low"

  # Sections
  Claim: The main claim
  Reasoning: Supporting arguments
  Caveats?: Optional limitations
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const error = diagnostics.find((d) => d.code === "define-entity-requires-section");

    expect(error).toBeUndefined();
  });

  it("does not report error for alter-entity without sections", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"

  # Sections
  Content: The main content

2026-01-02T00:00 alter-entity lore "Add date field"
  # Metadata
  date?: datetime
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "define-entity-requires-section");

    expect(errors.length).toBe(0);
  });

  it("reports multiple errors for multiple entities without sections", () => {
    workspace.addDocument(
      `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"

2026-01-01T00:01 define-entity opinion "Opinions"
  # Metadata
  confidence: "high" | "medium" | "low"
`,
      { filename: "schema.ptall" },
    );

    const diagnostics = check(workspace);
    const errors = diagnostics.filter((d) => d.code === "define-entity-requires-section");

    expect(errors.length).toBe(2);
    expect(errors.some((e) => e.message.includes("lore"))).toBe(true);
    expect(errors.some((e) => e.message.includes("opinion"))).toBe(true);
  });
});
