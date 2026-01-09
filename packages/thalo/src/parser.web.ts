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
 * Options for creating a web parser.
 */
export interface CreateParserOptions {
  /**
   * The web-tree-sitter runtime WASM binary.
   * This is the `web-tree-sitter.wasm` file from the `web-tree-sitter` package.
   */
  treeSitterWasm: Uint8Array;

  /**
   * The thalo language WASM binary.
   * This is the `tree-sitter-thalo.wasm` file from `@rejot-dev/tree-sitter-thalo`.
   */
  languageWasm: Uint8Array;
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
 * // Fetch WASM files (adjust paths for your setup)
 * const [treeSitterWasm, languageWasm] = await Promise.all([
 *   fetch("/wasm/web-tree-sitter.wasm").then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
 *   fetch("/wasm/tree-sitter-thalo.wasm").then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
 * ]);
 *
 * const parser = await createParser({ treeSitterWasm, languageWasm });
 *
 * const tree = parser.parse(source);
 * const doc = parser.parseDocument(source, { fileType: "thalo" });
 * ```
 */
export async function createParser(options: CreateParserOptions): Promise<ThaloParser<Tree>> {
  await Parser.init({
    wasmBinary: options.treeSitterWasm,
  });

  const tsParser = new Parser();
  const language = await Language.load(options.languageWasm);
  tsParser.setLanguage(language);

  return createThaloParser(tsParser);
}
