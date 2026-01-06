import type { ServerCapabilities } from "vscode-languageserver";

/**
 * LSP server capabilities for ptall
 *
 * Defines which LSP features are supported by this server.
 */
export const serverCapabilities: ServerCapabilities = {
  // Document sync - full document sync for now
  textDocumentSync: {
    openClose: true,
    change: 2, // Full sync
    save: {
      includeText: true,
    },
  },

  // Go to Definition
  // TODO: Implement - requires adapting findDefinition/findDefinitionAtPosition
  // to work with LSP's Position (line/character) instead of offset
  definitionProvider: true,

  // Find All References
  // TODO: Implement - requires adapting findReferences/findReferencesAtPosition
  // to work with LSP's Position (line/character) instead of offset
  referencesProvider: true,

  // Hover information
  // TODO: Implement - show details about link target on hover
  hoverProvider: false,

  // Completions
  // TODO: Implement - suggest ^link-ids from workspace
  completionProvider: undefined,

  // Diagnostics are pushed, not pulled
  // Implemented via textDocument/publishDiagnostics notifications
};
