import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";
import { formatParseErrors, parsePtall } from "../parser";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "ptall",
    plugins: [plugin],
  });
};

// Helper to find error nodes - same as in parser.ts but exported for tests
function findErrorNodes(
  node: import("tree-sitter").SyntaxNode,
): import("tree-sitter").SyntaxNode[] {
  const errors: import("tree-sitter").SyntaxNode[] = [];

  if (node.type === "ERROR" || node.isMissing) {
    errors.push(node);
  }

  for (const child of node.children) {
    errors.push(...findErrorNodes(child));
  }

  return errors;
}

describe("parse error handling", () => {
  describe("formatParseErrors", () => {
    it("should report error location with line and column", () => {
      // Missing timestamp causes a parse error
      const source = `create lore "Title"
  type: fact`;
      const tree = parsePtall(source);
      const errorNodes = findErrorNodes(tree.rootNode);

      const message = formatParseErrors(source, errorNodes);

      expect(message).toContain("Line");
      expect(message).toContain("column");
    });

    it("should show context line with pointer", () => {
      // Invalid directive causes a parse error
      const source = `2026-01-05T15:30 invalid lore "Title"
  type: fact`;
      const tree = parsePtall(source);
      const errorNodes = findErrorNodes(tree.rootNode);

      const message = formatParseErrors(source, errorNodes);

      expect(message).toContain("invalid");
      expect(message).toContain("^");
    });

    it("should deduplicate errors on same line", () => {
      const source = `create lore "Title"`;
      const tree = parsePtall(source);
      const errorNodes = findErrorNodes(tree.rootNode);

      // Even if there are nested ERROR nodes, we should deduplicate by line
      const message = formatParseErrors(source, errorNodes);

      // Should show "Parse error at line X"
      expect(message).toMatch(/Parse error at line \d+/);
    });

    it("should include helpful hints", () => {
      const source = `create lore "Title"`;
      const tree = parsePtall(source);
      const errorNodes = findErrorNodes(tree.rootNode);

      const message = formatParseErrors(source, errorNodes);

      expect(message).toContain("section header");
      expect(message).toContain("indented");
    });
  });

  describe("prettier integration", () => {
    it("should throw descriptive error for missing timestamp", async () => {
      const input = `create lore "Title"
  type: fact`;

      await expect(format(input)).rejects.toThrow(/Line \d+, column \d+/);
    });

    it("should throw descriptive error for invalid directive", async () => {
      const input = `2026-01-05T15:30 invalid lore "Title"
  type: fact`;

      await expect(format(input)).rejects.toThrow(/Parse error/i);
    });

    it("should throw descriptive error for unclosed quote", async () => {
      const input = `2026-01-05T15:30 create lore "Unclosed title
  type: fact`;

      await expect(format(input)).rejects.toThrow(/Parse error/i);
    });

    it("should include hint about indentation in error", async () => {
      // Missing timestamp - will produce an error with the hint
      const input = `create lore "Title"`;

      await expect(format(input)).rejects.toThrow(/indented/);
    });

    it("should include hint about section headers", async () => {
      const input = `create lore "Title"`;

      await expect(format(input)).rejects.toThrow(/section header/);
    });

    it("should show specific error location", async () => {
      const input = `2026-01-05T15:30 invalid lore "Title"
  type: fact`;

      try {
        await format(input);
        expect.fail("Should have thrown");
      } catch (e) {
        const message = (e as Error).message;
        // Should include line 1 (where "invalid" is)
        expect(message).toContain("Line 1");
        expect(message).toContain("column");
      }
    });

    it("should not throw for valid input", async () => {
      const input = `2026-01-05T15:30 create lore "Valid title" #tag
  type: fact
`;

      await expect(format(input)).resolves.toBeDefined();
    });

    it("should not throw for valid input with various indentation", async () => {
      // The grammar actually accepts 1-space indentation
      const input = `2026-01-05T15:30 create lore "Title"
 type: fact
`;

      // This should not throw - grammar is lenient
      await expect(format(input)).resolves.toBeDefined();
    });
  });
});
