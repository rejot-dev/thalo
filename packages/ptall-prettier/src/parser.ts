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

export const parser = {
  parse: (text: string) => {
    const tree = parsePtall(text);
    if (tree.rootNode.hasError) {
      throw new Error(
        "Parse error: The file contains syntax errors. " +
          "Please check that field definitions and sections use exactly 2 spaces of indentation. " +
          "Run tree-sitter parse to see detailed error locations.",
      );
    }
    return tree.rootNode;
  },
  astFormat: "ptall-ast",
  locStart: (node: SyntaxNode) => node.startIndex,
  locEnd: (node: SyntaxNode) => node.endIndex,
};
