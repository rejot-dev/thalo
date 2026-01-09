import type { Point, Tree } from "tree-sitter";
import type { SourceMap } from "../source-map.js";
import { createSourceMap, identitySourceMap } from "../source-map.js";
import { parseThaloIncremental, type FileType } from "../parser.js";
import { LineIndex, computeEdit } from "./line-index.js";

/**
 * Edit range for applying incremental edits to a document.
 * Uses tree-sitter's edit format.
 */
export interface EditRange {
  startIndex: number;
  startPosition: Point;
  oldEndIndex: number;
  oldEndPosition: Point;
  newEndIndex: number;
  newEndPosition: Point;
}

/**
 * A parsed thalo block within a document.
 */
export interface DocumentBlock {
  /** The thalo source code for this block */
  source: string;
  /** Source map for translating block-relative positions to file-absolute positions */
  sourceMap: SourceMap;
  /** The parsed tree-sitter tree */
  tree: Tree;
  /** Character offset where this block starts in the full document */
  startOffset: number;
  /** Character offset where this block ends in the full document */
  endOffset: number;
}

/**
 * Result of applying an edit to a document.
 */
export interface EditResult {
  /** Whether the edit affected thalo block boundaries (```thalo fences) */
  blockBoundariesChanged: boolean;
  /** Indices of blocks that were modified */
  modifiedBlockIndices: number[];
  /** Whether a full reparse was required */
  fullReparse: boolean;
}

/**
 * Regex to match fenced thalo code blocks in markdown.
 * Captures the content between ```thalo and ```
 */
const THALO_FENCE_REGEX = /^```thalo\s*\n([\s\S]*?)^```/gm;

/**
 * A Document owns the source text and Tree-sitter tree(s) for a file,
 * providing efficient incremental edit operations.
 */
export class Document {
  readonly filename: string;
  readonly fileType: FileType;

  private _source: string;
  private _blocks: DocumentBlock[];
  private _lineIndex: LineIndex;

  constructor(filename: string, source: string, fileType?: FileType) {
    this.filename = filename;
    this.fileType = fileType ?? Document.detectFileType(filename, source);
    this._source = source;
    this._lineIndex = new LineIndex(source);
    this._blocks = this.parseBlocks(source);
  }

  /**
   * Get the current source text.
   */
  get source(): string {
    return this._source;
  }

  /**
   * Get the line index for position conversions.
   */
  get lineIndex(): LineIndex {
    return this._lineIndex;
  }

  /**
   * Get the current parsed blocks.
   */
  get blocks(): readonly DocumentBlock[] {
    return this._blocks;
  }

  /**
   * Apply an incremental edit to the document.
   *
   * @param startLine - 0-based start line of the edit
   * @param startColumn - 0-based start column of the edit
   * @param endLine - 0-based end line of the edit (exclusive)
   * @param endColumn - 0-based end column of the edit
   * @param newText - The replacement text
   * @returns Information about what changed
   */
  applyEdit(
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
    newText: string,
  ): EditResult {
    // Compute edit parameters
    const edit = computeEdit(
      this._lineIndex,
      startLine,
      startColumn,
      endLine,
      endColumn,
      newText,
    );

    // Apply the edit to get new source
    const newSource =
      this._source.slice(0, edit.startIndex) + newText + this._source.slice(edit.oldEndIndex);

    // Check if this is a markdown file and if block boundaries might have changed
    const blockBoundariesChanged =
      this.fileType === "markdown" && this.mightAffectBlockBoundaries(edit, newText);

    // Update source and line index
    const oldSource = this._source;
    this._source = newSource;
    this._lineIndex = new LineIndex(newSource);

    // For markdown files with potential boundary changes, do a full reparse
    if (blockBoundariesChanged) {
      this._blocks = this.parseBlocks(newSource);
      return {
        blockBoundariesChanged: true,
        modifiedBlockIndices: this._blocks.map((_, i) => i),
        fullReparse: true,
      };
    }

    // For thalo files or markdown edits within a single block, use incremental parsing
    if (this.fileType === "thalo") {
      // Single block, always incremental
      return this.applyIncrementalEdit(edit, oldSource, newSource, newText);
    } else {
      // Markdown: find affected block(s)
      return this.applyMarkdownEdit(edit, oldSource, newSource, newText);
    }
  }

  /**
   * Apply an edit using raw edit parameters (tree-sitter format).
   */
  applyEditRange(edit: EditRange, newText: string): EditResult {
    const startPos = this._lineIndex.offsetToPosition(edit.startIndex);
    const endPos = this._lineIndex.offsetToPosition(edit.oldEndIndex);
    return this.applyEdit(startPos.line, startPos.column, endPos.line, endPos.column, newText);
  }

