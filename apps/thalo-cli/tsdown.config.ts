import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/mod.ts"],
  dts: true,
  unbundle: true,
  // Externalize native modules and thalo-prettier (optional dep with native tree-sitter)
  external: ["tree-sitter", "node-gyp-build", "@rejot-dev/thalo-prettier"],
});
