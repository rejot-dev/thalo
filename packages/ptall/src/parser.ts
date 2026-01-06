import Parser, { type Language, type Tree } from "tree-sitter";
import ptall from "@wilco/grammar";

let parserInstance: Parser | undefined;

const getParser = (): Parser => {
  if (!parserInstance) {
    // Ensure nodeTypeInfo is an array (may be undefined if JSON import fails in some environments)
    ptall.nodeTypeInfo ??= [];
    parserInstance = new Parser();
    parserInstance.setLanguage(ptall as unknown as Language);
  }
  return parserInstance;
};

/**
 * Parse a ptall source string into a tree-sitter Tree.
 */
export const parsePtall = (source: string): Tree => {
  return getParser().parse(source);
};

/**
 * A parsed ptall block with its source, offset in the original document, and parse tree.
 */
export interface ParsedBlock {
  /** The ptall source code */
  source: string;
  /** Offset in the original document where this block starts */
  offset: number;
  /** The parsed tree-sitter tree */
  tree: Tree;
}

/**
 * A parsed document containing one or more ptall blocks.
 */
export interface ParsedDocument {
  /** The parsed ptall blocks */
  blocks: ParsedBlock[];
}

/**
 * File type for parsing
 */
export type FileType = "ptall" | "markdown";

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
 * Regex to match fenced ptall code blocks in markdown.
 * Captures the content between ```ptall and ```
 */
const PTALL_FENCE_REGEX = /^```ptall\s*\n([\s\S]*?)^```/gm;

/**
 * Extract ptall code blocks from a markdown string.
 */
function extractPtallBlocks(source: string): ParsedDocument {
  const blocks: ParsedBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = PTALL_FENCE_REGEX.exec(source)) !== null) {
    const content = match[1];
    // Offset is the position of the content start (after ```ptall\n)
    const offset = match.index + match[0].indexOf(content);
    blocks.push({
      source: content,
      offset,
      tree: parsePtall(content),
    });
  }

  // Reset regex state for next call
  PTALL_FENCE_REGEX.lastIndex = 0;

  return { blocks };
}

/**
 * Parse as a pure ptall document.
 */
function parsePtallDocument(source: string): ParsedDocument {
  return {
    blocks: [{ source, offset: 0, tree: parsePtall(source) }],
  };
}

/**
 * Detect file type from filename extension.
 */
function detectFileType(filename: string): FileType | undefined {
  if (filename.endsWith(".ptall")) {
    return "ptall";
  }
  if (filename.endsWith(".md")) {
    return "markdown";
  }
  return undefined;
}

/**
 * Parse a document, automatically detecting if it's a .ptall file or markdown with embedded ptall blocks.
 *
 * @param source - The source code to parse
 * @param options - Parse options including fileType and filename
 * @returns A ParsedDocument containing one or more parsed blocks
 */
export function parseDocument(source: string, options: ParseOptions = {}): ParsedDocument {
  const { fileType, filename } = options;

  // Use explicit fileType if provided
  if (fileType === "ptall") {
    return parsePtallDocument(source);
  }
  if (fileType === "markdown") {
    return extractPtallBlocks(source);
  }

  // Try to detect from filename
  if (filename) {
    const detected = detectFileType(filename);
    if (detected === "ptall") {
      return parsePtallDocument(source);
    }
    if (detected === "markdown") {
      return extractPtallBlocks(source);
    }
  }

  // Use heuristics: if it contains markdown ptall fences, treat as markdown
  if (source.includes("```ptall")) {
    return extractPtallBlocks(source);
  }

  // Otherwise treat as pure ptall
  return parsePtallDocument(source);
}
