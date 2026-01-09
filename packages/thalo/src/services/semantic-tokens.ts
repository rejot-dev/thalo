import type { SyntaxNode, Tree } from "tree-sitter";
import type { ParsedDocument } from "../parser.js";
import type { SourceMap } from "../source-map.js";

/**
 * Semantic token types - these map to LSP's SemanticTokenTypes
 *
 * See: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#semanticTokenTypes
 */
export const tokenTypes = [
  "namespace", // timestamp
  "type", // entity type (lore, opinion, etc.), primitive types
  "class", // (unused, kept for index stability)
  "function", // link (^link-id)
  "property", // metadata key, field name, section name
  "string", // title, description, quoted strings, literal types
  "keyword", // where, and, block headers (# Metadata, etc.)
  "comment", // comments
  "variable", // tag names
  "number", // datetime values, date ranges
  "operator", // |, [], =, :, ;, (, ), ,
  "macro", // markdown header indicator (#, ##, etc.)
] as const;

export type TokenType = (typeof tokenTypes)[number];

/**
 * Semantic token modifiers
 */
export const tokenModifiers = [
  "declaration", // link definition
  "definition", // entity definition
  "documentation", // description text
  "readonly", // optional marker (?)
] as const;

export type TokenModifier = (typeof tokenModifiers)[number];

/**
 * A semantic token with position and type information
 */
export interface SemanticToken {
  /** Line number (0-based) */
  line: number;
  /** Character offset on the line (0-based) */
  startChar: number;
  /** Length of the token */
  length: number;
  /** Token type index (into tokenTypes array) */
  tokenType: number;
  /** Token modifiers as a bitmask */
  tokenModifiers: number;
}

/**
 * Get the index of a token type
 */
export function getTokenTypeIndex(type: TokenType): number {
  return tokenTypes.indexOf(type);
}

/**
 * Get the modifier bitmask for a set of modifiers
 */
export function getTokenModifiersMask(modifiers: TokenModifier[]): number {
  let mask = 0;
  for (const mod of modifiers) {
    const index = tokenModifiers.indexOf(mod);
    if (index >= 0) {
      mask |= 1 << index;
    }
  }
  return mask;
}

/**
 * Extract semantic tokens from a parsed document.
 * Returns tokens with file-absolute positions (sourceMap applied).
 */
export function extractSemanticTokens(document: ParsedDocument): SemanticToken[] {
  const tokens: SemanticToken[] = [];

  for (const block of document.blocks) {
    extractTokensFromTree(block.tree, block.sourceMap, tokens);
  }

  // Sort by position (line, then character)
  tokens.sort((a, b) => {
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return a.startChar - b.startChar;
  });

  return tokens;
}

/**
 * Extract tokens from a tree-sitter tree
 */
