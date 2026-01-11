import { describe, expect, test } from "vitest";
import { tokensToLines, linesToHtml, type HighlightedLine } from "./thalo-highlighter";
import type { SemanticToken } from "@rejot-dev/thalo/services";

describe("tokensToLines", () => {
  test("returns empty line for empty code", () => {
    const result = tokensToLines("", []);

    expect(result).toHaveLength(1);
    expect(result[0].tokens).toHaveLength(1);
    expect(result[0].tokens[0].text).toBe("");
    expect(result[0].tokens[0].style).toBeNull();
  });

  test("handles code with no tokens", () => {
    const code = "hello world";
    const result = tokensToLines(code, []);

    expect(result).toHaveLength(1);
    expect(result[0].tokens).toHaveLength(1);
    expect(result[0].tokens[0].text).toBe("hello world");
    expect(result[0].tokens[0].style).toBeNull();
  });

  test("splits code into multiple lines", () => {
    const code = "line1\nline2\nline3";
    const result = tokensToLines(code, []);

    expect(result).toHaveLength(3);
    expect(result[0].tokens[0].text).toBe("line1");
    expect(result[1].tokens[0].text).toBe("line2");
    expect(result[2].tokens[0].text).toBe("line3");
  });

  test("applies token styles correctly", () => {
    const code = "create opinion";
    // tokenTypes: 0=namespace, 1=type, 2=class, 3=function, 4=property, 5=string, 6=keyword, 7=comment, 8=variable, 9=number, 10=operator, 11=macro
    const tokens: SemanticToken[] = [
      { line: 0, startChar: 0, length: 6, tokenType: 6, tokenModifiers: 0 }, // "create" -> keyword (index 6)
      { line: 0, startChar: 7, length: 7, tokenType: 1, tokenModifiers: 0 }, // "opinion" -> type (index 1)
    ];

    const result = tokensToLines(code, tokens);

    expect(result).toHaveLength(1);
    expect(result[0].tokens).toHaveLength(3);
    expect(result[0].tokens[0].text).toBe("create");
    expect(result[0].tokens[0].style).toBe("color: #c678dd"); // keyword color
    expect(result[0].tokens[1].text).toBe(" ");
    expect(result[0].tokens[1].style).toBeNull();
    expect(result[0].tokens[2].text).toBe("opinion");
    expect(result[0].tokens[2].style).toBe("color: #c678dd"); // type also maps to purple
  });

  test("handles tokens spanning multiple lines", () => {
    const code = "first\nsecond";
    // tokenTypes: 0=namespace, 1=type, 2=class, 3=function, 4=property, 5=string, 6=keyword
    const tokens: SemanticToken[] = [
      { line: 0, startChar: 0, length: 5, tokenType: 6, tokenModifiers: 0 }, // "first" -> keyword (index 6)
      { line: 1, startChar: 0, length: 6, tokenType: 5, tokenModifiers: 0 }, // "second" -> string (index 5)
    ];

    const result = tokensToLines(code, tokens);

    expect(result).toHaveLength(2);
    expect(result[0].tokens[0].text).toBe("first");
    expect(result[0].tokens[0].style).toBe("color: #c678dd"); // keyword
    expect(result[1].tokens[0].text).toBe("second");
    expect(result[1].tokens[0].style).toBe("color: #98c379"); // string
  });

  test("handles unhighlighted text between tokens", () => {
    const code = "a = b + c";
    const tokens: SemanticToken[] = [
      { line: 0, startChar: 0, length: 1, tokenType: 8, tokenModifiers: 0 }, // "a"
      { line: 0, startChar: 4, length: 1, tokenType: 8, tokenModifiers: 0 }, // "b"
      { line: 0, startChar: 8, length: 1, tokenType: 8, tokenModifiers: 0 }, // "c"
    ];

    const result = tokensToLines(code, tokens);

    expect(result).toHaveLength(1);
    // Should have: "a", " = ", "b", " + ", "c"
    expect(result[0].tokens.map((t) => t.text)).toEqual(["a", " = ", "b", " + ", "c"]);
  });

  test("handles empty lines", () => {
    const code = "line1\n\nline3";
    const result = tokensToLines(code, []);

    expect(result).toHaveLength(3);
    expect(result[0].tokens[0].text).toBe("line1");
    expect(result[1].tokens[0].text).toBe("");
    expect(result[2].tokens[0].text).toBe("line3");
  });
});

describe("linesToHtml", () => {
  test("returns empty string for empty lines array", () => {
    const result = linesToHtml([]);
    expect(result).toBe("");
  });

  test("wraps each line in span.line", () => {
    const lines: HighlightedLine[] = [
      { tokens: [{ text: "hello", style: null }] },
      { tokens: [{ text: "world", style: null }] },
    ];

    const result = linesToHtml(lines);

    expect(result).toContain('<span class="line">hello</span>');
    expect(result).toContain('<span class="line">world</span>');
  });

  test("applies inline styles to tokens", () => {
    const lines: HighlightedLine[] = [
      {
        tokens: [
          { text: "create", style: "color: #c678dd" },
          { text: " ", style: null },
          { text: "opinion", style: "color: #c678dd" },
        ],
      },
    ];

    const result = linesToHtml(lines);

    expect(result).toContain('<span style="color: #c678dd">create</span>');
    expect(result).toContain('<span style="color: #c678dd">opinion</span>');
    expect(result).toContain(" "); // Space without span
  });

  test("escapes HTML special characters", () => {
    const lines: HighlightedLine[] = [
      { tokens: [{ text: '<script>alert("xss")</script>', style: null }] },
    ];

    const result = linesToHtml(lines);

    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
    expect(result).toContain("&quot;");
  });

  test("joins lines with newlines", () => {
    const lines: HighlightedLine[] = [
      { tokens: [{ text: "line1", style: null }] },
      { tokens: [{ text: "line2", style: null }] },
    ];

    const result = linesToHtml(lines);
    const lineCount = result.split("\n").length;

    expect(lineCount).toBe(2);
  });

  test("handles empty tokens", () => {
    const lines: HighlightedLine[] = [{ tokens: [{ text: "", style: null }] }];

    const result = linesToHtml(lines);

    expect(result).toBe('<span class="line"></span>');
  });

  test("handles multiple tokens per line", () => {
    const lines: HighlightedLine[] = [
      {
        tokens: [
          { text: "2026", style: "color: #e67e22" },
          { text: "-01-08", style: null },
          { text: "create", style: "color: #c678dd" },
        ],
      },
    ];

    const result = linesToHtml(lines);

    expect(result).toBe(
      '<span class="line"><span style="color: #e67e22">2026</span>-01-08<span style="color: #c678dd">create</span></span>',
    );
  });
});
