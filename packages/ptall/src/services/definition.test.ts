import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../model/workspace.js";
import { findDefinition } from "./definition.js";

describe("findDefinition", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();

    const source1 = `2026-01-05T18:00 create lore "First entry" ^first-entry #test
  type: fact
  subject: test

  Content.
`;
    const source2 = `2026-01-05T19:00 create lore "Second entry" #test
  type: insight
  subject: test
  related: ^first-entry

  More content.
`;
    workspace.addDocument(source1, { filename: "file1.ptall" });
    workspace.addDocument(source2, { filename: "file2.ptall" });
  });

  it("finds definition by link ID", () => {
    const result = findDefinition(workspace, "first-entry");

    expect(result).toBeDefined();
    expect(result!.file).toBe("file1.ptall");
    expect(result!.definition.entry.timestamp).toBe("2026-01-05T18:00");
  });

  it("returns undefined for timestamp (timestamps are not link IDs)", () => {
    // Timestamps are not link IDs - only explicit ^link-id creates links
    const result = findDefinition(workspace, "2026-01-05T19:00");

    expect(result).toBeUndefined();
  });

  it("returns undefined for nonexistent link", () => {
    const result = findDefinition(workspace, "nonexistent");

    expect(result).toBeUndefined();
  });
});
