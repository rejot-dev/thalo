import { describe, it, expect } from "vitest";
import { LineIndex, computeEdit } from "./line-index.js";

describe("LineIndex", () => {
  describe("constructor", () => {
    it("should handle empty string", () => {
      const index = new LineIndex("");
      expect(index.lineCount).toBe(1);
    });

    it("should count lines correctly", () => {
      const index = new LineIndex("line1\nline2\nline3");
      expect(index.lineCount).toBe(3);
    });

    it("should handle trailing newline", () => {
      const index = new LineIndex("line1\nline2\n");
      expect(index.lineCount).toBe(3);
    });

    it("should handle single line without newline", () => {
      const index = new LineIndex("hello");
      expect(index.lineCount).toBe(1);
    });
  });

  describe("offsetToPosition", () => {
    it("should convert offset 0 to line 0, column 0", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.offsetToPosition(0)).toEqual({ line: 0, column: 0 });
    });

    it("should convert offset within first line", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.offsetToPosition(3)).toEqual({ line: 0, column: 3 });
    });

    it("should convert offset at newline to end of line", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.offsetToPosition(5)).toEqual({ line: 0, column: 5 });
    });

    it("should convert offset at start of second line", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.offsetToPosition(6)).toEqual({ line: 1, column: 0 });
    });

    it("should convert offset within second line", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.offsetToPosition(8)).toEqual({ line: 1, column: 2 });
    });

    it("should handle offset at end of string", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.offsetToPosition(11)).toEqual({ line: 1, column: 5 });
    });

    it("should clamp negative offset to 0", () => {
      const index = new LineIndex("hello");
      expect(index.offsetToPosition(-5)).toEqual({ line: 0, column: 0 });
    });

    it("should clamp offset beyond end", () => {
      const index = new LineIndex("hello");
      expect(index.offsetToPosition(100)).toEqual({ line: 0, column: 5 });
    });
  });

  describe("positionToOffset", () => {
    it("should convert line 0, column 0 to offset 0", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.positionToOffset({ line: 0, column: 0 })).toBe(0);
    });

    it("should convert position within first line", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.positionToOffset({ line: 0, column: 3 })).toBe(3);
    });

    it("should convert position at start of second line", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.positionToOffset({ line: 1, column: 0 })).toBe(6);
    });

    it("should convert position within second line", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.positionToOffset({ line: 1, column: 2 })).toBe(8);
    });

    it("should clamp column to line length", () => {
      const index = new LineIndex("hello\nworld");
      // Column 100 on line 0 should clamp to column 5 (end of "hello")
      expect(index.positionToOffset({ line: 0, column: 100 })).toBe(5);
    });

    it("should clamp line to max line", () => {
      const index = new LineIndex("hello\nworld");
      // Line 100 should clamp to last line
      expect(index.positionToOffset({ line: 100, column: 0 })).toBe(6);
    });
  });

  describe("roundtrip", () => {
    it("should roundtrip offset -> position -> offset", () => {
      const source = "hello\nworld\nthis is a test\n";
      const index = new LineIndex(source);

      for (let offset = 0; offset < source.length; offset++) {
        const pos = index.offsetToPosition(offset);
        const result = index.positionToOffset(pos);
        expect(result).toBe(offset);
      }
    });
  });

  describe("getLineStart", () => {
    it("should return 0 for line 0", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.getLineStart(0)).toBe(0);
    });

    it("should return correct start for line 1", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.getLineStart(1)).toBe(6);
    });

    it("should return -1 for invalid line", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.getLineStart(-1)).toBe(-1);
      expect(index.getLineStart(10)).toBe(-1);
    });
  });

  describe("getLineEnd", () => {
    it("should return position before newline", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.getLineEnd(0)).toBe(5);
    });

    it("should return end of string for last line", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.getLineEnd(1)).toBe(11);
    });

    it("should return -1 for invalid line", () => {
      const index = new LineIndex("hello\nworld");
      expect(index.getLineEnd(-1)).toBe(-1);
      expect(index.getLineEnd(10)).toBe(-1);
    });
  });

  describe("offsetToPoint / pointToOffset", () => {
    it("should convert to tree-sitter Point format", () => {
      const index = new LineIndex("hello\nworld");
      const point = index.offsetToPoint(8);
      expect(point).toEqual({ row: 1, column: 2 });
    });

    it("should convert from tree-sitter Point format", () => {
      const index = new LineIndex("hello\nworld");
      const offset = index.pointToOffset({ row: 1, column: 2 });
      expect(offset).toBe(8);
    });
  });
});

describe("computeEdit", () => {
  it("should compute edit for single character insertion", () => {
    const index = new LineIndex("hello world");
    const edit = computeEdit(index, 0, 5, 0, 5, ",");

    expect(edit.startIndex).toBe(5);
    expect(edit.oldEndIndex).toBe(5);
    expect(edit.newEndIndex).toBe(6);
    expect(edit.startPosition).toEqual({ row: 0, column: 5 });
    expect(edit.oldEndPosition).toEqual({ row: 0, column: 5 });
    expect(edit.newEndPosition).toEqual({ row: 0, column: 6 });
  });

  it("should compute edit for text replacement", () => {
    const index = new LineIndex("hello world");
    const edit = computeEdit(index, 0, 0, 0, 5, "hi");

    expect(edit.startIndex).toBe(0);
    expect(edit.oldEndIndex).toBe(5);
    expect(edit.newEndIndex).toBe(2);
    expect(edit.startPosition).toEqual({ row: 0, column: 0 });
    expect(edit.oldEndPosition).toEqual({ row: 0, column: 5 });
    expect(edit.newEndPosition).toEqual({ row: 0, column: 2 });
  });

  it("should compute edit for multiline insertion", () => {
    const index = new LineIndex("hello world");
    const edit = computeEdit(index, 0, 5, 0, 5, "\nnew line\n");

    expect(edit.startIndex).toBe(5);
    expect(edit.oldEndIndex).toBe(5);
    expect(edit.newEndIndex).toBe(15);
    expect(edit.startPosition).toEqual({ row: 0, column: 5 });
    expect(edit.oldEndPosition).toEqual({ row: 0, column: 5 });
    expect(edit.newEndPosition).toEqual({ row: 2, column: 0 });
  });

  it("should compute edit for deletion", () => {
    const index = new LineIndex("hello world");
    const edit = computeEdit(index, 0, 5, 0, 11, "");

    expect(edit.startIndex).toBe(5);
    expect(edit.oldEndIndex).toBe(11);
    expect(edit.newEndIndex).toBe(5);
    expect(edit.startPosition).toEqual({ row: 0, column: 5 });
    expect(edit.oldEndPosition).toEqual({ row: 0, column: 11 });
    expect(edit.newEndPosition).toEqual({ row: 0, column: 5 });
  });

  it("should compute edit across multiple lines", () => {
    const index = new LineIndex("line1\nline2\nline3");
    const edit = computeEdit(index, 1, 0, 2, 5, "replaced");

    expect(edit.startIndex).toBe(6);
    expect(edit.oldEndIndex).toBe(17);
    expect(edit.newEndIndex).toBe(14);
    expect(edit.startPosition).toEqual({ row: 1, column: 0 });
    expect(edit.oldEndPosition).toEqual({ row: 2, column: 5 });
    expect(edit.newEndPosition).toEqual({ row: 1, column: 8 });
  });
});
