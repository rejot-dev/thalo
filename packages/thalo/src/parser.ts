/**
 * Default parser entry point using native tree-sitter bindings.
 *
 * This module provides a singleton parser instance for convenience.
 * For more control, use `@rejot-dev/thalo/native` directly.
 */

import type { Tree } from "tree-sitter";
import { createParser, type ThaloParser } from "./parser.native.js";

// Re-export types
export type {
  ParsedBlock,
  ParsedDocument,
  FileType,
  ParseOptions,
  ThaloParser,
} from "./parser.native.js";

// Lazy singleton parser instance
let parserInstance: ThaloParser<Tree> | undefined;

/**
 * Get or create the singleton parser instance.
 *
 * @returns The singleton ThaloParser instance
 */
function getParser(): ThaloParser<Tree> {
  if (!parserInstance) {
    parserInstance = createParser();
  }
  return parserInstance;
}

/**
 * Parse a thalo source string into a tree-sitter Tree.
 *
 * @param source - The thalo source code to parse
 * @returns The parsed tree-sitter Tree
 */
export const parseThalo = (source: string): Tree => {
  return getParser().parse(source);
};

/**
 * Parse a thalo source string with optional incremental parsing.
 *
 * When an oldTree is provided, tree-sitter can reuse unchanged parts of the
 * parse tree, making parsing much faster for small edits.
 *
 * Note: Before calling this with an oldTree, you must call oldTree.edit()
 * to inform tree-sitter about the changes made to the source.
 *
 * @param source - The thalo source code to parse
 * @param oldTree - Optional previous tree for incremental parsing
 * @returns The parsed tree-sitter Tree
 */
export const parseThaloIncremental = (source: string, oldTree?: Tree): Tree => {
  return getParser().parseIncremental(source, oldTree);
};

/**
 * Parse a document, automatically detecting if it's a .thalo file or markdown with embedded thalo blocks.
 *
 * @param source - The source code to parse
 * @param options - Parse options including fileType and filename
 * @returns A ParsedDocument containing one or more parsed blocks
 */
export const parseDocument: ThaloParser<Tree>["parseDocument"] = (source, options) => {
  return getParser().parseDocument(source, options);
};
