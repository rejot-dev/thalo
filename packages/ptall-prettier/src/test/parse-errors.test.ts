import { describe, it, expect } from "vitest";
import {
  deduplicateByLine,
  getErrorContext,
  findValuePosition,
  formatContextDisplay,
  formatErrorLocation,
  type ErrorLocation,
} from "../parse-errors";

describe("deduplicateByLine", () => {
  it("should remove duplicate lines", () => {
    const locations: ErrorLocation[] = [
      { line: 1, column: 5, lineIndex: 0 },
      { line: 1, column: 10, lineIndex: 0 },
      { line: 2, column: 3, lineIndex: 1 },
    ];

    const result = deduplicateByLine(locations);

    expect(result).toEqual([
      { line: 1, column: 5, lineIndex: 0 },
      { line: 2, column: 3, lineIndex: 1 },
    ]);
  });

  it("should keep first occurrence when duplicates exist", () => {
    const locations: ErrorLocation[] = [
      { line: 5, column: 1, lineIndex: 4 },
      { line: 5, column: 20, lineIndex: 4 },
      { line: 5, column: 30, lineIndex: 4 },
    ];

    const result = deduplicateByLine(locations);

    expect(result).toHaveLength(1);
    expect(result[0].column).toBe(1);
  });

  it("should handle empty input", () => {
    expect(deduplicateByLine([])).toEqual([]);
  });

  it("should handle single location", () => {
    const locations: ErrorLocation[] = [{ line: 1, column: 1, lineIndex: 0 }];
    expect(deduplicateByLine(locations)).toEqual(locations);
  });
});

describe("getErrorContext", () => {
  const source = `line one
line two
line three
line four`;

  it("should return error line when error is mid-line", () => {
    const result = getErrorContext(source, 0, 3);

    expect(result.lines).toEqual(["line one"]);
    expect(result.errorAtEndOfLine).toBe(false);
  });

  it("should include following lines when error is at end of line", () => {
    const result = getErrorContext(source, 0, 8); // "line one" has length 8

    expect(result.lines).toEqual(["line one", "line two", "line three"]);
    expect(result.errorAtEndOfLine).toBe(true);
  });

  it("should skip blank lines when gathering context", () => {
    const sourceWithBlanks = `header line

  content line`;

    const result = getErrorContext(sourceWithBlanks, 0, 11);

    expect(result.lines).toEqual(["header line", "  content line"]);
    expect(result.errorAtEndOfLine).toBe(true);
  });

  it("should handle invalid line index", () => {
    expect(getErrorContext(source, -1, 0)).toEqual({
      lines: [],
      errorAtEndOfLine: false,
    });

    expect(getErrorContext(source, 100, 0)).toEqual({
      lines: [],
      errorAtEndOfLine: false,
    });
  });

  it("should limit context to 2 following lines", () => {
    const result = getErrorContext(source, 0, 8);

    // Should have original + max 2 following lines
    expect(result.lines.length).toBeLessThanOrEqual(3);
  });
});

describe("findValuePosition", () => {
  it("should find position after colon and space", () => {
    expect(findValuePosition('  type: "fact"')).toBe(8);
    expect(findValuePosition("  subject: ^self")).toBe(11);
  });

  it("should handle no space after colon", () => {
    expect(findValuePosition("  key:value")).toBe(6);
  });

  it("should return null for non-metadata lines", () => {
    expect(findValuePosition("just some text")).toBeNull();
    expect(findValuePosition("# Header")).toBeNull();
    expect(findValuePosition("")).toBeNull();
  });

  it("should handle various indentation", () => {
    expect(findValuePosition("key: value")).toBe(5);
    expect(findValuePosition("    key: value")).toBe(9);
  });
});

describe("formatContextDisplay", () => {
  it("should show pointer at column for mid-line errors", () => {
    const result = formatContextDisplay(["some code here"], false, 6);

    expect(result).toContain("some code here");
    expect(result).toContain("     ^"); // 5 spaces + caret (column 6 = index 5)
  });

  it("should show following line hint for end-of-line errors", () => {
    const result = formatContextDisplay(["header", "  key: value"], true, 7);

    expect(result).toContain("header");
    expect(result).toContain("(error may be on following line)");
    expect(result).toContain("key: value");
    expect(result).toContain("^ check this value");
  });

  it("should return empty string for empty lines", () => {
    expect(formatContextDisplay([], false, 1)).toBe("");
  });

  it("should handle end-of-line error with no following lines", () => {
    const result = formatContextDisplay(["only line"], true, 10);

    expect(result).toContain("only line");
    // Should still work, just won't have "check this value" hint
    expect(result).not.toContain("check this value");
  });
});

describe("formatErrorLocation", () => {
  it("should format simple error location", () => {
    const source = `2026-01-07T14:00 create lore "Test"
  type: "fact"`;

    const loc: ErrorLocation = { line: 2, column: 9, lineIndex: 1 };
    const result = formatErrorLocation(source, loc);

    expect(result).toContain("Line 2, column 9");
    expect(result).toContain('type: "fact"');
  });

  it("should handle end-of-line errors with context", () => {
    const source = `2026-01-07T14:00 actualize-synthesis ^bio
  updated: 2026-01-07`;

    // Error past end of first line (line is 41 chars, column 42 is past the end)
    const loc: ErrorLocation = { line: 1, column: 42, lineIndex: 0 };
    const result = formatErrorLocation(source, loc);

    expect(result).toContain("Line 1, column 42");
    expect(result).toContain("error may be on following line");
    expect(result).toContain("updated:");
    expect(result).toContain("check this value");
  });

  it("should handle invalid line gracefully", () => {
    const source = "single line";
    const loc: ErrorLocation = { line: 10, column: 1, lineIndex: 9 };

    const result = formatErrorLocation(source, loc);

    expect(result).toBe("  Line 10, column 1");
  });
});
