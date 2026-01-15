import type { Location } from "./ast/ast-types.js";

/**
 * A simple position (line and column).
 * Both are 0-based to match tree-sitter's Point type.
 */
export interface Position {
  /** 0-based line number */
  line: number;
  /** 0-based column number */
  column: number;
}

/**
 * Tree-sitter Point interface (row and column).
 * Defined locally to avoid bundling native tree-sitter.
 */
interface Point {
  row: number;
  column: number;
}

/**
 * SourceMap tracks the relationship between block-relative positions
 * (as returned by tree-sitter) and file-absolute positions.
 *
 * For standalone .thalo files, this is an identity map (all offsets are 0).
 * For embedded blocks in markdown, this contains the offset to the block start.
 */
export interface SourceMap {
  /** Character offset where block content starts in the file */
  readonly charOffset: number;
  /** Line number where block content starts (0-based) */
  readonly lineOffset: number;
  /** Column offset on the starting line (usually 0 for fenced code blocks) */
  readonly columnOffset: number;
  /** Number of lines in the block content */
  readonly lineCount: number;
}

/**
 * A cached identity source map instance for standalone files.
 */
const IDENTITY_SOURCE_MAP: SourceMap = Object.freeze({
  charOffset: 0,
  lineOffset: 0,
  columnOffset: 0,
  lineCount: 0,
});

/**
 * Create an identity source map for standalone .thalo files.
 * All offsets are zero, so positions pass through unchanged.
 */
export function identitySourceMap(): SourceMap {
  return IDENTITY_SOURCE_MAP;
}

/**
 * Check if a source map is an identity map (no offset).
 */
export function isIdentityMap(map: SourceMap): boolean {
  return map.charOffset === 0 && map.lineOffset === 0 && map.columnOffset === 0;
}

/**
 * Create a source map for an embedded block.
 *
 * @param fullSource - The complete source text of the containing file
 * @param charOffset - Character offset where the block content starts
 * @param blockSource - The block's source text (for calculating line count)
 * @returns A SourceMap for the block
 */
export function createSourceMap(
  fullSource: string,
  charOffset: number,
  blockSource: string,
): SourceMap {
  // Count newlines before the block to get the line offset
  let lineOffset = 0;
  let columnOffset = 0;
  let lastNewlineIndex = -1;

  for (let i = 0; i < charOffset; i++) {
    if (fullSource[i] === "\n") {
      lineOffset++;
      lastNewlineIndex = i;
    }
  }

  // Column offset is the distance from the last newline to the block start
  // If no newline found, column offset is the char offset itself
  columnOffset = lastNewlineIndex === -1 ? charOffset : charOffset - lastNewlineIndex - 1;

  // Count lines in the block content
  let lineCount = 1;
  for (const char of blockSource) {
    if (char === "\n") {
      lineCount++;
    }
  }

  return Object.freeze({
    charOffset,
    lineOffset,
    columnOffset,
    lineCount,
  });
}

/**
 * Convert a block-relative position to a file-absolute position.
 *
 * @param map - The source map for the block
 * @param blockPos - Position relative to the block start
 * @returns Position relative to the file start
 */
export function toFilePosition(map: SourceMap, blockPos: Position): Position {
  // For the first line, add both line offset and column offset
  // For subsequent lines, only add line offset (column is already correct)
  if (blockPos.line === 0) {
    return {
      line: map.lineOffset + blockPos.line,
      column: map.columnOffset + blockPos.column,
    };
  }
  return {
    line: map.lineOffset + blockPos.line,
    column: blockPos.column,
  };
}

/**
 * Convert a file-absolute position to a block-relative position.
 * Returns null if the position is outside the block.
 *
 * @param map - The source map for the block
 * @param filePos - Position relative to the file start
 * @returns Position relative to the block start, or null if outside
 */
export function toBlockPosition(map: SourceMap, filePos: Position): Position | null {
  // For identity maps, just pass through (no bounds checking needed)
  if (isIdentityMap(map)) {
    return { line: filePos.line, column: filePos.column };
  }

  const blockLine = filePos.line - map.lineOffset;

  // Check if position is before the block
  if (blockLine < 0) {
    return null;
  }

  // Check if position is after the block
  if (blockLine >= map.lineCount) {
    return null;
  }

  // For the first line, subtract column offset
  // For subsequent lines, column is already correct
  if (blockLine === 0) {
    const blockColumn = filePos.column - map.columnOffset;
    // Check if position is before the block on the first line
    if (blockColumn < 0) {
      return null;
    }
    return {
      line: blockLine,
      column: blockColumn,
    };
  }

  return {
    line: blockLine,
    column: filePos.column,
  };
}

/**
 * Convert a tree-sitter Point to a Position.
 */
export function pointToPosition(point: Point): Position {
  return {
    line: point.row,
    column: point.column,
  };
}

/**
 * Convert a Position to a tree-sitter Point.
 */
export function positionToPoint(pos: Position): Point {
  return {
    row: pos.line,
    column: pos.column,
  };
}

/**
 * Convert a character offset in source text to a Position (line, column).
 *
 * @param source - The source text
 * @param offset - Character offset (0-based)
 * @returns Position with 0-based line and column
 */
export function positionFromOffset(source: string, offset: number): Position {
  let line = 0;
  let column = 0;

  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 0;
    } else {
      column++;
    }
  }

  return { line, column };
}

/**
 * Convert a block-relative Location to a file-absolute Location.
 *
 * @param map - The source map for the block
 * @param blockLoc - Location relative to the block start
 * @returns Location relative to the file start
 */
export function toFileLocation(map: SourceMap, blockLoc: Location): Location {
  const startPos = toFilePosition(map, pointToPosition(blockLoc.startPosition));
  const endPos = toFilePosition(map, pointToPosition(blockLoc.endPosition));

  return {
    startIndex: map.charOffset + blockLoc.startIndex,
    endIndex: map.charOffset + blockLoc.endIndex,
    startPosition: positionToPoint(startPos),
    endPosition: positionToPoint(endPos),
  };
}

/**
 * Convert a file-absolute Location to a block-relative Location.
 * Returns null if the location is outside the block.
 *
 * @param map - The source map for the block
 * @param fileLoc - Location relative to the file start
 * @returns Location relative to the block start, or null if outside
 */
export function toBlockLocation(map: SourceMap, fileLoc: Location): Location | null {
  const startPos = toBlockPosition(map, pointToPosition(fileLoc.startPosition));
  const endPos = toBlockPosition(map, pointToPosition(fileLoc.endPosition));

  if (!startPos || !endPos) {
    return null;
  }

  return {
    startIndex: fileLoc.startIndex - map.charOffset,
    endIndex: fileLoc.endIndex - map.charOffset,
    startPosition: positionToPoint(startPos),
    endPosition: positionToPoint(endPos),
  };
}

/**
 * Result of finding a block at a position.
 */
export interface BlockMatch<T extends { sourceMap: SourceMap }> {
  /** The matched block */
  block: T;
  /** Position relative to the block start (0-based line and column) */
  blockPosition: Position;
}

/**
 * Find which block (if any) contains a file-absolute position.
 *
 * @param blocks - Array of objects with sourceMap property
 * @param filePosition - Position relative to the file start (0-based)
 * @returns The matching block and block-relative position, or null if not in any block
 */
export function findBlockAtPosition<T extends { sourceMap: SourceMap }>(
  blocks: T[],
  filePosition: Position,
): BlockMatch<T> | null {
  for (const block of blocks) {
    const blockPosition = toBlockPosition(block.sourceMap, filePosition);
    if (blockPosition) {
      return { block, blockPosition };
    }
  }
  return null;
}
