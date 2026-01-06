/**
 * @file Ptall grammar for tree-sitter
 * @author Wilco Kruijer <wilco@rejot.dev>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "ptall",

  rules: {
    // TODO: add the actual grammar rules
    source_file: (_$) => "hello",
  },
});
