import { defineConfig } from "tsdown";

export default defineConfig([
  // Unbundled output for library use
  {
    entry: ["./src/mod.ts", "./src/server.ts"],
    dts: true,
    unbundle: true,
  },
  // Bundled server for VS Code extension embedding
  {
    entry: { "server.bundled": "./src/server.ts" },
    dts: false,
    platform: "node",
  },
]);
