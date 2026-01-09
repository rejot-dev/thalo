import type { Point } from "tree-sitter";

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
 * LineIndex provides O(log n) offset-to-position and position-to-offset conversions.
 * It maintains an array of line start offsets for efficient lookups.
 */
export class LineIndex {
  /** Array of character offsets where each line starts */
  private readonly lineStarts: number[];
  /** Total length of the source text */
  private readonly length: number;

  constructor(source: string) {
    this.lineStarts = [0]; // Line 0 starts at offset 0
    this.length = source.length;

    for (let i = 0; i < source.length; i++) {
      if (source[i] === "\n") {
        this.lineStarts.push(i + 1);
      }
    }
  }

  /**
   * Get the number of lines in the source.
   */
  get lineCount(): number {
    return this.lineStarts.length;
  }

  /**
   * Convert a character offset to a Position (line, column).
   * Uses binary search for O(log n) performance.
   *
   * @param offset - 0-based character offset
   * @returns Position with 0-based line and column
   */
  offsetToPosition(offset: number): Position {
    // Clamp offset to valid range
    const clampedOffset = Math.max(0, Math.min(offset, this.length));

    // Binary search to find the line
    let low = 0;
    let high = this.lineStarts.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      if (this.lineStarts[mid] <= clampedOffset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    const line = low;
    const column = clampedOffset - this.lineStarts[line];

    return { line, column };
  }

  /**
   * Convert a Position to a character offset.
   *
   * @param position - Position with 0-based line and column
   * @returns 0-based character offset
   */
  positionToOffset(position: Position): number {
    const { line, column } = position;

    // Clamp line to valid range
    const clampedLine = Math.max(0, Math.min(line, this.lineStarts.length - 1));
    const lineStart = this.lineStarts[clampedLine];

    // Calculate max column for this line
    const lineEnd =
      clampedLine < this.lineStarts.length - 1
        ? this.lineStarts[clampedLine + 1] - 1 // Don't include the newline
        : this.length;
    const maxColumn = lineEnd - lineStart;

    // Clamp column to valid range
    const clampedColumn = Math.max(0, Math.min(column, maxColumn));

    return lineStart + clampedColumn;
  }

  /**
   * Convert a character offset to a tree-sitter Point.
   */
  offsetToPoint(offset: number): Point {
    const pos = this.offsetToPosition(offset);
    return { row: pos.line, column: pos.column };
  }

  /**
   * Convert a tree-sitter Point to a character offset.
   */
  pointToOffset(point: Point): number {
    return this.positionToOffset({ line: point.row, column: point.column });
  }

  /**
   * Get the character offset where a line starts.
   *
   * @param line - 0-based line number
   * @returns Character offset, or -1 if line is out of range
   */
  getLineStart(line: number): number {
    if (line < 0 || line >= this.lineStarts.length) {
      return -1;
    }
    return this.lineStarts[line];
  }

  /**
   * Get the character offset where a line ends (before the newline).
   *
   * @param line - 0-based line number
   * @returns Character offset, or -1 if line is out of range
   */
  getLineEnd(line: number): number {
    if (line < 0 || line >= this.lineStarts.length) {
      return -1;
    }
    if (line === this.lineStarts.length - 1) {
      return this.length;
    }
    // Return position before the newline character
    return this.lineStarts[line + 1] - 1;
  }

  /**
   * Create a new LineIndex with an edit applied.
   * This is useful for computing edit ranges for tree-sitter.
   *
   * @param startOffset - Start of the edit range
   * @param oldEndOffset - End of the old text being replaced
   * @param newText - The new text being inserted
   * @param fullNewSource - The complete new source text
   * @returns A new LineIndex for the edited source
   */
  static fromEdit(
    _startOffset: number,
    _oldEndOffset: number,
    _newText: string,
    fullNewSource: string,
  ): LineIndex {
    // For now, just rebuild from scratch
    // A more sophisticated implementation could incrementally update lineStarts
    return new LineIndex(fullNewSource);
  }
}

/**
 * Compute tree-sitter edit parameters from an LSP-style text edit.
 *
 * @param lineIndex - The line index for the current source
 * @param startLine - 0-based start line
 * @param startColumn - 0-based start column
 * @param endLine - 0-based end line
 * @param endColumn - 0-based end column
 * @param newText - The replacement text
 * @returns Edit parameters for tree-sitter's Tree.edit()
 */
export function computeEdit(
  lineIndex: LineIndex,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
  newText: string,
): {
  startIndex: number;
  oldEndIndex: number;
  newEndIndex: number;
  startPosition: Point;
  oldEndPosition: Point;
  newEndPosition: Point;
} {
  const startIndex = lineIndex.positionToOffset({ line: startLine, column: startColumn });
  const oldEndIndex = lineIndex.positionToOffset({ line: endLine, column: endColumn });

  // Calculate the new end position
  const newEndIndex = startIndex + newText.length;

  // Count lines in the new text to determine new end position
  let newEndLine = startLine;
  let newEndColumn = startColumn;

  for (const char of newText) {
    if (char === "\n") {
      newEndLine++;
      newEndColumn = 0;
    } else {
      newEndColumn++;
    }
  }

  return {
    startIndex,
    oldEndIndex,
    newEndIndex,
    startPosition: { row: startLine, column: startColumn },
    oldEndPosition: { row: endLine, column: endColumn },
    newEndPosition: { row: newEndLine, column: newEndColumn },
  };
}
