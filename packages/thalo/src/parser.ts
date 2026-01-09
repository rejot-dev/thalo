import Parser, { type Language, type Tree } from "tree-sitter";
import thalo from "@rejot-dev/tree-sitter-thalo";
import { createSourceMap, identitySourceMap, type SourceMap } from "./source-map.js";

let parserInstance: Parser | undefined;

const getParser = (): Parser => {
  if (!parserInstance) {
    // Ensure nodeTypeInfo is an array (may be undefined if JSON import fails in some environments)
    thalo.nodeTypeInfo ??= [];
    parserInstance = new Parser();
    parserInstance.setLanguage(thalo as unknown as Language);
  }
  return parserInstance;
};

/**
 * Parse a thalo source string into a tree-sitter Tree.
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
  return getParser().parse(source, oldTree);
};

/**
 * A parsed thalo block with its source, source map for position translation, and parse tree.
 */
export interface ParsedBlock {
  /** The thalo source code */
  source: string;
  /** Source map for translating block-relative positions to file-absolute positions */
  sourceMap: SourceMap;
  /** The parsed tree-sitter tree */
  tree: Tree;
}

/**
 * A parsed document containing one or more thalo blocks.
 */
export interface ParsedDocument {
  /** The parsed thalo blocks */
  blocks: ParsedBlock[];
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
 * Extract thalo code blocks from a markdown string.
 */
function extractThaloBlocks(source: string): ParsedDocument {
  const blocks: ParsedBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = THALO_FENCE_REGEX.exec(source)) !== null) {
    const content = match[1];
    // Character offset is the position of the content start (after ```thalo\n)
    const charOffset = match.index + match[0].indexOf(content);
    // Create source map with proper line/column offset calculation
    const sourceMap = createSourceMap(source, charOffset, content);
    blocks.push({
      source: content,
      sourceMap,
      tree: parseThalo(content),
    });
  }

  // Reset regex state for next call
  THALO_FENCE_REGEX.lastIndex = 0;

  return { blocks };
}

/**
 * Parse as a pure thalo document.
 */
function parseThaloDocument(source: string): ParsedDocument {
  return {
    blocks: [{ source, sourceMap: identitySourceMap(), tree: parseThalo(source) }],
  };
}

/**
 * Detect file type from filename extension.
 */
function detectFileType(filename: string): FileType | undefined {
  if (filename.endsWith(".thalo")) {
    return "thalo";
  }
  if (filename.endsWith(".md")) {
    return "markdown";
  }
  return undefined;
}

/**
 * Parse a document, automatically detecting if it's a .thalo file or markdown with embedded thalo blocks.
 *
 * @param source - The source code to parse
 * @param options - Parse options including fileType and filename
 * @returns A ParsedDocument containing one or more parsed blocks
 */
export function parseDocument(source: string, options: ParseOptions = {}): ParsedDocument {
  const { fileType, filename } = options;

  // Use explicit fileType if provided
  if (fileType === "thalo") {
    return parseThaloDocument(source);
  }
  if (fileType === "markdown") {
    return extractThaloBlocks(source);
  }

  // Try to detect from filename
  if (filename) {
    const detected = detectFileType(filename);
    if (detected === "thalo") {
      return parseThaloDocument(source);
    }
    if (detected === "markdown") {
      return extractThaloBlocks(source);
    }
  }

  // Use heuristics: if it contains markdown thalo fences, treat as markdown
  if (source.includes("```thalo")) {
    return extractThaloBlocks(source);
  }

  // Otherwise treat as pure thalo
  return parseThaloDocument(source);
}
