import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import mdx from "fumadocs-mdx/vite";
import devtoolsJson from "vite-plugin-devtools-json";
import * as MdxConfig from "./source.config";
import path from "path";

export default defineConfig(() => {
  return {
    resolve: {
      alias: {
        "@/components": path.resolve(__dirname, "./app/components"),
        "@/lib": path.resolve(__dirname, "./app/lib"),
      },
    },
    plugins: [
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
    // Exclude web-tree-sitter from SSR optimization so Cloudflare plugin
    // can properly handle WASM imports
    ssr: {
      optimizeDeps: {
        exclude: ["web-tree-sitter"],
      },
    },
  };
});
