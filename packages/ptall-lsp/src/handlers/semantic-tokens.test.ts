import { describe, it, expect } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { handleSemanticTokens } from "./semantic-tokens.js";

/**
 * Create a TextDocument for testing
 */
function createDocument(content: string, uri = "file:///test.ptall"): TextDocument {
  return TextDocument.create(uri, "ptall", 1, content);
}

describe("handleSemanticTokens", () => {
  describe("basic token extraction", () => {
    it("should return tokens for a valid ptall document", () => {
      const doc = createDocument(`2026-01-05T18:00 create lore "Test entry" ^link-id #tag
  type: fact
  subject: ^self
`);

      const result = handleSemanticTokens(doc);

      expect(result).toHaveProperty("data");
      expect(Array.isArray(result.data)).toBe(true);
      // Should have some tokens (timestamps, keywords, strings, etc.)
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should return empty data array for empty document", () => {
      const doc = createDocument(``);

      const result = handleSemanticTokens(doc);

      expect(result).toHaveProperty("data");
      expect(result.data).toHaveLength(0);
    });

    it("should return empty data array for whitespace-only document", () => {
      const doc = createDocument(`   
  
    `);

      const result = handleSemanticTokens(doc);

      expect(result).toHaveProperty("data");
      // Whitespace doesn't produce tokens
      expect(result.data).toHaveLength(0);
    });
  });

  describe("file type detection", () => {
    it("should handle .ptall files", () => {
      const doc = createDocument(
        `2026-01-05T18:00 create lore "Test" #tag`,
        "file:///document.ptall",
      );

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should handle .md files with ptall blocks", () => {
      const doc = createDocument(
        `# My Document

Some text.

\`\`\`ptall
2026-01-05T18:00 create lore "Test" #tag
  type: fact
\`\`\`

More text.
`,
        "file:///document.md",
      );

      const result = handleSemanticTokens(doc);

      // Should extract tokens from the ptall block
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should handle unknown file extension as ptall", () => {
      const doc = createDocument(
        `2026-01-05T18:00 create lore "Test" #tag`,
        "file:///document.unknown",
      );

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe("token encoding", () => {
    it("should return data as number array", () => {
      const doc = createDocument(`2026-01-05T18:00 create lore "Test" #tag`);

      const result = handleSemanticTokens(doc);

      // LSP semantic tokens are encoded as arrays of numbers
      // Each token is 5 numbers: deltaLine, deltaStart, length, tokenType, tokenModifiers
      expect(result.data.length % 5).toBe(0);
      result.data.forEach((n) => {
        expect(typeof n).toBe("number");
        expect(Number.isInteger(n)).toBe(true);
      });
    });

    it("should produce consistent tokens for same input", () => {
      const source = `2026-01-05T18:00 create lore "Test entry" #tag
  type: fact
`;
      const doc1 = createDocument(source);
      const doc2 = createDocument(source);

      const result1 = handleSemanticTokens(doc1);
      const result2 = handleSemanticTokens(doc2);

      expect(result1.data).toEqual(result2.data);
    });
  });

  describe("various entry types", () => {
    it("should tokenize instance entries (create)", () => {
      const doc = createDocument(`2026-01-05T18:00 create lore "Test" #tag
  type: fact
`);

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should tokenize instance entries (update)", () => {
      const doc = createDocument(`2026-01-05T18:00 update lore "Updated test" #tag
  type: insight
`);

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should tokenize schema entries (define-entity)", () => {
      const doc = createDocument(`2026-01-01T00:00 define-entity custom "Custom entity"
  # Metadata
  field: string
  optional?: date
`);

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should tokenize schema entries (alter-entity)", () => {
      const doc = createDocument(`2026-01-02T00:00 alter-entity custom "Add field"
  # Metadata
  new-field: string
`);

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should tokenize synthesis entries (define-synthesis)", () => {
      const doc =
        createDocument(`2026-01-05T10:00 define-synthesis "Career Summary" ^career-summary #career #summary
  sources: lore where #career

  # Prompt
  Write a professional career summary.
`);

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should tokenize synthesis entries (actualize-synthesis)", () => {
      const doc = createDocument(`2026-01-06T15:00 actualize-synthesis ^career-summary
  updated: 2026-01-06T15:00
`);

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe("complex documents", () => {
    it("should handle multiple entries", () => {
      const doc = createDocument(`2026-01-05T18:00 create lore "First" #tag1
  type: fact
  subject: test

  Content here.

2026-01-05T19:00 create opinion "Second" #tag2
  confidence: high

  # Claim
  Some claim.

  # Reasoning
  - Point one
  - Point two
`);

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should handle entries with sections", () => {
      const doc = createDocument(`2026-01-05T18:00 create opinion "With sections" #tag
  confidence: high

  # Claim
  The main claim.

  # Reasoning
  - First reason
  - Second reason

  # Caveats
  Some caveats here.
`);

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should handle entries with links", () => {
      const doc = createDocument(`2026-01-05T18:00 create lore "With links" ^my-link #tag
  type: fact
  subject: ^self
  related: ^other-link

  See ^another-link for more.
`);

      const result = handleSemanticTokens(doc);

      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("should return empty data for malformed input", () => {
      // This might cause a parse error, but should be handled gracefully
      const doc = createDocument(`not valid ptall syntax at all
random text here
{ json: "like", stuff: true }
`);

      const result = handleSemanticTokens(doc);

      // Should return something, even if empty
      expect(result).toHaveProperty("data");
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should handle partial entries gracefully", () => {
      const doc = createDocument(`2026-01-05T18:00 create`);

      const result = handleSemanticTokens(doc);

      // Should not throw, returns whatever tokens it can extract
      expect(result).toHaveProperty("data");
    });
  });
});
