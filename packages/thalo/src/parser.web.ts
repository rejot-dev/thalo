/**
 * Web (WASM) parser implementation using web-tree-sitter.
 */

import { Parser, Language, type Tree, type Node } from "web-tree-sitter";
import {
  createThaloParser,
  type ThaloParser,
  type ParsedBlock as GenericParsedBlock,
  type ParsedDocument as GenericParsedDocument,
  type FileType,
  type ParseOptions,
} from "./parser.shared.js";

// Re-export web-tree-sitter types for consumers
export type { Tree, Node } from "web-tree-sitter";

// Re-export shared types specialized to web-tree-sitter Tree type
export type ParsedBlock = GenericParsedBlock<Tree>;
export type ParsedDocument = GenericParsedDocument<Tree>;
export type { FileType, ParseOptions, ThaloParser };

/**
 * WASM input type - either raw bytes or a pre-compiled WebAssembly.Module.
 *
 * Use `WebAssembly.Module` in environments that support it (like Cloudflare Workers)
 * or when you want to pre-compile the WASM for better performance.
 */
export type WasmInput = Uint8Array | WebAssembly.Module;

/**
 * Options for creating a web parser.
 */
export interface CreateParserOptions {
  /**
   * The web-tree-sitter runtime WASM.
   * This is the `tree-sitter.wasm` file from the `web-tree-sitter` package.
   *
   * Can be provided as:
   * - `Uint8Array`: Raw WASM bytes
   * - `WebAssembly.Module`: Pre-compiled WASM module (useful for Cloudflare Workers, etc.)
   */
  treeSitterWasm: WasmInput;

  /**
   * The thalo language WASM.
   * This is the `tree-sitter-thalo.wasm` file from `@rejot-dev/tree-sitter-thalo`.
   *
   * Can be provided as:
   * - `Uint8Array`: Raw WASM bytes
   * - `WebAssembly.Module`: Pre-compiled WASM module (useful for Cloudflare Workers, etc.)
   */
  languageWasm: WasmInput;
}

/**
 * Create a web ThaloParser instance using WASM.
 *
 * This initializes web-tree-sitter and loads the thalo language WASM.
 * Must be awaited before parsing.
 *
 * @example
 * ```typescript
 * import { createParser } from "@rejot-dev/thalo/web";
 *
 * // Option 1: Fetch both WASM files as bytes
 * const [treeSitterWasm, languageWasm] = await Promise.all([
 *   fetch("/wasm/tree-sitter.wasm").then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
 *   fetch("/wasm/tree-sitter-thalo.wasm").then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
 * ]);
 *
 * // Option 2: Use pre-compiled WebAssembly.Module (e.g., in Cloudflare Workers)
 * // import treeSitterWasm from "./tree-sitter.wasm";
 * // import languageWasm from "./tree-sitter-thalo.wasm";
 *
 * const parser = await createParser({ treeSitterWasm, languageWasm });
 *
 * const tree = parser.parse(source);
 * const doc = parser.parseDocument(source, { fileType: "thalo" });
 * ```
 */
export async function createParser(options: CreateParserOptions): Promise<ThaloParser<Tree>> {
  const { treeSitterWasm, languageWasm } = options;

  // Initialize the tree-sitter runtime
  if (treeSitterWasm instanceof WebAssembly.Module) {
    // Pre-compiled module: use instantiateWasm to provide it
    // The callback expects (instance, module) - both the Instance and the Module
    await Parser.init({
      instantiateWasm: async (
        imports: WebAssembly.Imports,
        successCallback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
      ) => {
        const instance = await WebAssembly.instantiate(treeSitterWasm, imports);
        // Pass both the instance AND the original module to the callback
        successCallback(instance, treeSitterWasm);
        return instance.exports;
      },
    });
  } else {
    // Raw bytes: use wasmBinary
    await Parser.init({
      wasmBinary: treeSitterWasm,
    });
  }

  const tsParser = new Parser();

  // Load the language - supports both Uint8Array and WebAssembly.Module
  let language: Language;
  if (languageWasm instanceof WebAssembly.Module) {
    // Use our patched loadModuleSync method for pre-compiled modules (synchronous)
    language = Language.loadModuleSync(languageWasm);
  } else {
    // Use standard load for bytes (async)
    language = await Language.load(languageWasm);
  }
  tsParser.setLanguage(language);

  return createThaloParser(tsParser);
}