function extractTokensFromTree(tree: Tree, sourceMap: SourceMap, tokens: SemanticToken[]): void {
  const cursor = tree.walk();

  // DFS traversal
  const visitNode = (node: SyntaxNode): void => {
    const token = getTokenForNode(node, sourceMap);
    if (token) {
      tokens.push(token);
    }

    // Visit children
    if (cursor.gotoFirstChild()) {
      do {
        visitNode(cursor.currentNode);
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }
  };

  visitNode(cursor.currentNode);
}

/**
 * Get a semantic token for a tree-sitter node (if applicable).
 * Returns token with file-absolute positions (sourceMap applied).
 */
function getTokenForNode(node: SyntaxNode, sourceMap: SourceMap): SemanticToken | null {
  let { type, startPosition, endPosition } = node;
  let nodeText = node.text;

  // Skip ERROR nodes and certain wrapper nodes
  if (type === "ERROR") {
    return null;
  }

  let tokenType: TokenType | null = null;
  let modifiers: TokenModifier[] = [];

  switch (type) {
    // =========================================================================
    // Header elements
    // =========================================================================
    case "timestamp":
      tokenType = "number"; // same as datetime_value for consistent date coloring
      break;

    case "instance_directive":
    case "schema_directive":
    case "define-synthesis":
    case "actualize-synthesis":
      tokenType = "keyword";
      break;

    case "entity":
    case "query_entity":
      tokenType = "type";
      break;

    case "identifier":
      // Entity name in schema entries (define-entity custom)
      tokenType = "type";
      modifiers = ["definition"];
      break;

    case "title":
      tokenType = "string";
      break;

    case "link":
      tokenType = "function";
      // Check if this is a definition (directly on entry) or reference (in metadata)
      if (node.parent?.type === "data_entry" || node.parent?.type === "schema_entry") {
        modifiers = ["declaration"];
      }
      break;

    case "tag":
      tokenType = "variable";
      break;

    // =========================================================================
    // Metadata
    // =========================================================================
    case "key":
      tokenType = "property";
      break;

    case "quoted_value":
      tokenType = "string";
      break;

    case "datetime_value":
    case "date_range":
      tokenType = "number";
      break;

    // =========================================================================
    // Schema definitions
    // =========================================================================
    case "field_name":
    case "section_name": {
      tokenType = "property";
      // These tokens include leading whitespace (\n + indent), strip it
      const trimmed = nodeText.trimStart();
      const leadingLen = nodeText.length - trimmed.length;
      if (leadingLen > 0) {
        // Adjust position to after the whitespace (endPosition is correct, work backwards)
        startPosition = { row: endPosition.row, column: endPosition.column - trimmed.length };
        nodeText = trimmed;
      }
      break;
    }

    case "optional_marker":
      tokenType = "operator";
      modifiers = ["readonly"];
      break;

    case "primitive_type":
      tokenType = "type";
      break;

    case "literal_type":
      tokenType = "string";
      break;

    case "description":
      tokenType = "string";
      modifiers = ["documentation"];
      break;

    // =========================================================================
    // Operators and punctuation
    // =========================================================================
    case "|":
    case "[]":
    case ":":
    case "=":
    case ";":
    case "(":
    case ")":
    case ",":
      tokenType = "operator";
      break;

    // =========================================================================
    // Query expressions
    // =========================================================================
    case "where":
    case "and":
      tokenType = "keyword";
      break;

    case "condition_field":
      tokenType = "property";
      break;

    // =========================================================================
    // Comments
    // =========================================================================
    case "comment":
      tokenType = "comment";
      break;

    // =========================================================================
    // Content sections
    // =========================================================================
    case "md_indicator":
      tokenType = "macro";
      break;

    case "md_heading_text":
      tokenType = "keyword";
      break;

    default:
      return null;
  }

  if (!tokenType) {
    return null;
  }

  // For multiline tokens, only highlight the first line
  const length =
    startPosition.row === endPosition.row
      ? endPosition.column - startPosition.column
      : nodeText.indexOf("\n");

  // Apply sourceMap to convert block-relative positions to file-absolute
  // For the first line of the block, add both line and column offset
  // For subsequent lines, only add line offset
  const isFirstBlockLine = startPosition.row === 0;
  const fileLine = sourceMap.lineOffset + startPosition.row;
  const fileChar = isFirstBlockLine
    ? sourceMap.columnOffset + startPosition.column
    : startPosition.column;

  return {
    line: fileLine,
    startChar: fileChar,
    length: length > 0 ? length : nodeText.length,
    tokenType: getTokenTypeIndex(tokenType),
    tokenModifiers: getTokenModifiersMask(modifiers),
  };
}

/**
 * Encode semantic tokens into the LSP delta format
 *
 * LSP expects tokens in a flattened array where each token is:
 * [deltaLine, deltaStartChar, length, tokenType, tokenModifiers]
 */
export function encodeSemanticTokens(tokens: SemanticToken[]): number[] {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;

  for (const token of tokens) {
    const deltaLine = token.line - prevLine;
    const deltaChar = deltaLine === 0 ? token.startChar - prevChar : token.startChar;

    data.push(deltaLine, deltaChar, token.length, token.tokenType, token.tokenModifiers);

    prevLine = token.line;
    prevChar = token.startChar;
  }

  return data;
}