  /**
   * Replace the entire document content (for full sync).
   */
  replaceContent(newSource: string): void {
    this._source = newSource;
    this._lineIndex = new LineIndex(newSource);
    this._blocks = this.parseBlocks(newSource);
  }

  /**
   * Detect file type from filename extension or content.
   */
  private static detectFileType(filename: string, source: string): FileType {
    if (filename.endsWith(".thalo")) {
      return "thalo";
    }
    if (filename.endsWith(".md")) {
      return "markdown";
    }
    // Use heuristics: if it contains markdown thalo fences, treat as markdown
    if (source.includes("```thalo")) {
      return "markdown";
    }
    return "thalo";
  }

  /**
   * Parse all thalo blocks from the source.
   */
  private parseBlocks(source: string): DocumentBlock[] {
    if (this.fileType === "thalo") {
      // Single block for pure thalo files
      const tree = parseThaloIncremental(source);
      return [
        {
          source,
          sourceMap: identitySourceMap(),
          tree,
          startOffset: 0,
          endOffset: source.length,
        },
      ];
    }

    // Extract thalo blocks from markdown
    const blocks: DocumentBlock[] = [];
    let match: RegExpExecArray | null;

    while ((match = THALO_FENCE_REGEX.exec(source)) !== null) {
      const content = match[1];
      const contentStart = match.index + match[0].indexOf(content);
      const sourceMap = createSourceMap(source, contentStart, content);
      const tree = parseThaloIncremental(content);

      blocks.push({
        source: content,
        sourceMap,
        tree,
        startOffset: contentStart,
        endOffset: contentStart + content.length,
      });
    }

    // Reset regex state
    THALO_FENCE_REGEX.lastIndex = 0;

    return blocks;
  }

  /**
   * Check if an edit might affect thalo block boundaries (```thalo fences).
   */
  private mightAffectBlockBoundaries(edit: EditRange, newText: string): boolean {
    // Check if the edit region or new text contains fence markers
    const oldText = this._source.slice(edit.startIndex, edit.oldEndIndex);
    const hasFenceInOld = oldText.includes("```");
    const hasFenceInNew = newText.includes("```");

    if (hasFenceInOld || hasFenceInNew) {
      return true;
    }

    // Check if any block boundary falls within the edit range
    for (const block of this._blocks) {
      // Check if fence start (```thalo) is in edit range
      const fenceStartOffset = block.startOffset - "```thalo\n".length;
      if (fenceStartOffset >= edit.startIndex && fenceStartOffset < edit.oldEndIndex) {
        return true;
      }
      // Check if fence end (```) is in edit range
      const fenceEndOffset = block.endOffset;
      if (fenceEndOffset >= edit.startIndex && fenceEndOffset < edit.oldEndIndex) {
        return true;
      }
    }

    return false;
  }

  /**
   * Apply incremental edit to a thalo file (single block).
   */
  private applyIncrementalEdit(
    edit: EditRange,
    _oldSource: string,
    newSource: string,
    _newText: string,
  ): EditResult {
    const block = this._blocks[0];

    // Tell tree-sitter about the edit
    block.tree.edit({
      startIndex: edit.startIndex,
      oldEndIndex: edit.oldEndIndex,
      newEndIndex: edit.newEndIndex,
      startPosition: edit.startPosition,
      oldEndPosition: edit.oldEndPosition,
      newEndPosition: edit.newEndPosition,
    });

    // Reparse with the old tree for incremental parsing
    const newTree = parseThaloIncremental(newSource, block.tree);

    // Update the block
    this._blocks = [
      {
        source: newSource,
        sourceMap: identitySourceMap(),
        tree: newTree,
        startOffset: 0,
        endOffset: newSource.length,
      },
    ];

    return {
      blockBoundariesChanged: false,
      modifiedBlockIndices: [0],
      fullReparse: false,
    };
  }

