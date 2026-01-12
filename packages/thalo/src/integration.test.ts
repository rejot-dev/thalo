import { describe, it, expect } from "vitest";
import { createWorkspace } from "./parser.native.js";
import type { Workspace } from "./model/workspace.js";
import { check } from "./checker/check.js";

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
  it("accidentally forgot to add a timezone to the timestamp", () => {
    const ws = workspaceFromFiles({
      "schema.thalo": `
2026-01-07T11:40Z define-entity reference "External resources or local files"
  # Metadata
  published?: datetime ; "Publication date"
  ref-type: "article" | "video" | "tweet" | "paper" | "book" | "other"

  # Sections
  Summary ; "Brief summary of the content"
`,
      "entries.thalo": `
2026-01-05T10:00 create reference "First entry" ^first-entry
  published: 2026-01-01
  ref-type: "article"

  # Summary
  This is the first entry.
`,
    });

    const diagnostics = check(ws);

    expect(diagnostics).toMatchInlineSnapshot(`
      [
        {
          "code": "syntax-missing_timezone",
          "file": "entries.thalo",
          "location": {
            "endIndex": 17,
            "endPosition": {
              "column": 16,
              "row": 1,
            },
            "startIndex": 17,
            "startPosition": {
              "column": 16,
              "row": 1,
            },
          },
          "message": "Timestamp requires timezone (e.g., Z or +05:30)",
          "severity": "error",
        },
      ]
    `);
  });

  it("accidentally created a 'date-time' field instead of 'datetime'", () => {
    const ws = workspaceFromFiles({
      "schema.thalo": `
2026-01-07T11:40Z define-entity reference "External resources or local files"
  # Metadata
  published?: date-time ; "Publication date"
  ref-type: "article" | "video" | "tweet" | "paper" | "book" | "other"

  # Sections
  Summary ; "Brief summary of the content"
`,
      "entries.thalo": `
2026-01-05T10:00Z create reference "First entry" ^first-entry
  published: 2026-01-01
  ref-type: "article"

  # Summary
  This is the first entry.
`,
    });

    const diagnostics = check(ws);
    expect(diagnostics).toMatchInlineSnapshot(`
      [
        {
          "code": "syntax-unknown_type",
          "file": "schema.thalo",
          "location": {
            "endIndex": 115,
            "endPosition": {
              "column": 23,
              "row": 3,
            },
            "startIndex": 106,
            "startPosition": {
              "column": 14,
              "row": 3,
            },
          },
          "message": "Unknown type 'date-time'. Valid types: string, datetime, date-range, link",
          "severity": "error",
        },
      ]
    `);
  });
});
