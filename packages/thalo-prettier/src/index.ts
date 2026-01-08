import type { Plugin } from "prettier";
import type { SyntaxNode } from "tree-sitter";
import { parser } from "./parser";
import { printer } from "./printer";

export const languages: Plugin<SyntaxNode>["languages"] = [
  {
    name: "thalo",
    parsers: ["thalo"],
    extensions: [".thalo"],
  },
];

export const parsers: Plugin<SyntaxNode>["parsers"] = {
  thalo: parser,
};

export const printers: Plugin<SyntaxNode>["printers"] = {
  "thalo-ast": printer,
};

// Re-export for convenience
export { parser } from "./parser";
export { printer } from "./printer";
