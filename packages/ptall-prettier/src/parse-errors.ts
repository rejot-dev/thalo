import type { SyntaxNode } from "tree-sitter";

// =============================================================================
// Types
// =============================================================================

export interface ErrorLocation {
  line: number; // 1-indexed
  column: number; // 1-indexed
  lineIndex: number; // 0-indexed (for array access)
}

export interface ErrorContext {
  lines: string[];
  errorAtEndOfLine: boolean;
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
 * Extract context lines around an error position.
 * When error is at end of line, includes following non-empty lines
 * since the actual problem is often on the next line.
 */
export function getErrorContext(source: string, lineIndex: number, column: number): ErrorContext {
  const allLines = source.split("\n");

  if (lineIndex < 0 || lineIndex >= allLines.length) {
    return { lines: [], errorAtEndOfLine: false };
  }

  const errorLine = allLines[lineIndex];
  const errorAtEndOfLine = column >= errorLine.length;
  const lines = [errorLine];

  // If error is at end of line, show following non-empty lines for context
  if (errorAtEndOfLine) {
    for (let i = lineIndex + 1; i < allLines.length && i <= lineIndex + 2; i++) {
      const nextLine = allLines[i];
      if (nextLine.trim()) {
        lines.push(nextLine);
      }
    }
  }

  return { lines, errorAtEndOfLine };
}

// =============================================================================
// Error Message Formatting
// =============================================================================

/**
 * Find the position after "key: " in a metadata line to highlight the value.
 * Returns null if pattern not found.
 */
export function findValuePosition(line: string): number | null {
  const match = line.match(/^(\s*\w+:\s*)/);
  return match ? match[1].length : null;
}

/**
 * Format context display for a single error location.
 */
export function formatContextDisplay(
  lines: string[],
  errorAtEndOfLine: boolean,
  column: number,
): string {
  if (lines.length === 0) {
    return "";
  }

  let display = `\n    ${lines[0]}`;

  if (errorAtEndOfLine && lines.length > 1) {
    // Error at end of line - point to the issue which is likely on next line(s)
    display += `\n    ${" ".repeat(lines[0].length)}^ (error may be on following line)`;

    for (let i = 1; i < lines.length; i++) {
      display += `\n    ${lines[i]}`;

      // Try to highlight likely problematic value (after colon)
      const valuePos = findValuePosition(lines[i]);
      if (valuePos !== null) {
        display += `\n    ${" ".repeat(valuePos)}^ check this value`;
        break;
      }
    }
  } else {
    display += `\n    ${" ".repeat(column - 1)}^`;
  }

  return display;
}

/**
 * Format a single error location into a message string.
 */
export function formatErrorLocation(source: string, loc: ErrorLocation): string {
  const { lines, errorAtEndOfLine } = getErrorContext(source, loc.lineIndex, loc.column - 1);

  if (lines.length === 0) {
    return `  Line ${loc.line}, column ${loc.column}`;
  }

  const contextDisplay = formatContextDisplay(lines, errorAtEndOfLine, loc.column);
  return `  Line ${loc.line}, column ${loc.column}:${contextDisplay}`;
}

// =============================================================================
// Main Formatting Function
// =============================================================================

const PARSE_ERROR_HINT =
  "\n\nHint: Metadata values must be quoted strings, links (^id), date ranges, or queries.\n" +
  '      Example: type: "fact" (not type: fact)';

/**
 * Format parse errors into a readable message.
 */
export function formatParseErrors(source: string, errorNodes: SyntaxNode[]): string {
  const locations = extractErrorLocations(errorNodes);
  const uniqueLocations = deduplicateByLine(locations);

  const errorMessages = uniqueLocations.slice(0, 3).map((loc) => formatErrorLocation(source, loc));

  const remaining = uniqueLocations.length - 3;
  if (remaining > 0) {
    errorMessages.push(`  ... and ${remaining} more line(s) with errors`);
  }

  const firstLine = uniqueLocations[0]?.line ?? "?";
  return `Parse error at line ${firstLine}:\n` + errorMessages.join("\n\n") + PARSE_ERROR_HINT;
}
