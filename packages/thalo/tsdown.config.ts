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
    "./src/commands/check.ts",
    "./src/commands/format.ts",
    "./src/commands/query.ts",
    "./src/commands/actualize.ts",
    "./src/formatters.ts",
  ],
  dts: true,
  unbundle: true,
});
