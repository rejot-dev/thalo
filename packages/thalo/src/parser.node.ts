/**
 * Node.js parser with automatic fallback from native to WASM.
 *
 * This module provides a unified API for Node.js environments that:
 * 1. Tries to use native tree-sitter bindings (fastest)
 * 2. Falls back to web-tree-sitter WASM if native bindings aren't available
 *
 * The fallback is transparent - callers don't need to know which implementation
 * is being used. The only requirement is that `initParser()` must be called
 * (and awaited) before using `createParser()` or `createWorkspace()`.
 *
 * @example
 * ```typescript
 * import { initParser, createWorkspace } from "@rejot-dev/thalo/node";
 *
 * // Initialize once at startup (required)
 * await initParser();
 *
 * // Then use synchronously
 * const workspace = createWorkspace();
 * workspace.addDocument(source, { filename: "test.thalo" });
 * ```
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  createThaloParser,
  type ThaloParser,
  type ParsedBlock as GenericParsedBlock,
  type ParsedDocument as GenericParsedDocument,
  type FileType,
  type ParseOptions,
  type GenericTree,
} from "./parser.shared.js";
import type { Language as NativeLanguage } from "tree-sitter";
import { Workspace } from "./model/workspace.js";

// Re-export shared types
export type ParsedBlock = GenericParsedBlock<GenericTree>;
export type ParsedDocument = GenericParsedDocument<GenericTree>;
export type { FileType, ParseOptions, ThaloParser };

// Re-export Workspace for convenience
export { Workspace } from "./model/workspace.js";

const require = createRequire(import.meta.url);

// Parser factory function - set after initialization
let parserFactory: (() => ThaloParser<GenericTree>) | null = null;

// Track which implementation is being used
let usingNative = false;

/**
 * Check if the parser has been initialized.
 */
export function isInitialized(): boolean {
  return parserFactory !== null;
}

/**
 * Check if using native bindings (vs WASM fallback).
 * Only valid after `initParser()` has been called.
 */
export function isUsingNative(): boolean {
  return usingNative;
}

/**
 * Initialize the parser, trying native first then falling back to WASM.
 *
 * This must be called (and awaited) once before using `createParser()` or
 * `createWorkspace()`. Multiple calls are safe and will return immediately
 * if already initialized.
 *
 * @returns Promise that resolves when parser is ready
 * @throws Error if both native and WASM initialization fail
 */
export async function initParser(): Promise<void> {
  // Already initialized
  if (parserFactory) {
    return;
  }

  // Try native first
  try {
    const { default: Parser } = await import("tree-sitter");
    const { default: thalo } = await import("@rejot-dev/tree-sitter-thalo");

    // Ensure nodeTypeInfo is an array
    thalo.nodeTypeInfo ??= [];

    // Test that we can actually create a parser (this will fail if native bindings are broken)
    const testParser = new Parser();
    testParser.setLanguage(thalo as unknown as NativeLanguage);

    // Native works! Set up the factory
    parserFactory = () => {
      const parser = new Parser();
      parser.setLanguage(thalo as unknown as NativeLanguage);
      return createThaloParser(parser);
    };
    usingNative = true;
    return;
  } catch {
    // Native failed, try WASM fallback
  }

  // Fall back to WASM
  try {
    const { Parser, Language } = await import("web-tree-sitter");

    // Resolve WASM file paths from installed dependencies
    const treeSitterWasmPath = require.resolve("web-tree-sitter/tree-sitter.wasm");
    const languageWasmPath = require.resolve("@rejot-dev/tree-sitter-thalo/tree-sitter-thalo.wasm");

    // Load WASM files
    const treeSitterWasm = readFileSync(treeSitterWasmPath);
    const languageWasm = readFileSync(languageWasmPath);

    // Initialize web-tree-sitter
    await Parser.init({
      wasmBinary: treeSitterWasm,
    });

    // Load the thalo language
    const language = await Language.load(languageWasm);

    // WASM works! Set up the factory
    parserFactory = () => {
      const parser = new Parser();
      parser.setLanguage(language);
      return createThaloParser(parser);
    };
    usingNative = false;
    return;
  } catch (wasmError) {
    throw new Error(
      `Failed to initialize thalo parser. ` +
        `Native tree-sitter bindings are not available for your platform, ` +
        `and WASM fallback also failed: ${wasmError instanceof Error ? wasmError.message : wasmError}`,
    );
  }
}

// Cached parser instance for createWorkspace
let cachedParser: ThaloParser<GenericTree> | null = null;

/**
 * Create a ThaloParser instance.
 *
 * Note: `initParser()` must be called first.
 *
 * @throws Error if `initParser()` has not been called
 */
export function createParser(): ThaloParser<GenericTree> {
  if (!parserFactory) {
    throw new Error(
      "Parser not initialized. Call `await initParser()` before using createParser().",
    );
  }
  return parserFactory();
}

/**
 * Create a Workspace with the initialized parser.
 *
 * Note: `initParser()` must be called first.
 *
 * @example
 * ```typescript
 * import { initParser, createWorkspace } from "@rejot-dev/thalo/node";
 *
 * await initParser();
 * const workspace = createWorkspace();
 * workspace.addDocument(source, { filename: "test.thalo" });
 * ```
 *
 * @throws Error if `initParser()` has not been called
 */
export function createWorkspace(): Workspace {
  if (!parserFactory) {
    throw new Error(
      "Parser not initialized. Call `await initParser()` before using createWorkspace().",
    );
  }
  if (!cachedParser) {
    cachedParser = parserFactory();
  }
  return new Workspace(cachedParser);
}

/**
 * Parse a document using the initialized parser.
 *
 * Note: `initParser()` must be called first.
 *
 * @param source - The source code to parse
 * @param options - Parse options
 * @returns A parsed document
 * @throws Error if `initParser()` has not been called
 */
export function parseDocument(
  source: string,
  options?: ParseOptions,
): GenericParsedDocument<GenericTree> {
  if (!parserFactory) {
    throw new Error(
      "Parser not initialized. Call `await initParser()` before using parseDocument().",
    );
  }
  if (!cachedParser) {
    cachedParser = parserFactory();
  }
  return cachedParser.parseDocument(source, options);
}