  /**
   * Apply edit to a markdown file, updating affected blocks incrementally.
   */
  private applyMarkdownEdit(
    edit: EditRange,
    _oldSource: string,
    newSource: string,
    _newText: string,
  ): EditResult {
    // Find which block(s) contain the edit
    const affectedBlockIndices: number[] = [];

    for (let i = 0; i < this._blocks.length; i++) {
      const block = this._blocks[i];
      // Check if edit overlaps with this block
      if (edit.startIndex < block.endOffset && edit.oldEndIndex > block.startOffset) {
        affectedBlockIndices.push(i);
      }
    }

    if (affectedBlockIndices.length === 0) {
      // Edit is outside all thalo blocks (in markdown content)
      // Just need to update block offsets
      this.updateBlockOffsets(edit, newSource);
      return {
        blockBoundariesChanged: false,
        modifiedBlockIndices: [],
        fullReparse: false,
      };
    }

    if (affectedBlockIndices.length === 1) {
      // Edit is within a single block - can use incremental parsing
      const blockIndex = affectedBlockIndices[0];
      this.updateSingleBlockIncremental(blockIndex, edit, newSource);
      return {
        blockBoundariesChanged: false,
        modifiedBlockIndices: affectedBlockIndices,
        fullReparse: false,
      };
    }

    // Edit spans multiple blocks - do a full reparse
    this._blocks = this.parseBlocks(newSource);
    return {
      blockBoundariesChanged: false,
      modifiedBlockIndices: this._blocks.map((_, i) => i),
      fullReparse: true,
    };
  }

  /**
   * Update block offsets after an edit outside all blocks.
   */
  private updateBlockOffsets(edit: EditRange, newSource: string): void {
    const delta = edit.newEndIndex - edit.oldEndIndex;

    this._blocks = this._blocks.map((block) => {
      if (block.startOffset > edit.oldEndIndex) {
        // Block is after the edit - shift offsets
        return {
          ...block,
          startOffset: block.startOffset + delta,
          endOffset: block.endOffset + delta,
          sourceMap: createSourceMap(newSource, block.startOffset + delta, block.source),
        };
      }
      return block;
    });
  }

  /**
   * Update a single block using incremental parsing.
   */
  private updateSingleBlockIncremental(
    blockIndex: number,
    edit: EditRange,
    newSource: string,
  ): void {
    const oldBlock = this._blocks[blockIndex];

    // Convert edit to block-relative coordinates
    const blockRelativeStartIndex = edit.startIndex - oldBlock.startOffset;
    const blockRelativeOldEndIndex = edit.oldEndIndex - oldBlock.startOffset;

    // Compute the new block source
    const delta = edit.newEndIndex - edit.oldEndIndex;
    const newBlockEndOffset = oldBlock.endOffset + delta;

    // Extract the new block content
    // Need to find the new block boundaries in the edited source
    const newBlockSource = newSource.slice(oldBlock.startOffset, newBlockEndOffset);

    // Compute block-relative edit
    const blockRelativeNewEndIndex = blockRelativeStartIndex + (edit.newEndIndex - edit.startIndex);
    const blockRelativeEdit = computeEdit(
      new LineIndex(oldBlock.source),
      edit.startPosition.row - oldBlock.sourceMap.lineOffset,
      edit.startPosition.row === oldBlock.sourceMap.lineOffset
        ? edit.startPosition.column - oldBlock.sourceMap.columnOffset
        : edit.startPosition.column,
      edit.oldEndPosition.row - oldBlock.sourceMap.lineOffset,
      edit.oldEndPosition.row === oldBlock.sourceMap.lineOffset
        ? edit.oldEndPosition.column - oldBlock.sourceMap.columnOffset
        : edit.oldEndPosition.column,
      newSource.slice(edit.startIndex, edit.newEndIndex),
    );

    // Tell tree-sitter about the edit
    oldBlock.tree.edit({
      startIndex: blockRelativeStartIndex,
      oldEndIndex: blockRelativeOldEndIndex,
      newEndIndex: blockRelativeNewEndIndex,
      startPosition: blockRelativeEdit.startPosition,
      oldEndPosition: blockRelativeEdit.oldEndPosition,
      newEndPosition: blockRelativeEdit.newEndPosition,
    });

    // Reparse with the old tree
    const newTree = parseThaloIncremental(newBlockSource, oldBlock.tree);

    // Update blocks array
    this._blocks = this._blocks.map((block, i) => {
      if (i === blockIndex) {
        return {
          source: newBlockSource,
          sourceMap: createSourceMap(newSource, oldBlock.startOffset, newBlockSource),
          tree: newTree,
          startOffset: oldBlock.startOffset,
          endOffset: newBlockEndOffset,
        };
      } else if (i > blockIndex) {
        // Shift subsequent blocks
        return {
          ...block,
          startOffset: block.startOffset + delta,
          endOffset: block.endOffset + delta,
          sourceMap: createSourceMap(newSource, block.startOffset + delta, block.source),
        };
      }
      return block;
    });
  }
}
