import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
    server: {
      deps: {
        inline: ["@rejot-dev/thalo-prettier"],
      },
    },
  },
  resolve: {
    alias: {
      vscode: new URL("./src/__mocks__/vscode.ts", import.meta.url).pathname,
    },
  },
});
