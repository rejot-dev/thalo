import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: "cjs",
  dts: true,
  // vscode is provided by VS Code runtime
  external: ["vscode"],
  // Bundle vscode-languageclient (including subpaths like /node) into the extension
  noExternal: [/^vscode-languageclient/],
  platform: "node",
});
