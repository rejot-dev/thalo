/**
 * Shared parser logic used by both native (Node.js) and web (WASM) implementations.
 * This module is platform-agnostic and works with any tree-sitter-like parser.
 */

import { createSourceMap, identitySourceMap, type SourceMap } from "./source-map.js";
import type { SyntaxNode } from "./ast/ast-types.js";

/**
 * Edit parameters for incremental parsing.
 */
export interface TreeEdit {
  startIndex: number;
  oldEndIndex: number;
  newEndIndex: number;
  startPosition: { row: number; column: number };
  oldEndPosition: { row: number; column: number };
  newEndPosition: { row: number; column: number };
}

/**
 * A generic tree interface that both tree-sitter and web-tree-sitter satisfy.
 *
 * Note: Both `Tree` (from tree-sitter) and `Tree` (from web-tree-sitter) have this shape.
 * The main difference is that web-tree-sitter's SyntaxNode is called "Node", but the
 * interface is compatible.
 *
 * This is a minimal interface that only specifies the properties we actually use.
 * The actual Tree types have many more properties (language, copy, delete, etc.)
 * but we don't constrain those to keep the interface flexible.
 */
export interface GenericTree {
  readonly rootNode: SyntaxNode;
  /** Edit the tree for incremental parsing */
  edit(edit: TreeEdit): void;
}

/**
 * A generic parser interface that both tree-sitter and web-tree-sitter satisfy.
 */
export interface GenericParser<T extends GenericTree> {
  parse(source: string, oldTree?: T | null): T | null;
}

/**
 * A parsed thalo block with its source, source map for position translation, and parse tree.
 */
export interface ParsedBlock<T extends GenericTree = GenericTree> {
  /** The thalo source code */
  source: string;
  /** Source map for translating block-relative positions to file-absolute positions */
  sourceMap: SourceMap;
  /** The parsed tree-sitter tree */
  tree: T;
}

/**
 * A parsed document containing one or more thalo blocks.
 */
export interface ParsedDocument<T extends GenericTree = GenericTree> {
  /** The parsed thalo blocks */
  blocks: ParsedBlock<T>[];
}

/**
 * File type for parsing
 */
export type FileType = "thalo" | "markdown";

/**
 * Options for parseDocument
 */
export interface ParseOptions {
  /** The file type. If not provided, uses heuristics based on filename or content. */
  fileType?: FileType;
  /** Optional filename (used for heuristics if fileType is not provided) */
  filename?: string;
}

/**
 * Regex to match fenced thalo code blocks in markdown.
 * Captures the content between ```thalo and ```
 */
const THALO_FENCE_REGEX = /^```thalo\s*\n([\s\S]*?)^```/gm;

/**
 * Detect file type from filename extension.
 *
 * @param filename - The filename to check
 * @returns The detected file type ("thalo" or "markdown"), or undefined if unknown
 */
export function detectFileType(filename: string): FileType | undefined {
  if (filename.endsWith(".thalo")) {
    return "thalo";
  }
  if (filename.endsWith(".md")) {
    return "markdown";
  }
  return undefined;
}

/**
 * The ThaloParser interface - a configured parser instance that can parse thalo source.
 */
export interface ThaloParser<T extends GenericTree = GenericTree> {
  /**
   * Parse a thalo source string into a tree-sitter Tree.
   */
  parse(source: string): T;

  /**
   * Parse a thalo source string with optional incremental parsing.
   *
   * When an oldTree is provided, tree-sitter can reuse unchanged parts of the
   * parse tree, making parsing much faster for small edits.
   *
   * Note: Before calling this with an oldTree, you must call oldTree.edit()
   * to inform tree-sitter about the changes made to the source.
   */
  parseIncremental(source: string, oldTree?: T): T;

  /**
   * Parse a document, automatically detecting if it's a .thalo file or markdown
   * with embedded thalo blocks.
   */
  parseDocument(source: string, options?: ParseOptions): ParsedDocument<T>;
}

/**
 * Create a ThaloParser from a generic tree-sitter parser instance.
 *
 * @param tsParser - A tree-sitter or web-tree-sitter Parser instance with the thalo language loaded
 * @returns A ThaloParser instance
 */
export function createThaloParser<T extends GenericTree>(
  tsParser: GenericParser<T>,
): ThaloParser<T> {
  /**
   * Parse a thalo source string into a tree-sitter Tree.
   *
   * @param source - The thalo source code to parse
   * @returns The parsed tree-sitter Tree
   * @throws Error if parsing fails
   */
  function parse(source: string): T {
    const tree = tsParser.parse(source);
    if (!tree) {
      throw new Error("Failed to parse source");
    }
    return tree;
  }

  /**
   * Parse a thalo source string with optional incremental parsing.
   *
   * @param source - The thalo source code to parse
   * @param oldTree - Optional previous tree for incremental parsing
   * @returns The parsed tree-sitter Tree
   * @throws Error if parsing fails
   */
  function parseIncremental(source: string, oldTree?: T): T {
    const tree = tsParser.parse(source, oldTree);
    if (!tree) {
      throw new Error("Failed to parse source");
    }
    return tree;
  }

  /**
   * Extract thalo code blocks from markdown source.
   *
   * Searches for fenced code blocks marked with ```thalo and extracts
   * their content, creating a ParsedDocument with one ParsedBlock per
   * code block found.
   *
   * @param source - The markdown source containing thalo code blocks
   * @returns A ParsedDocument containing the extracted thalo blocks
   */
  function extractThaloBlocks(source: string): ParsedDocument<T> {
    const blocks: ParsedBlock<T>[] = [];
    let match: RegExpExecArray | null;

    while ((match = THALO_FENCE_REGEX.exec(source)) !== null) {
      const content = match[1];
      const charOffset = match.index + match[0].indexOf(content);
      const sourceMap = createSourceMap(source, charOffset, content);
      blocks.push({
        source: content,
        sourceMap,
        tree: parse(content),
      });
    }

    THALO_FENCE_REGEX.lastIndex = 0;
    return { blocks };
  }

  /**
   * Parse a pure thalo document (not markdown).
   *
   * Creates a ParsedDocument with a single block containing the entire
   * source as a thalo file.
   *
   * @param source - The thalo source code
   * @returns A ParsedDocument with a single block
   */
  function parseThaloDocument(source: string): ParsedDocument<T> {
    return {
      blocks: [{ source, sourceMap: identitySourceMap(), tree: parse(source) }],
    };
  }

  /**
   * Parse a document, automatically detecting if it's a .thalo file or markdown
   * with embedded thalo blocks.
   *
   * Uses fileType option, filename-based heuristics, or content-based heuristics
   * to determine how to parse the source.
   *
   * @param source - The source code to parse
   * @param options - Parse options including fileType and filename
   * @returns A ParsedDocument containing one or more parsed blocks
   */
  function parseDocument(source: string, options: ParseOptions = {}): ParsedDocument<T> {
    const { fileType, filename } = options;

    if (fileType === "thalo") {
      return parseThaloDocument(source);
    }
    if (fileType === "markdown") {
      return extractThaloBlocks(source);
    }

    if (filename) {
      const detected = detectFileType(filename);
      if (detected === "thalo") {
        return parseThaloDocument(source);
      }
      if (detected === "markdown") {
        return extractThaloBlocks(source);
      }
    }

    if (source.includes("```thalo")) {
      return extractThaloBlocks(source);
    }

    return parseThaloDocument(source);
  }

  return {
    parse,
    parseIncremental,
    parseDocument,
  };
}
