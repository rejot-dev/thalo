import { defineConfig } from "tsdown";

const external = ["tree-sitter", "node-gyp-build", "@rejot-dev/thalo-prettier"];

export default defineConfig([
  {
    entry: ["./src/mod.ts"],
    dts: true,
    unbundle: true,
    // Keep the library-style output for package exports.
    external,
  },
  {
    entry: { "mod.bundled": "./src/mod.ts" },
    dts: false,
    platform: "node",
    // Bundle workspace dependencies so the CLI binary works from a linked checkout
    // without requiring every dependency package to have been built first.
    external,
    noExternal: [/^@rejot-dev\/thalo($|\/)/, /^@rejot-dev\/thalo-lsp($|\/)/],
  },
]);
