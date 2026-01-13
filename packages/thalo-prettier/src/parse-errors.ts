import type { SyntaxNode } from "tree-sitter";

// =============================================================================
// Types
// =============================================================================

export interface ErrorLocation {
  line: number; // 1-indexed
  column: number; // 1-indexed
  lineIndex: number; // 0-indexed (for array access)
}

// =============================================================================
// Error Node Discovery
// =============================================================================

/**
 * Recursively find all ERROR and MISSING nodes in the tree.
 */
export function findErrorNodes(node: SyntaxNode): SyntaxNode[] {
  const errors: SyntaxNode[] = [];

  if (node.type === "ERROR" || node.isMissing) {
    errors.push(node);
  }

  for (const child of node.children) {
    errors.push(...findErrorNodes(child));
  }

  return errors;
}

/**
 * Extract error locations from syntax nodes.
 */
export function extractErrorLocations(errorNodes: SyntaxNode[]): ErrorLocation[] {
  return errorNodes.map((node) => ({
    line: node.startPosition.row + 1,
    column: node.startPosition.column + 1,
    lineIndex: node.startPosition.row,
  }));
}

// =============================================================================
// Location Processing
// =============================================================================

/**
 * Deduplicate error locations by line number.
 * Multiple errors on the same line are usually cascading from one root cause.
 */
export function deduplicateByLine(locations: ErrorLocation[]): ErrorLocation[] {
  const seenLines = new Set<number>();
  return locations.filter((loc) => {
    if (seenLines.has(loc.line)) {
      return false;
    }
    seenLines.add(loc.line);
    return true;
  });
}

// =============================================================================
// Context Extraction
// =============================================================================

/**
 * Extract the error line from source.
 */
export function getErrorLine(source: string, lineIndex: number): string | null {
  const allLines = source.split("\n");

  if (lineIndex < 0 || lineIndex >= allLines.length) {
    return null;
  }

  return allLines[lineIndex];
}

// =============================================================================
// Error Message Formatting
// =============================================================================

/**
 * Format context display for a single error location.
 */
export function formatContextDisplay(line: string, column: number): string {
  if (!line) {
    return "";
  }

  const pointer = " ".repeat(Math.max(0, column - 1)) + "^";
  return `\n    ${line}\n    ${pointer}`;
}

/**
 * Format a single error location into a message string.
 * Uses filepath:line:column format for clickable links in terminals.
 */
export function formatErrorLocation(source: string, loc: ErrorLocation, filepath?: string): string {
  const line = getErrorLine(source, loc.lineIndex);
  const locationStr = filepath
    ? `${filepath}:${loc.line}:${loc.column}`
    : `Line ${loc.line}, column ${loc.column}`;

  if (!line) {
    return `  ${locationStr}`;
  }

  const contextDisplay = formatContextDisplay(line, loc.column);
  return `  ${locationStr}${contextDisplay}`;
}

// =============================================================================
// Main Formatting Function
// =============================================================================

const PARSE_ERROR_HINT =
  "\n\nHint: Metadata values must be quoted strings, links (^id), date ranges, or queries.\n" +
  '      Example: type: "fact" (not type: fact)';

/**
 * Format parse errors into a readable message.
 * When filepath is provided, uses filepath:line:column format for clickable links.
 */
export function formatParseErrors(
  source: string,
  errorNodes: SyntaxNode[],
  filepath?: string,
): string {
  const locations = extractErrorLocations(errorNodes);
  const uniqueLocations = deduplicateByLine(locations);

  const errorMessages = uniqueLocations
    .slice(0, 3)
    .map((loc) => formatErrorLocation(source, loc, filepath));

  const remaining = uniqueLocations.length - 3;
  if (remaining > 0) {
    errorMessages.push(`  ... and ${remaining} more line(s) with errors`);
  }

  const firstLoc = uniqueLocations[0];
  const locationHeader =
    filepath && firstLoc ? `${filepath}:${firstLoc.line}` : `line ${firstLoc?.line ?? "?"}`;
  return `Parse error at ${locationHeader}:\n` + errorMessages.join("\n\n") + PARSE_ERROR_HINT;
}
