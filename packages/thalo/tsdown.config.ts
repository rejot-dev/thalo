import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "./src/index.ts",
    "./src/parser.native.ts",
    "./src/parser.web.ts",
    "./src/ast/index.ts",
    "./src/model/index.ts",
    "./src/schema/index.ts",
    "./src/checker/index.ts",
    "./src/services/index.ts",
  ],
  dts: true,
  unbundle: true,
  copy: [
    // web-tree-sitter runtime WASM
    "./node_modules/web-tree-sitter/web-tree-sitter.wasm",
    // thalo language WASM
    "./node_modules/@rejot-dev/tree-sitter-thalo/tree-sitter-thalo.wasm",
  ],
});
