import type { SyntaxNode } from "tree-sitter";
import {
  findErrorNodes,
  formatParseErrors,
  type ErrorLocation,
  extractErrorLocations,
} from "./parse-errors";

type ParserTree = import("tree-sitter").Tree | import("web-tree-sitter").Tree;
type ParserInstance = {
  parse: (source: string) => ParserTree;
  setLanguage: (language: unknown) => void;
};

let parserInstance: ParserInstance | undefined;
let parserInit: Promise<ParserInstance> | undefined;

const initParser = async (): Promise<ParserInstance> => {
  if (parserInstance) {
    return parserInstance;
  }
  if (parserInit) {
    return parserInit;
  }

  parserInit = (async () => {
    try {
      const { default: Parser } = await import("tree-sitter");
      const { default: thalo } = await import("@rejot-dev/tree-sitter-thalo");

      // Ensure nodeTypeInfo is an array (may be undefined if JSON import fails in some environments)
      thalo.nodeTypeInfo ??= [];

      const testParser = new Parser();
      testParser.setLanguage(thalo as unknown as import("tree-sitter").Language);

      const parser = new Parser();
      parser.setLanguage(thalo as unknown as import("tree-sitter").Language);
      parserInstance = parser as unknown as ParserInstance;
      return parserInstance;
    } catch {
      // Native bindings failed, fall through to WASM.
    }

    try {
      const { Parser, Language } = await import("web-tree-sitter");
      const { readFileSync } = await import("node:fs");
      const { createRequire } = await import("node:module");
      const require = createRequire(import.meta.url);

      const treeSitterWasmPath = require.resolve("web-tree-sitter/tree-sitter.wasm");
      const languageWasmPath = require.resolve(
        "@rejot-dev/tree-sitter-thalo/tree-sitter-thalo.wasm",
      );

      const treeSitterWasm = readFileSync(treeSitterWasmPath);
      const languageWasm = readFileSync(languageWasmPath);

      await Parser.init({
        wasmBinary: treeSitterWasm,
      });

      const language = await Language.load(languageWasm);
      const parser = new Parser();
      parser.setLanguage(language);
      parserInstance = parser as unknown as ParserInstance;
      return parserInstance;
    } catch (wasmError) {
      throw new Error(
        `Failed to initialize thalo-prettier parser. ` +
          `Native tree-sitter bindings are not available for your platform, ` +
          `and WASM fallback also failed: ${wasmError instanceof Error ? wasmError.message : wasmError}`,
      );
    }
  })();

  return parserInit;
};

const getParser = async (): Promise<ParserInstance> => {
  return initParser();
};

export const parseThalo = async (source: string): Promise<ParserTree> => {
  const parser = await getParser();
  return parser.parse(source);
};

// Re-export for external use
export { findErrorNodes, formatParseErrors, type ErrorLocation, extractErrorLocations };

// Extended root node type that includes parse metadata
export interface ThaloRootNode extends SyntaxNode {
  _thaloSource?: string;
  _thaloFilepath?: string;
  _thaloHasErrors?: boolean;
}

interface ParserOptions {
  filepath?: string;
}

export const parser = {
  parse: async (text: string, options?: ParserOptions): Promise<ThaloRootNode> => {
    const tree = await parseThalo(text);
    const rootNode = tree.rootNode as ThaloRootNode;

    // Attach metadata to root node for printer to access
    rootNode._thaloSource = text;
    rootNode._thaloFilepath = options?.filepath;
    rootNode._thaloHasErrors = tree.rootNode.hasError;

    // Don't throw - let printer handle ERROR nodes gracefully
    return rootNode;
  },
  astFormat: "thalo-ast",
  locStart: (node: SyntaxNode) => node.startIndex,
  locEnd: (node: SyntaxNode) => node.endIndex,
};
