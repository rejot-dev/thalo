import type { ServerCapabilities, SemanticTokensLegend } from "vscode-languageserver";
import { tokenTypes, tokenModifiers } from "@rejot-dev/thalo";

/**
 * File operation filter type for LSP file operations.
 * Describes which files the server is interested in for file operation notifications.
 */
interface FileOperationFilter {
  scheme?: string;
  pattern: { glob: string };
}

/**
 * File operation filters for thalo and markdown files
 */
export const thaloFileFilters: FileOperationFilter[] = [
  { scheme: "file", pattern: { glob: "**/*.thalo" } },
  { scheme: "file", pattern: { glob: "**/*.md" } },
];

/**
 * Semantic tokens legend for LSP
 * Maps the token types and modifiers from @rejot-dev/thalo
 */
export const tokenLegend: SemanticTokensLegend = {
  tokenTypes: [...tokenTypes],
  tokenModifiers: [...tokenModifiers],
};

/**
 * LSP server capabilities for thalo
 *
 * Defines which LSP features are supported by this server.
 */
export const serverCapabilities: ServerCapabilities = {
  // Document sync - full document sync for simplicity
  textDocumentSync: {
    openClose: true,
    change: 2, // Full sync
    save: {
      includeText: true,
    },
  },

  // Go to Definition - navigate to ^link-id definitions
  definitionProvider: true,

  // Find All References - find all usages of a ^link-id
  referencesProvider: true,

  // Hover - show link target details
  hoverProvider: true,

  // Completions - suggest ^link-ids and #tags
  completionProvider: {
    triggerCharacters: ["^", "#"],
    resolveProvider: true,
  },

  // Semantic tokens - syntax highlighting based on semantics
  semanticTokensProvider: {
    legend: tokenLegend,
    full: true,
    range: false,
  },

  // Workspace features - file operations for cross-file updates
  workspace: {
    fileOperations: {
      didCreate: { filters: thaloFileFilters },
      didDelete: { filters: thaloFileFilters },
      didRename: { filters: thaloFileFilters },
    },
  },
};
