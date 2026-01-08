import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: "cjs",
  dts: true,
  external: ["vscode", "@rejot-dev/thalo-lsp"],
  platform: "node",
});
