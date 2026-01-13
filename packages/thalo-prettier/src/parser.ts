import Parser, { type Language, type SyntaxNode } from "tree-sitter";
import thalo from "@rejot-dev/tree-sitter-thalo";
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
    thalo.nodeTypeInfo ??= [];
    parserInstance = new Parser();
    parserInstance.setLanguage(thalo as unknown as Language);
  }
  return parserInstance;
};

export const parseThalo = (source: string): Parser.Tree => {
  return getParser().parse(source);
};

// Re-export for external use
export { findErrorNodes, formatParseErrors, type ErrorLocation, extractErrorLocations };

// Extended root node type that includes parse metadata
export interface ThaloRootNode extends SyntaxNode {
  _thaloSource?: string;
  _thaloFilepath?: string;
  _thaloHasErrors?: boolean;
}

interface ParserOptions {
  filepath?: string;
}

export const parser = {
  parse: (text: string, options?: ParserOptions): ThaloRootNode => {
    const tree = parseThalo(text);
    const rootNode = tree.rootNode as ThaloRootNode;

    // Attach metadata to root node for printer to access
    rootNode._thaloSource = text;
    rootNode._thaloFilepath = options?.filepath;
    rootNode._thaloHasErrors = tree.rootNode.hasError;

    // Don't throw - let printer handle ERROR nodes gracefully
    return rootNode;
  },
  astFormat: "thalo-ast",
  locStart: (node: SyntaxNode) => node.startIndex,
  locEnd: (node: SyntaxNode) => node.endIndex,
};
