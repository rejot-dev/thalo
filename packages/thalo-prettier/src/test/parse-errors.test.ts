import { describe, it, expect } from "vitest";
import {
  deduplicateByLine,
  getErrorLine,
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

describe("getErrorLine", () => {
  const source = `line one
line two
line three
line four`;

  it("should return error line", () => {
    expect(getErrorLine(source, 0)).toBe("line one");
    expect(getErrorLine(source, 1)).toBe("line two");
    expect(getErrorLine(source, 2)).toBe("line three");
  });

  it("should handle invalid line index", () => {
    expect(getErrorLine(source, -1)).toBeNull();
    expect(getErrorLine(source, 100)).toBeNull();
  });
});

describe("formatContextDisplay", () => {
  it("should show pointer at column", () => {
    const result = formatContextDisplay("some code here", 6);

    expect(result).toContain("some code here");
    expect(result).toContain("     ^"); // 5 spaces + caret (column 6 = index 5)
  });

  it("should return empty string for empty lines", () => {
    expect(formatContextDisplay("", 1)).toBe("");
  });

  it("should handle column beyond line length", () => {
    const result = formatContextDisplay("short", 10);

    expect(result).toContain("short");
    expect(result).toContain("     ^"); // 5 spaces + caret
  });
});

describe("formatErrorLocation", () => {
  it("should format simple error location", () => {
    const source = `2026-01-07T14:00Z create lore "Test"
  type: "fact"`;

    const loc: ErrorLocation = { line: 2, column: 9, lineIndex: 1 };
    const result = formatErrorLocation(source, loc);

    expect(result).toContain("Line 2, column 9");
    expect(result).toContain('type: "fact"');
    expect(result).toContain("^");
  });

  it("should format error location with filepath", () => {
    const source = `2026-01-07T14:00Z create lore "Test"
  type: "fact"`;

    const loc: ErrorLocation = { line: 2, column: 9, lineIndex: 1 };
    const result = formatErrorLocation(source, loc, "test.thalo");

    expect(result).toContain("test.thalo:2:9");
    expect(result).not.toContain("Line 2, column 9");
  });

  it("should handle end-of-line errors", () => {
    const source = `2026-01-07T14:00Z actualize-synthesis ^bio
  updated: 2026-01-07`;

    // Error past end of first line (line is 42 chars, column 43 is past the end)
    const loc: ErrorLocation = { line: 1, column: 43, lineIndex: 0 };
    const result = formatErrorLocation(source, loc);

    expect(result).toContain("Line 1, column 43");
    expect(result).toContain("2026-01-07T14:00Z actualize-synthesis ^bio");
    expect(result).toContain("^");
  });

  it("should handle invalid line gracefully", () => {
    const source = "single line";
    const loc: ErrorLocation = { line: 10, column: 1, lineIndex: 9 };

    const result = formatErrorLocation(source, loc);

    expect(result).toBe("  Line 10, column 1");
  });
});
