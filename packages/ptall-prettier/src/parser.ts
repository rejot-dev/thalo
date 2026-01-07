import Parser, { type Language, type SyntaxNode } from "tree-sitter";
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

export const parsePtall = (source: string): Parser.Tree => {
  return getParser().parse(source);
};

interface ParseErrorLocation {
  line: number; // 1-indexed
  column: number; // 1-indexed
  context: string;
}

/**
 * Recursively find all ERROR and MISSING nodes in the tree.
 */
function findErrorNodes(node: SyntaxNode): SyntaxNode[] {
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
 * Extract context around an error (the line containing the error).
 */
function getErrorContext(source: string, lineIndex: number): string {
  const lines = source.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return "";
  }
  return lines[lineIndex];
}

/**
 * Format error locations into a readable message.
 */
export function formatParseErrors(source: string, errorNodes: SyntaxNode[]): string {
  const locations: ParseErrorLocation[] = errorNodes.map((node) => ({
    line: node.startPosition.row + 1,
    column: node.startPosition.column + 1,
    context: getErrorContext(source, node.startPosition.row),
  }));

  // Deduplicate by line only - multiple errors on same line are usually cascading
  const seenLines = new Set<number>();
  const uniqueLocations = locations.filter((loc) => {
    if (seenLines.has(loc.line)) {
      return false;
    }
    seenLines.add(loc.line);
    return true;
  });

  const errorMessages = uniqueLocations.slice(0, 3).map((loc) => {
    const pointer = " ".repeat(loc.column - 1) + "^";
    const contextDisplay = loc.context ? `\n    ${loc.context}\n    ${pointer}` : "";
    return `  Line ${loc.line}, column ${loc.column}:${contextDisplay}`;
  });

  const remaining = uniqueLocations.length - 3;
  if (remaining > 0) {
    errorMessages.push(`  ... and ${remaining} more line(s) with errors`);
  }

  return (
    `Parse error at line ${uniqueLocations[0]?.line ?? "?"}:\n` +
    errorMessages.join("\n\n") +
    "\n\nHint: Content must start with a section header (# Section Name).\n" +
    "      Metadata and content lines must be indented."
  );
}

export const parser = {
  parse: (text: string) => {
    const tree = parsePtall(text);
    if (tree.rootNode.hasError) {
      const errorNodes = findErrorNodes(tree.rootNode);
      throw new Error(formatParseErrors(text, errorNodes));
    }
    return tree.rootNode;
  },
  astFormat: "ptall-ast",
  locStart: (node: SyntaxNode) => node.startIndex,
  locEnd: (node: SyntaxNode) => node.endIndex,
};
