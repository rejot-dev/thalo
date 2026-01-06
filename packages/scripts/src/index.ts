import Parser, { type Language } from "tree-sitter";
import ptall from "@wilco/grammar";

let parser: Parser | undefined;

const getParser = (): Parser => {
  if (!parser) {
    // Ensure nodeTypeInfo is an array (may be undefined if JSON import fails in some environments)
    ptall.nodeTypeInfo ??= [];
    parser = new Parser();
    parser.setLanguage(ptall as unknown as Language);
  }
  return parser;
};

export const hello = () => {
  console.log("Hello from @kc/scripts!");
};

export const parsePtall = (source: string): Parser.Tree => {
  return getParser().parse(source);
};

if (import.meta.main) {
  hello();
}
