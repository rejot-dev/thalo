import { describe, it, expect } from "vitest";
import {
  identitySourceMap,
  isIdentityMap,
  createSourceMap,
  toFilePosition,
  toBlockPosition,
  toFileLocation,
  toBlockLocation,
  type Position,
} from "./source-map.js";
import type { Location } from "./ast/types.js";

describe("SourceMap", () => {
  describe("identitySourceMap", () => {
    it("returns zero offsets", () => {
      const map = identitySourceMap();
      expect(map.charOffset).toBe(0);
      expect(map.lineOffset).toBe(0);
      expect(map.columnOffset).toBe(0);
    });

    it("returns the same instance on multiple calls", () => {
      const map1 = identitySourceMap();
      const map2 = identitySourceMap();
      expect(map1).toBe(map2);
    });
  });

  describe("isIdentityMap", () => {
    it("returns true for identity map", () => {
      expect(isIdentityMap(identitySourceMap())).toBe(true);
    });

    it("returns false for non-identity map", () => {
      const map = createSourceMap("hello\nworld", 6, "world");
      expect(isIdentityMap(map)).toBe(false);
    });

    it("returns true for manually created zero-offset map", () => {
      const map = { charOffset: 0, lineOffset: 0, columnOffset: 0, lineCount: 1 };
      expect(isIdentityMap(map)).toBe(true);
    });
  });

  describe("createSourceMap", () => {
    it("calculates correct line offset from char offset", () => {
      const source = "line1\nline2\nline3";
      // Block starts at "line3" (after 2 newlines)
      const map = createSourceMap(source, 12, "line3");
      expect(map.lineOffset).toBe(2);
      expect(map.charOffset).toBe(12);
    });

    it("calculates correct column offset", () => {
      const source = "# Header\n\n```ptall\ncontent";
      // Block content starts after "```ptall\n" at column 0
      const map = createSourceMap(source, 19, "content");
      expect(map.columnOffset).toBe(0);
    });

    it("handles block at start of file (line 0)", () => {
      const source = "content here";
      const map = createSourceMap(source, 0, "content here");
      expect(map.lineOffset).toBe(0);
      expect(map.columnOffset).toBe(0);
      expect(map.charOffset).toBe(0);
    });

    it("handles block after multiple newlines", () => {
      const source = "\n\n\n\nblock";
      const map = createSourceMap(source, 4, "block");
      expect(map.lineOffset).toBe(4);
      expect(map.columnOffset).toBe(0);
    });

    it("counts lines in block content", () => {
      const blockSource = "line1\nline2\nline3";
      const map = createSourceMap("prefix\n" + blockSource, 7, blockSource);
      expect(map.lineCount).toBe(3);
    });

    it("handles single-line block", () => {
      const map = createSourceMap("abc", 0, "abc");
      expect(map.lineCount).toBe(1);
    });

    it("handles column offset when block starts mid-line", () => {
      const source = "prefix: content";
      const map = createSourceMap(source, 8, "content");
      expect(map.lineOffset).toBe(0);
      expect(map.columnOffset).toBe(8);
    });
  });

  describe("toFilePosition", () => {
    it("passes through position for identity map", () => {
      const map = identitySourceMap();
      const pos: Position = { line: 5, column: 10 };
      const result = toFilePosition(map, pos);
      expect(result).toEqual({ line: 5, column: 10 });
    });

    it("adds line offset correctly", () => {
      const map = createSourceMap("line1\nline2\nblock", 12, "block");
      const pos: Position = { line: 0, column: 0 };
      const result = toFilePosition(map, pos);
      expect(result.line).toBe(2);
    });

    it("adds column offset for first line only", () => {
      const source = "prefix: block\nsecond line";
      const map = createSourceMap(source, 8, "block\nsecond line");

      // First line of block
      const pos1: Position = { line: 0, column: 0 };
      const result1 = toFilePosition(map, pos1);
      expect(result1.column).toBe(8); // column offset added

      // Second line of block
      const pos2: Position = { line: 1, column: 5 };
      const result2 = toFilePosition(map, pos2);
      expect(result2.column).toBe(5); // no column offset
    });

    it("handles multi-line content correctly", () => {
      const source = "# Header\n\n```ptall\nentry1\nentry2\n```";
      // Block content starts at line 3 (after "```ptall\n")
      const map = createSourceMap(source, 19, "entry1\nentry2\n");

      const pos: Position = { line: 1, column: 3 };
      const result = toFilePosition(map, pos);
      expect(result.line).toBe(4); // line 3 + 1
      expect(result.column).toBe(3);
    });
  });

  describe("toBlockPosition", () => {
    it("passes through position for identity map", () => {
      const map = identitySourceMap();
      const pos: Position = { line: 5, column: 10 };
      const result = toBlockPosition(map, pos);
      expect(result).toEqual({ line: 5, column: 10 });
    });

    it("subtracts line offset correctly", () => {
      const map = createSourceMap("line1\nline2\nblock", 12, "block");
      const pos: Position = { line: 2, column: 0 };
      const result = toBlockPosition(map, pos);
      expect(result).toEqual({ line: 0, column: 0 });
    });

    it("returns null for position before block", () => {
      const map = createSourceMap("line1\nline2\nblock", 12, "block");
      const pos: Position = { line: 1, column: 0 };
      const result = toBlockPosition(map, pos);
      expect(result).toBeNull();
    });

    it("returns null for position after block", () => {
      const map = createSourceMap("prefix\nblock", 7, "block");
      // Block is single line, so line 2 is after it
      const pos: Position = { line: 2, column: 0 };
      const result = toBlockPosition(map, pos);
      expect(result).toBeNull();
    });

    it("returns null for position before block on first line", () => {
      const source = "prefix: block";
      const map = createSourceMap(source, 8, "block");
      const pos: Position = { line: 0, column: 5 }; // before column offset
      const result = toBlockPosition(map, pos);
      expect(result).toBeNull();
    });

    it("handles position at exact block start", () => {
      const map = createSourceMap("prefix\nblock\nafter", 7, "block\n");
      const pos: Position = { line: 1, column: 0 };
      const result = toBlockPosition(map, pos);
      expect(result).toEqual({ line: 0, column: 0 });
    });
  });

  describe("toFileLocation", () => {
    it("maps both start and end positions", () => {
      const map = createSourceMap("line1\nline2\nblock here", 12, "block here");
      const blockLoc: Location = {
        startIndex: 0,
        endIndex: 5,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 5 },
      };

      const result = toFileLocation(map, blockLoc);

      expect(result.startIndex).toBe(12);
      expect(result.endIndex).toBe(17);
      expect(result.startPosition.row).toBe(2);
      expect(result.startPosition.column).toBe(0);
      expect(result.endPosition.row).toBe(2);
      expect(result.endPosition.column).toBe(5);
    });

    it("handles multi-line locations", () => {
      const source = "header\n```ptall\nline1\nline2\n```";
      const map = createSourceMap(source, 16, "line1\nline2\n");
      const blockLoc: Location = {
        startIndex: 0,
        endIndex: 11,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 1, column: 5 },
      };

      const result = toFileLocation(map, blockLoc);

      expect(result.startPosition.row).toBe(2);
      expect(result.endPosition.row).toBe(3);
    });
  });

  describe("toBlockLocation", () => {
    it("reverses toFileLocation", () => {
      const map = createSourceMap("line1\nline2\nblock here", 12, "block here");
      const blockLoc: Location = {
        startIndex: 0,
        endIndex: 5,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 5 },
      };

      const fileLoc = toFileLocation(map, blockLoc);
      const result = toBlockLocation(map, fileLoc);

      expect(result).toEqual(blockLoc);
    });

    it("returns null if start is outside block", () => {
      const map = createSourceMap("line1\nline2\nblock", 12, "block");
      const fileLoc: Location = {
        startIndex: 0,
        endIndex: 5,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 2, column: 5 },
      };

      const result = toBlockLocation(map, fileLoc);
      expect(result).toBeNull();
    });

    it("returns null if end is outside block", () => {
      const map = createSourceMap("prefix\nblock", 7, "block");
      const fileLoc: Location = {
        startIndex: 7,
        endIndex: 20,
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 5, column: 0 }, // way past the block
      };

      const result = toBlockLocation(map, fileLoc);
      expect(result).toBeNull();
    });
  });
});
