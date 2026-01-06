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
  parse: (text: string) => parsePtall(text).rootNode,
  astFormat: "ptall-ast",
  locStart: (node: SyntaxNode) => node.startIndex,
  locEnd: (node: SyntaxNode) => node.endIndex,
};
