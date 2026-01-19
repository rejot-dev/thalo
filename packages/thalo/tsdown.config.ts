import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "./src/mod.ts",
    "./src/parser.native.ts",
    "./src/parser.node.ts",
    "./src/parser.web.ts",
    "./src/services/semantic-tokens.ts",
    "./src/services/definition.ts",
    "./src/services/references.ts",
    "./src/services/hover.ts",
    "./src/services/change-tracker/change-tracker.ts",
    "./src/services/change-tracker/create-tracker.ts",
    "./src/commands/check.ts",
    "./src/commands/format.ts",
    "./src/commands/query.ts",
    "./src/commands/actualize.ts",
    "./src/formatters.ts",
    "./src/files.ts",
  ],
  dts: true,
  unbundle: true,
  // Externalize native modules to prevent bundling
  external: ["tree-sitter", "node-gyp-build"],
});
