import { describe, it, expect } from "vitest";
import { createWorkspace } from "./parser.native.js";
import type { Workspace } from "./model/workspace.js";

/**
 * Helper to create a workspace from a file structure.
 * Keys are filenames, values are file contents.
 */
function workspaceFromFiles(files: Record<string, string>): Workspace {
  const ws = createWorkspace();
  for (const [filename, content] of Object.entries(files)) {
    ws.addDocument(content, { filename });
  }
  return ws;
}

describe("integration", () => {
  it("should resolve cross-file link references", () => {
    const ws = workspaceFromFiles({
      "schema.thalo": `
2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  subject: string
  related?: link

  # Sections
  Content
`,
      "entries.thalo": `
2026-01-05T10:00Z create lore "First entry" ^first-entry
  subject: "Test"

  # Content
  This is the first entry.

2026-01-05T11:00Z create lore "Second entry" ^second-entry
  subject: "Test"
  related: ^first-entry

  # Content
  This references the first entry.
`,
    });

    // Link should be defined
    const def = ws.getLinkDefinition("first-entry");
    expect(def).toBeDefined();
    expect(def!.file).toBe("entries.thalo");

    // Link should be referenced (in metadata field)
    const refs = ws.getLinkReferences("first-entry");
    expect(refs).toHaveLength(1);
    expect(refs[0].file).toBe("entries.thalo");
    expect(refs[0].context).toBe("related");
  });
});
