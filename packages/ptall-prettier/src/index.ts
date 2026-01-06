import type { Plugin } from "prettier";
import type { SyntaxNode } from "tree-sitter";
import { parser } from "./parser";
import { printer } from "./printer";

export const languages: Plugin<SyntaxNode>["languages"] = [
  {
    name: "ptall",
    parsers: ["ptall"],
    extensions: [".ptall"],
  },
];

export const parsers: Plugin<SyntaxNode>["parsers"] = {
  ptall: parser,
};

export const printers: Plugin<SyntaxNode>["printers"] = {
  "ptall-ast": printer,
};

// Re-export for convenience
export { parser } from "./parser";
export { printer } from "./printer";
