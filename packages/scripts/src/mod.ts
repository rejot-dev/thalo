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

// Note: These are exported for internal tests, not used by other packages
export function hello() {
  console.log("Hello from @rejot-dev/scripts!");
}

export function parseThalo(source: string): Parser.Tree {
  return getParser().parse(source);
}

if (import.meta.main) {
  hello();
}
