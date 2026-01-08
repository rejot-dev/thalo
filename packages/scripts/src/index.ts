import Parser, { type Language } from "tree-sitter";
import thalo from "@rejot-dev/tree-sitter-thalo";

let parser: Parser | undefined;

const getParser = (): Parser => {
  if (!parser) {
    // Ensure nodeTypeInfo is an array (may be undefined if JSON import fails in some environments)
    thalo.nodeTypeInfo ??= [];
    parser = new Parser();
    parser.setLanguage(thalo as unknown as Language);
  }
  return parser;
};

export const hello = () => {
  console.log("Hello from @rejot-dev/scripts!");
};

export const parseThalo = (source: string): Parser.Tree => {
  return getParser().parse(source);
};

if (import.meta.main) {
  hello();
}
