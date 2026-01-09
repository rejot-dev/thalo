import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";
import { formatParseErrors, parseThalo, findErrorNodes } from "../parser";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "thalo",
    plugins: [plugin],
  });
};

describe("parse error handling", () => {
  describe("formatParseErrors", () => {
    it("should report error location with line and column", () => {
      // Missing timestamp causes a parse error
      const source = `create lore "Title"
  type: "fact"`;
      const tree = parseThalo(source);
      const errorNodes = findErrorNodes(tree.rootNode);

      const message = formatParseErrors(source, errorNodes);

      expect(message).toContain("Line");
      expect(message).toContain("column");
    });

    it("should show context line with pointer", () => {
      // Invalid directive causes a parse error
      const source = `2026-01-05T15:30Z invalid lore "Title"
  type: "fact"`;
      const tree = parseThalo(source);
      const errorNodes = findErrorNodes(tree.rootNode);

      const message = formatParseErrors(source, errorNodes);

      expect(message).toContain("invalid");
      expect(message).toContain("^");
    });

    it("should deduplicate errors on same line", () => {
      const source = `create lore "Title"`;
      const tree = parseThalo(source);
      const errorNodes = findErrorNodes(tree.rootNode);

      // Even if there are nested ERROR nodes, we should deduplicate by line
      const message = formatParseErrors(source, errorNodes);

      // Should show "Parse error at line X"
      expect(message).toMatch(/Parse error at line \d+/);
    });

    it("should include helpful hints", () => {
      const source = `create lore "Title"`;
      const tree = parseThalo(source);
      const errorNodes = findErrorNodes(tree.rootNode);

      const message = formatParseErrors(source, errorNodes);

      // New hint is about metadata values needing to be quoted
      expect(message).toContain("Hint:");
      expect(message).toContain("quoted strings");
    });
  });

  describe("prettier integration", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("should return original source and warn for missing timestamp", async () => {
      const input = `create lore "Title"
  type: "fact"`;

      const result = await format(input);

      // Should return original source unchanged (with trailing newline)
      expect(result).toBe(input + "\n");

      // Should warn about the error
      expect(warnSpy).toHaveBeenCalled();
      const warning = warnSpy.mock.calls[0]?.[0] as string;
      expect(warning).toContain("syntax errors");
    });

    it("should return original source and warn for invalid directive", async () => {
      const input = `2026-01-05T15:30Z invalid lore "Title"
  type: "fact"`;

      const result = await format(input);

      // Should return original source unchanged
      expect(result).toBe(input + "\n");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("should format successfully for unclosed quote (newline acts as recovery)", async () => {
      // Grammar now treats newline as recovery point for unclosed quotes
      const input = `2026-01-05T15:30Z create lore "Unclosed title
  type: "fact"`;

      const result = await format(input);

      // Should format successfully without warnings (unclosed quote recovers at newline)
      expect(result).toMatchInlineSnapshot(`
        "2026-01-05T15:30Z create lore "Unclosed title
          type: "fact"
        "
      `);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should include hint about metadata values in warning", async () => {
      // Missing timestamp - will produce an error with the hint
      const input = `create lore "Title"`;

      await format(input);

      expect(warnSpy).toHaveBeenCalled();
      const warning = warnSpy.mock.calls[0]?.[0] as string;
      expect(warning).toContain("quoted strings");
    });

    it("should include example in warning hint", async () => {
      const input = `create lore "Title"`;

      await format(input);

      expect(warnSpy).toHaveBeenCalled();
      const warning = warnSpy.mock.calls[0]?.[0] as string;
      expect(warning).toContain('type: "fact"');
    });

    it("should show specific error location in warning", async () => {
      const input = `2026-01-05T15:30Z invalid lore "Title"
  type: "fact"`;

      await format(input);

      expect(warnSpy).toHaveBeenCalled();
      const warning = warnSpy.mock.calls[0]?.[0] as string;
      // Should include line 1 (where "invalid" is)
      expect(warning).toContain("Line 1");
      expect(warning).toContain("column");
    });

    it("should not warn for valid input", async () => {
      const input = `2026-01-05T15:30Z create lore "Valid title" #tag
  type: "fact"
`;

      const result = await format(input);

      expect(result).toBeDefined();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should not warn for valid input with various indentation", async () => {
      // The grammar actually accepts 1-space indentation
      const input = `2026-01-05T15:30Z create lore "Title"
 type: "fact"
`;

      const result = await format(input);

      expect(result).toBeDefined();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should return original source and warn when timezone is forgotten in timestamp", async () => {
      // Missing timezone indicator (Z or +/-HH:MM) at end of timestamp
      const input = `2026-01-05T15:30 create lore "Title"
  type: "fact"`;

      const result = await format(input);

      // Should return original source unchanged
      expect(result).toBe(input + "\n");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("should return original source unchanged when file has any errors", async () => {
      // First entry is invalid (no timezone), second is valid
      // We return original unchanged to avoid tree-sitter error recovery issues
      const input = `2026-01-05T15:30 create lore "Invalid"
  type: "fact"

2026-01-05T18:11Z create lore "Valid Entry"
  type: "fact"
`;

      const result = await format(input);

      // Should warn about errors
      expect(warnSpy).toHaveBeenCalled();

      // Should return original source unchanged (already has trailing newline)
      expect(result).toBe(input);
    });
  });
});
