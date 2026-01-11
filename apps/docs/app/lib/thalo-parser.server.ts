/**
 * Thalo parser - SERVER-ONLY version.
 *
 * Creates a ThaloParser using direct WebAssembly.Module imports,
 * which only works in server environments (Cloudflare Workers).
 *
 * For client-side parsing, use thalo-parser.client.ts instead.
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/webassembly/
 */

import { createParser, type ThaloParser, type Tree } from "@rejot-dev/thalo/web";
import treeSitterWasm from "../../public/wasm/tree-sitter.wasm";
import languageWasm from "../../public/wasm/tree-sitter-thalo.wasm";

// Re-export parser types for convenience
export type { ThaloParser, Tree } from "@rejot-dev/thalo/web";

// Singleton parser promise
let parserPromise: Promise<ThaloParser<Tree>> | null = null;

/**
 * Get or initialize the WASM parser singleton.
 *
 * Uses directly imported WebAssembly.Module instances, which avoids
 * fetch() calls and leverages Cloudflare's native WASM support.
 */
export async function getParser(): Promise<ThaloParser<Tree>> {
  if (!parserPromise) {
    parserPromise = createParser({
      treeSitterWasm: treeSitterWasm,
      languageWasm: languageWasm,
    });
  }
  return parserPromise;
}
