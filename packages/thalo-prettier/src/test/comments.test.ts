import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "thalo",
    plugins: [plugin],
  });
};

describe("comment formatting", () => {
  describe("indented comments (within entries)", () => {
    // Note: The grammar's scanner skips comments that appear between metadata lines
    // or between content sections. Only comments at the end of an entry (after all
    // metadata/content) are captured in the AST. This is by design - formatting
    // preserves what the grammar captures.

    it("should format comment line after metadata", async () => {
      const input = `2026-01-05T18:00Z create lore "Entry with comment"
  type: "fact"
  // this is a comment
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create lore "Entry with comment"
  type: "fact"
  // this is a comment
`);
    });

    it("should format comment line between metadata", async () => {
      const input = `2026-01-05T18:00Z create reference "Entry"
  url: "https://example.com"
  // commenting out the next field
  ref-type: "article"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create reference "Entry"
  url: "https://example.com"
  // commenting out the next field
  ref-type: "article"
`);
    });

    it("should format multiple comment lines", async () => {
      const input = `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // first comment
  // second comment
  subject: ^acme
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // first comment
  // second comment
  subject: ^acme
`);
    });

    it("should format unindented comment lines between metadata", async () => {
      const input = `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
// first comment
// second comment
  subject: ^acme
`;

      const output = await format(input);

      // Unindented comments within entries get normalized to indented
      expect(output).toBe(`2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // first comment
  // second comment
  subject: ^acme
`);
    });

    it("should format comment line at end of content section", async () => {
      const input = `2026-01-05T18:00Z create opinion "Opinion"
  confidence: "high"

  # Claim
  This is the main claim.
  // Note: need to research this more
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create opinion "Opinion"
  confidence: "high"

  # Claim
  This is the main claim.
  // Note: need to research this more
`);
    });

    it("should format comment line between content sections", async () => {
      const input = `2026-01-05T18:00Z create opinion "Opinion"
  confidence: "high"

  # Claim
  Main claim here.
  // transition comment

  # Reasoning
  Supporting reasoning.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create opinion "Opinion"
  confidence: "high"

  # Claim
  Main claim here.
  // transition comment

  # Reasoning
  Supporting reasoning.
`);
    });

    it("should format entry with only comment in metadata section", async () => {
      const input = `2026-01-05T18:00Z create journal "Journal"
  // all metadata commented out

  # Thoughts
  Some thoughts.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create journal "Journal"
  // all metadata commented out

  # Thoughts
  Some thoughts.
`);
    });

    it("should format comment line before content section", async () => {
      const input = `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // TODO: add more metadata later

  # Description
  The actual content.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // TODO: add more metadata later

  # Description
  The actual content.
`);
    });

    it("should preserve comment between metadata lines", async () => {
      // Comments can appear between metadata lines
      const input = `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // Note about subject
  subject: ^acme
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // Note about subject
  subject: ^acme
`);
    });

    it("should format comment with special characters", async () => {
      const input = `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // TODO: fix this! @user #tag (see: https://example.com)
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // TODO: fix this! @user #tag (see: https://example.com)
`);
    });
  });

  describe("unindented comments (top-level)", () => {
    it("should format comment before entry", async () => {
      const input = `// This is a file-level comment
2026-01-05T18:00Z create lore "Entry"
  type: "fact"
`;

      const output = await format(input);

      expect(output).toBe(`// This is a file-level comment

2026-01-05T18:00Z create lore "Entry"
  type: "fact"
`);
    });

    it("should format comment between entries", async () => {
      const input = `2026-01-05T18:00Z create lore "First"
  type: "fact"

// Comment between entries
2026-01-05T18:01Z create lore "Second"
  type: "insight"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create lore "First"
  type: "fact"

// Comment between entries

2026-01-05T18:01Z create lore "Second"
  type: "insight"
`);
    });

    it("should format comment at end of file", async () => {
      const input = `2026-01-05T18:00Z create lore "Entry"
  type: "fact"

// Comment at end of file
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create lore "Entry"
  type: "fact"

// Comment at end of file
`);
    });

    it("should format multiple consecutive top-level comments", async () => {
      const input = `// First comment
// Second comment
2026-01-05T18:00Z create lore "Entry"
  type: "fact"
`;

      const output = await format(input);

      expect(output).toBe(`// First comment
// Second comment

2026-01-05T18:00Z create lore "Entry"
  type: "fact"
`);
    });

    it("should format mixed indented and unindented comments", async () => {
      const input = `// Top-level comment
2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // Indented comment

// Another top-level comment
`;

      const output = await format(input);

      expect(output).toBe(`// Top-level comment

2026-01-05T18:00Z create lore "Entry"
  type: "fact"
  // Indented comment

// Another top-level comment
`);
    });

    it("should format unindented comment directly after entry (no blank line)", async () => {
      const input = `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
// Comment right after entry
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create lore "Entry"
  type: "fact"

// Comment right after entry
`);
    });

    it("should treat unindented comment as top-level when followed by new entry", async () => {
      // When an unindented comment is NOT followed by indented content,
      // it ends the current entry and becomes a top-level comment
      const input = `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
// unindented comment ends entry
2026-01-05T18:01Z create lore "Next entry"
  subject: ^acme
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00Z create lore "Entry"
  type: "fact"

// unindented comment ends entry

2026-01-05T18:01Z create lore "Next entry"
  subject: ^acme
`);
    });
  });
});
