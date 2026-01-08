import Parser, { type Language, type SyntaxNode } from "tree-sitter";
import ptall from "@rejot-dev/grammar";
import {
  findErrorNodes,
  formatParseErrors,
  type ErrorLocation,
  extractErrorLocations,
} from "./parse-errors";

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

// Re-export for external use
export { findErrorNodes, formatParseErrors, type ErrorLocation, extractErrorLocations };

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
