import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import mdx from "fumadocs-mdx/vite";
import devtoolsJson from "vite-plugin-devtools-json";
import * as MdxConfig from "./source.config";
import path from "path";

/**
 * Stub native tree-sitter for browser builds.
 *
 * In a pnpm monorepo, tree-sitter is installed at the workspace root (used by
 * CLI) and Vite's dependency optimizer scans all of node_modules. This plugin
 * intercepts resolution before esbuild tries to process the native .node files.
 *
 * NOTE(Wilco): This is AI written and I'm not sure I agree with the reasoning, but it does work.
 */
function stubNativeTreeSitter(): Plugin {
  const STUB_ID = "\0native-tree-sitter-stub";
  // Stub both native tree-sitter and the grammar's native binding
  // (docs only uses the WASM export, not the main entry)
  const nativeModules = ["tree-sitter", "@rejot-dev/tree-sitter-thalo"];

  return {
    name: "stub-native-tree-sitter",
    enforce: "pre",
    resolveId(id) {
      if (nativeModules.includes(id)) {
        return { id: STUB_ID, external: false };
      }
      return null;
    },
    load(id) {
      if (id === STUB_ID) {
        return "export default {}; export const nodeTypeInfo = [];";
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    resolve: {
      alias: {
        "@/components": path.resolve(__dirname, "./app/components"),
        "@/lib": path.resolve(__dirname, "./app/lib"),
      },
    },
    plugins: [
      stubNativeTreeSitter(),
      mdx(MdxConfig),
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tailwindcss(),
      reactRouter(),
      tsconfigPaths({
        root: __dirname,
      }),
      devtoolsJson(),
    ],
    optimizeDeps: {
      include: ["hast-util-to-jsx-runtime"],
    },
    ssr: {
      optimizeDeps: {
        exclude: ["web-tree-sitter"],
      },
      noExternal: ["@rejot-dev/thalo"],
    },
  };
});
