import { describe, it, expect } from "vitest";
import { createWorkspace } from "../../parser.native.js";
import { check } from "../check.js";

describe("synthesis-unknown-query-entity rule", () => {
  const schema = `
2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  subject: string

  # Sections
  Summary
`;

  it("reports unknown entity in synthesis query", () => {
    const ws = createWorkspace();
    ws.addDocument(schema, { filename: "schema.thalo" });
    ws.addDocument(
      `
2026-01-05T10:00Z define-synthesis "My Synthesis" ^my-synthesis
  sources: journal where subject = ^self

  # Prompt
  Summarize my journal entries.
`,
      { filename: "synthesis.thalo" },
    );

    const diagnostics = check(ws);
    const error = diagnostics.find((d) => d.code === "synthesis-unknown-query-entity");

    expect(error).toBeDefined();
    expect(error!.message).toContain("journal");
    expect(error!.message).toContain("Unknown entity type");
  });

  it("reports multiple unknown entities in synthesis query array", () => {
    const ws = createWorkspace();
    ws.addDocument(schema, { filename: "schema.thalo" });
    ws.addDocument(
      `
2026-01-05T10:00Z define-synthesis "My Synthesis" ^my-synthesis
  sources: journal where #tag, opinion where #tag

  # Prompt
  Summarize entries.
`,
      { filename: "synthesis.thalo" },
    );

    const diagnostics = check(ws);
    const errors = diagnostics.filter((d) => d.code === "synthesis-unknown-query-entity");

    expect(errors).toHaveLength(2);
    const messages = errors.map((e) => e.message);
    expect(messages.some((m) => m.includes("journal"))).toBe(true);
    expect(messages.some((m) => m.includes("opinion"))).toBe(true);
  });

  it("does not report for defined entity types", () => {
    const ws = createWorkspace();
    ws.addDocument(schema, { filename: "schema.thalo" });
    ws.addDocument(
      `
2026-01-05T10:00Z define-synthesis "My Synthesis" ^my-synthesis
  sources: lore where subject = ^self

  # Prompt
  Summarize my lore entries.
`,
      { filename: "synthesis.thalo" },
    );

    const diagnostics = check(ws);
    const error = diagnostics.find((d) => d.code === "synthesis-unknown-query-entity");

    expect(error).toBeUndefined();
  });

  it("does not report for synthesis without sources (covered by other rule)", () => {
    const ws = createWorkspace();
    ws.addDocument(schema, { filename: "schema.thalo" });
    ws.addDocument(
      `
2026-01-05T10:00Z define-synthesis "My Synthesis" ^my-synthesis

  # Prompt
  Summarize entries.
`,
      { filename: "synthesis.thalo" },
    );

    const diagnostics = check(ws);
    const error = diagnostics.find((d) => d.code === "synthesis-unknown-query-entity");

    expect(error).toBeUndefined();
  });

  it("respects rule severity configuration", () => {
    const ws = createWorkspace();
    ws.addDocument(schema, { filename: "schema.thalo" });
    ws.addDocument(
      `
2026-01-05T10:00Z define-synthesis "My Synthesis" ^my-synthesis
  sources: journal where #tag

  # Prompt
  Test.
`,
      { filename: "synthesis.thalo" },
    );

    const diagnostics = check(ws, { rules: { "synthesis-unknown-query-entity": "warning" } });
    const diag = diagnostics.find((d) => d.code === "synthesis-unknown-query-entity");

    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("warning");
  });

  it("can be disabled", () => {
    const ws = createWorkspace();
    ws.addDocument(schema, { filename: "schema.thalo" });
    ws.addDocument(
      `
2026-01-05T10:00Z define-synthesis "My Synthesis" ^my-synthesis
  sources: journal where #tag

  # Prompt
  Test.
`,
      { filename: "synthesis.thalo" },
    );

    const diagnostics = check(ws, { rules: { "synthesis-unknown-query-entity": "off" } });
    const error = diagnostics.find((d) => d.code === "synthesis-unknown-query-entity");

    expect(error).toBeUndefined();
  });
});
