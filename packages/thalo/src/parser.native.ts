/**
 * Native (Node.js) parser implementation using tree-sitter native bindings.
 */

import Parser, { type Language, type Tree } from "tree-sitter";
import thalo from "@rejot-dev/tree-sitter-thalo";
import {
  createThaloParser,
  type ThaloParser,
  type ParsedBlock as GenericParsedBlock,
  type ParsedDocument as GenericParsedDocument,
  type FileType,
  type ParseOptions,
} from "./parser.shared.js";
import { Workspace } from "./model/workspace.js";

// Re-export shared types specialized to native Tree type
export type ParsedBlock = GenericParsedBlock<Tree>;
export type ParsedDocument = GenericParsedDocument<Tree>;
export type { FileType, ParseOptions, ThaloParser };

// Re-export Workspace for convenience
export { Workspace } from "./model/workspace.js";

// Cached parser instance for createWorkspace
let cachedParser: ThaloParser<Tree> | null = null;

/**
 * Create a native ThaloParser instance.
 *
 * This creates a new tree-sitter Parser with the thalo language loaded.
 * Each call creates a new parser instance.
 *
 * @example
 * ```typescript
 * import { createParser } from "@rejot-dev/thalo/native";
 *
 * const parser = createParser();
 * const tree = parser.parse(source);
 * const doc = parser.parseDocument(source, { fileType: "thalo" });
 * ```
 */
export function createParser(): ThaloParser<Tree> {
  // Ensure nodeTypeInfo is an array (may be undefined if JSON import fails in some environments)
  thalo.nodeTypeInfo ??= [];

  const tsParser = new Parser();
  tsParser.setLanguage(thalo as unknown as Language);

  return createThaloParser(tsParser);
}

/**
 * Create a Workspace with the native (Node.js) parser.
 *
 * This is a convenience function for Node.js environments that don't need
 * to customize the parser. For browser environments, use the Workspace
 * constructor directly with a web parser.
 *
 * @example
 * ```typescript
 * import { createWorkspace } from "@rejot-dev/thalo/native";
 *
 * const workspace = createWorkspace();
 * workspace.addDocument(source, { filename: "test.thalo" });
 * ```
 */
export function createWorkspace(): Workspace {
  if (!cachedParser) {
    cachedParser = createParser();
  }
  return new Workspace(cachedParser);
}

/**
 * Get the singleton parser (creating it if needed) and parse a document.
 *
 * @param source - The source code to parse
 * @param options - Parse options
 * @returns A parsed document
 */
export function parseDocument(source: string, options?: ParseOptions): GenericParsedDocument<Tree> {
  if (!cachedParser) {
    cachedParser = createParser();
  }
  return cachedParser.parseDocument(source, options);
}
