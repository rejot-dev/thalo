import { describe, it, expect, beforeEach } from "vitest";
import { Workspace } from "../model/workspace.js";
import { findReferences } from "./references.js";

describe("findReferences", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();

    const source1 = `2026-01-05T18:00 create lore "First entry" ^first-entry #test
  type: "fact"
  subject: ^test

  Content.
`;
    const source2 = `2026-01-05T19:00 create lore "Second entry" #test
  type: "insight"
  subject: ^test
  related: ^first-entry

  More content.
`;
    workspace.addDocument(source1, { filename: "file1.ptall" });
    workspace.addDocument(source2, { filename: "file2.ptall" });
  });

  it("finds references to a link", () => {
    const result = findReferences(workspace, "first-entry");

    expect(result.definition).toBeDefined();
    expect(result.references).toHaveLength(1);
    expect(result.references[0].file).toBe("file2.ptall");
    expect(result.references[0].metadataKey).toBe("related");
    expect(result.locations).toHaveLength(2); // definition + 1 reference
  });

  it("finds references for links without definitions", () => {
    // Add a file with a reference to an undefined link
    workspace.addDocument(
      `2026-01-05T20:00 create lore "Third" #test
  type: "fact"
  subject: ^test
  see-also: ^undefined-link
`,
      { filename: "file3.ptall" },
    );

    const result = findReferences(workspace, "undefined-link");

    expect(result.definition).toBeUndefined();
    expect(result.references).toHaveLength(1);
    expect(result.locations).toHaveLength(1); // only the reference
  });
});
