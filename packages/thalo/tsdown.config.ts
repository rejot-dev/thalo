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
    "./src/services/change-tracker/index.ts",
  ],
  dts: true,
  unbundle: true,
});
