/**
 * Copy WASM files from dependencies to the public directory.
 *
 * Vite serves files from `public/` as static assets, and Cloudflare Workers
 * can access them via the assets binding. This is the standard way to handle
 * static assets with the Cloudflare Vite plugin.
 *
 * @see https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/
 */

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const targetDir = join(__dirname, "..", "public", "wasm");

async function copyWasmFiles() {
  await mkdir(targetDir, { recursive: true });

  // Copy web-tree-sitter runtime WASM
  const webTreeSitterPath = require.resolve("web-tree-sitter/tree-sitter.wasm");
  await copyFile(webTreeSitterPath, join(targetDir, "tree-sitter.wasm"));
  console.log("✓ Copied tree-sitter.wasm to public/wasm/");

  // Copy thalo language WASM
  const thaloWasmPath = require.resolve("@rejot-dev/tree-sitter-thalo/tree-sitter-thalo.wasm");
  await copyFile(thaloWasmPath, join(targetDir, "tree-sitter-thalo.wasm"));
  console.log("✓ Copied tree-sitter-thalo.wasm to public/wasm/");
}

copyWasmFiles().catch((err) => {
  console.error("Failed to copy WASM files:", err);
  process.exit(1);
});
