/**
 * Thalo parser - CLIENT version.
 *
 * Creates a ThaloParser using fetch-based WASM loading,
 * since direct WebAssembly.Module imports are not supported
 * in Vite's client bundler.
 *
 * For server-side parsing, use thalo-parser.server.ts instead.
 */

import { createParser, type ThaloParser, type Tree } from "@rejot-dev/thalo/web";

// Re-export parser types for convenience
export type { ThaloParser, Tree } from "@rejot-dev/thalo/web";

// WASM files are served from public/wasm/ as static assets
const TREE_SITTER_WASM_URL = "/wasm/tree-sitter.wasm";
const LANGUAGE_WASM_URL = "/wasm/tree-sitter-thalo.wasm";

// Singleton parser promise
let parserPromise: Promise<ThaloParser<Tree>> | null = null;

async function fetchWasm(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Get or initialize the WASM parser singleton.
 *
 * Uses fetch to load WASM files from the server.
 */
export async function getParser(): Promise<ThaloParser<Tree>> {
  if (!parserPromise) {
    parserPromise = (async () => {
      const [treeSitterWasm, languageWasm] = await Promise.all([
        fetchWasm(TREE_SITTER_WASM_URL),
        fetchWasm(LANGUAGE_WASM_URL),
      ]);
      return createParser({ treeSitterWasm, languageWasm });
    })().catch((err) => {
      parserPromise = null; // Reset so next call retries
      throw err;
    });
  }
  return parserPromise;
}
