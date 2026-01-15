/**
 * Thalo syntax highlighting utilities.
 *
 * This module contains pure functions for converting parsed Thalo code
 * into highlighted output. Works in both server and client environments.
 *
 * Usage:
 * ```typescript
 * import { getParser } from "./thalo-parser.server"; // or .client
 * import { highlightToTokens } from "./thalo-highlighter";
 *
 * const parser = await getParser();
 * const { lines } = highlightToTokens(parser, code);
 * ```
 */

import type { ThaloParser, Tree } from "@rejot-dev/thalo/web";
import {
  extractSemanticTokens,
  tokenTypes,
  type SemanticToken,
} from "@rejot-dev/thalo/services/semantic-tokens";
import type { ParsedDocument as NativeParsedDocument } from "@rejot-dev/thalo";

/**
 * Map semantic token types to inline styles.
 *
 * These colors are based on common Shiki themes (Catppuccin/Github).
 */
export const tokenTypeToStyle: Record<string, string> = {
  namespace: "#e67e22", // timestamp → orange
  type: "#c678dd", // entity types → purple
  class: "#c678dd", // unused
  function: "#61afef", // links → blue
  property: "#e5c07b", // metadata keys → yellow
  string: "#98c379", // titles, descriptions → green
  keyword: "#c678dd", // directives → purple
  comment: "#7f848e", // comments → grey
  variable: "#56b6c2", // tags → cyan
  number: "#e67e22", // datetime values → orange
  operator: "#abb2bf", // |, [], =, :, ; → light grey
  macro: "#c678dd", // markdown header indicators → purple
};

/**
 * A highlighted token with its text and inline style.
 */
export interface HighlightedToken {
  text: string;
  style: string | null;
}

/**
 * A line of highlighted tokens.
 */
export interface HighlightedLine {
  tokens: HighlightedToken[];
}

/**
 * Get the inline style for a token type index.
 * Returns a style string like "color: #c678dd"
 */
export function getTokenStyle(tokenTypeIndex: number): string | null {
  const tokenType = tokenTypes[tokenTypeIndex];
  if (!tokenType) {
    return null;
  }
  const color = tokenTypeToStyle[tokenType];
  if (!color) {
    return null;
  }
  return `color: ${color}`;
}

/**
 * Parse code and extract semantic tokens.
 *
 * @param parser - An instantiated ThaloParser
 * @param code - The Thalo code to parse
 */
export function parseAndExtractTokens(parser: ThaloParser<Tree>, code: string): SemanticToken[] {
  const doc = parser.parseDocument(code, { fileType: "thalo" });
  // Safe: Web and native parsers produce structurally identical ParsedDocument objects,
  // but TypeScript sees them as different types due to separate module boundaries.
  return extractSemanticTokens(doc as unknown as NativeParsedDocument);
}

/**
 * Convert semantic tokens to highlighted lines.
 *
 * @param parser - An instantiated ThaloParser
 * @param code - The Thalo code to highlight
 * @returns Highlighted lines and semantic tokens
 */
export function highlightToTokens(
  parser: ThaloParser<Tree>,
  code: string,
): { lines: HighlightedLine[]; tokens: SemanticToken[] } {
  const tokens = parseAndExtractTokens(parser, code);
  const lines = tokensToLines(code, tokens);
  return { lines, tokens };
}

/**
 * Highlight Thalo code and return HTML string.
 *
 * @param parser - An instantiated ThaloParser
 * @param code - The Thalo code to highlight
 */
export function highlightToHtml(parser: ThaloParser<Tree>, code: string): string {
  const { lines } = highlightToTokens(parser, code);
  return linesToHtml(lines);
}

/**
 * Convert semantic tokens to highlighted lines.
 *
 * This splits the code into lines and applies inline styles to each span.
 */
export function tokensToLines(code: string, tokens: SemanticToken[]): HighlightedLine[] {
  const lines = code.split("\n");
  const result: HighlightedLine[] = [];

  // Group tokens by line
  const tokensByLine = new Map<number, SemanticToken[]>();
  for (const token of tokens) {
    const existing = tokensByLine.get(token.line) || [];
    existing.push(token);
    tokensByLine.set(token.line, existing);
  }

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineTokens = tokensByLine.get(lineIdx) || [];
    const highlightedTokens: HighlightedToken[] = [];

    let pos = 0;
    for (const token of lineTokens) {
      // Add unhighlighted text before this token
      if (token.startChar > pos) {
        highlightedTokens.push({
          text: line.slice(pos, token.startChar),
          style: null,
        });
      }

      // Add the highlighted token
      const tokenEnd = Math.min(token.startChar + token.length, line.length);
      highlightedTokens.push({
        text: line.slice(token.startChar, tokenEnd),
        style: getTokenStyle(token.tokenType),
      });

      pos = tokenEnd;
    }

    // Add remaining unhighlighted text
    if (pos < line.length) {
      highlightedTokens.push({
        text: line.slice(pos),
        style: null,
      });
    }

    // If the line is empty, add an empty token
    if (highlightedTokens.length === 0) {
      highlightedTokens.push({ text: "", style: null });
    }

    result.push({ tokens: highlightedTokens });
  }

  return result;
}

/**
 * Escape HTML special characters.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Convert highlighted lines to HTML string.
 */
export function linesToHtml(lines: HighlightedLine[]): string {
  return lines
    .map((line) => {
      const spans = line.tokens
        .map((token) => {
          const escaped = escapeHtml(token.text);
          if (token.style) {
            return `<span style="${token.style}">${escaped}</span>`;
          }
          return escaped;
        })
        .join("");
      return `<span class="line">${spans}</span>`;
    })
    .join("\n");
}
