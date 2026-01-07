import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "ptall",
    plugins: [plugin],
  });
};

describe("comment formatting", () => {
  describe("indented comments (within entries)", () => {
    it("should format comment line after metadata", async () => {
      const input = `2026-01-05T18:00 create lore "Entry with comment"
  type: fact
  // this is a comment
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create lore "Entry with comment"
  type: fact
  // this is a comment
`);
    });

    it("should format comment line between metadata", async () => {
      const input = `2026-01-05T18:00 create reference "Entry"
  url: "https://example.com"
  // commenting out the next field
  ref-type: article
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create reference "Entry"
  url: "https://example.com"
  // commenting out the next field
  ref-type: article
`);
    });

    it("should format multiple comment lines", async () => {
      const input = `2026-01-05T18:00 create lore "Entry"
  type: fact
  // first comment
  // second comment
  subject: acme
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create lore "Entry"
  type: fact
  // first comment
  // second comment
  subject: acme
`);
    });

    it("should format comment line in content section", async () => {
      const input = `2026-01-05T18:00 create opinion "Opinion"
  confidence: high

  # Claim
  This is the main claim.
  // Note: need to research this more
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create opinion "Opinion"
  confidence: high

  # Claim
  This is the main claim.
  // Note: need to research this more
`);
    });

    it("should format comment line between content sections", async () => {
      const input = `2026-01-05T18:00 create opinion "Opinion"
  confidence: high

  # Claim
  Main claim here.
  // transition comment

  # Reasoning
  Supporting reasoning.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create opinion "Opinion"
  confidence: high

  # Claim
  Main claim here.
  // transition comment

  # Reasoning
  Supporting reasoning.
`);
    });

    it("should format entry with only comment in metadata section", async () => {
      const input = `2026-01-05T18:00 create journal "Journal"
  // all metadata commented out

  # Thoughts
  Some thoughts.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create journal "Journal"
  // all metadata commented out

  # Thoughts
  Some thoughts.
`);
    });
  });

  describe("unindented comments (top-level)", () => {
    it("should format comment before entry", async () => {
      const input = `// This is a file-level comment
2026-01-05T18:00 create lore "Entry"
  type: fact
`;

      const output = await format(input);

      expect(output).toBe(`// This is a file-level comment

2026-01-05T18:00 create lore "Entry"
  type: fact
`);
    });

    it("should format comment between entries", async () => {
      const input = `2026-01-05T18:00 create lore "First"
  type: fact

// Comment between entries
2026-01-05T18:01 create lore "Second"
  type: insight
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create lore "First"
  type: fact

// Comment between entries

2026-01-05T18:01 create lore "Second"
  type: insight
`);
    });

    it("should format comment at end of file", async () => {
      const input = `2026-01-05T18:00 create lore "Entry"
  type: fact

// Comment at end of file
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create lore "Entry"
  type: fact

// Comment at end of file
`);
    });

    it("should format multiple consecutive top-level comments", async () => {
      const input = `// First comment
// Second comment
2026-01-05T18:00 create lore "Entry"
  type: fact
`;

      const output = await format(input);

      expect(output).toBe(`// First comment
// Second comment

2026-01-05T18:00 create lore "Entry"
  type: fact
`);
    });

    it("should format mixed indented and unindented comments", async () => {
      const input = `// Top-level comment
2026-01-05T18:00 create lore "Entry"
  type: fact
  // Indented comment

// Another top-level comment
`;

      const output = await format(input);

      expect(output).toBe(`// Top-level comment

2026-01-05T18:00 create lore "Entry"
  type: fact
  // Indented comment

// Another top-level comment
`);
    });
  });
});
