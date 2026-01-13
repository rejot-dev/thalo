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

    it("should return original source silently for missing timestamp", async () => {
      const input = `create lore "Title"
  type: "fact"`;

      const result = await format(input);

      // Should return original source unchanged (with trailing newline)
      expect(result).toBe(input + "\n");

      // Should NOT warn - the format command handles error reporting
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should return original source silently for invalid directive", async () => {
      const input = `2026-01-05T15:30Z invalid lore "Title"
  type: "fact"`;

      const result = await format(input);

      // Should return original source unchanged
      expect(result).toBe(input + "\n");
      // Should NOT warn - the format command handles error reporting
      expect(warnSpy).not.toHaveBeenCalled();
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

    it("should return original source silently for missing timestamp", async () => {
      // Missing timestamp - will produce an error
      const input = `create lore "Title"`;

      const result = await format(input);

      // Should return original source unchanged (with trailing newline)
      expect(result).toBe(input + "\n");
      // Should NOT warn - the format command handles error reporting
      expect(warnSpy).not.toHaveBeenCalled();
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

    it("should format successfully when timezone is missing (semantic error caught by checker)", async () => {
      // Missing timezone indicator (Z or +/-HH:MM) at end of timestamp
      // Grammar accepts this - error is caught in AST builder and reported by checker
      const input = `2026-01-05T15:30 create lore "Title"
  type: "fact"`;

      const result = await format(input);

      // Should format successfully (no parse error, just semantic error)
      expect(result).toBeDefined();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should format successfully when one entry has missing timezone", async () => {
      // First entry is missing timezone, second is valid
      // Grammar accepts both - missing timezone is a semantic error
      const input = `2026-01-05T15:30 create lore "Missing TZ"
  type: "fact"

2026-01-05T18:11Z create lore "Valid Entry"
  type: "fact"
`;

      const result = await format(input);

      // Should format successfully (no parse errors)
      expect(result).toBeDefined();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
