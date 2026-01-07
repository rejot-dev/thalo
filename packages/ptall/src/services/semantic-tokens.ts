import type { SyntaxNode, Tree } from "tree-sitter";
import type { ParsedDocument } from "../parser.js";

/**
 * Semantic token types - these map to LSP's SemanticTokenTypes
 */
export const tokenTypes = [
  "namespace", // timestamp
  "type", // entity type (lore, opinion, etc.)
  "class", // directive (create, update, define-entity, alter-entity)
  "function", // link (^link-id)
  "property", // metadata key
  "string", // title, description, quoted strings
  "keyword", // section keywords (metadata:, sections:, etc.)
  "comment", // content lines
  "variable", // tag names
  "number", // date values
] as const;

export type TokenType = (typeof tokenTypes)[number];

/**
 * Semantic token modifiers
 */
export const tokenModifiers = [
  "declaration", // link definition
  "definition", // entity definition
  "documentation", // description text
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
 * Extract semantic tokens from a parsed document
 */
export function extractSemanticTokens(document: ParsedDocument): SemanticToken[] {
  const tokens: SemanticToken[] = [];

  for (const block of document.blocks) {
    extractTokensFromTree(block.tree, block.offset, tokens);
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
function extractTokensFromTree(tree: Tree, offset: number, tokens: SemanticToken[]): void {
  const cursor = tree.walk();

  // DFS traversal
  const visitNode = (node: SyntaxNode): void => {
    const token = getTokenForNode(node, offset);
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
 * Get a semantic token for a tree-sitter node (if applicable)
 */
function getTokenForNode(node: SyntaxNode, _blockOffset: number): SemanticToken | null {
  const { type, startPosition, endPosition } = node;

  // Skip ERROR nodes
  if (type === "ERROR") {
    return null;
  }

  let tokenType: TokenType | null = null;
  let modifiers: TokenModifier[] = [];

  switch (type) {
    case "timestamp":
      tokenType = "namespace";
      modifiers = ["declaration"];
      break;

    case "directive":
      tokenType = "class";
      modifiers = ["definition"];
      break;

    case "entity":
      tokenType = "type";
      break;

    case "entity_name":
      tokenType = "type";
      modifiers = ["definition"];
      break;

    case "link":
      tokenType = "function";
      // Check if this is a definition (in header) or reference (in metadata)
      if (
        node.parent?.type === "instance_header" ||
        node.parent?.type === "schema_header" ||
        node.parent?.type === "synthesis_header"
      ) {
        modifiers = ["declaration"];
      }
      break;

    case "tag":
      tokenType = "variable";
      break;

    case "title":
      tokenType = "string";
      break;

    case "metadata_key":
    case "field_name":
      tokenType = "property";
      break;

    case "section_name":
      tokenType = "property";
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

    case "block_keyword":
      // metadata:, sections:, remove-metadata:, remove-sections:
      tokenType = "keyword";
      break;

    case "markdown_header":
      tokenType = "keyword";
      break;

    default:
      return null;
  }

  if (!tokenType) {
    return null;
  }

  // For multiline tokens, only highlight the first line
  const line = startPosition.row;
  const startChar = startPosition.column;
  const length =
    startPosition.row === endPosition.row
      ? endPosition.column - startPosition.column
      : node.text.indexOf("\n");

  return {
    line,
    startChar,
    length: length > 0 ? length : node.text.length,
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
