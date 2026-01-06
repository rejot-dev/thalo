import {
  createConnection as createLspConnection,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  type Connection,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

import { serverCapabilities } from "./capabilities.js";
import { handleDefinition } from "./handlers/definition.js";
import { handleReferences } from "./handlers/references.js";

/**
 * Documents managed by the server
 */
const documents = new Map<string, TextDocument>();

/**
 * Create a new LSP connection
 */
export function createConnection(): Connection {
  return createLspConnection(ProposedFeatures.all);
}

/**
 * Start the LSP server
 *
 * @param connection - The LSP connection to use (defaults to stdio)
 */
export function startServer(connection: Connection = createConnection()): void {
  // Initialize handler
  connection.onInitialize((params: InitializeParams): InitializeResult => {
    console.error(`[ptall-lsp] Initializing with workspace: ${params.workspaceFolders?.[0]?.uri}`);

    return {
      capabilities: serverCapabilities,
      serverInfo: {
        name: "ptall-lsp",
        version: "0.0.0",
      },
    };
  });

  connection.onInitialized(() => {
    console.error("[ptall-lsp] Server initialized");
  });

  // Document lifecycle
  connection.onDidOpenTextDocument((params) => {
    const doc = TextDocument.create(
      params.textDocument.uri,
      params.textDocument.languageId,
      params.textDocument.version,
      params.textDocument.text,
    );
    documents.set(params.textDocument.uri, doc);
    console.error(`[ptall-lsp] Opened: ${params.textDocument.uri}`);

    // TODO: Parse document and publish diagnostics
  });

  connection.onDidChangeTextDocument((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (doc) {
      const updated = TextDocument.update(doc, params.contentChanges, params.textDocument.version);
      documents.set(params.textDocument.uri, updated);

      // TODO: Re-parse and publish diagnostics
    }
  });

  connection.onDidCloseTextDocument((params) => {
    documents.delete(params.textDocument.uri);
    console.error(`[ptall-lsp] Closed: ${params.textDocument.uri}`);
  });

  // Feature handlers
  connection.onDefinition((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    return handleDefinition(doc, params.position);
  });

  connection.onReferences((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    return handleReferences(doc, params.position, params.context);
  });

  // Start listening
  connection.listen();
  console.error("[ptall-lsp] Server started");
}

// Run server when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
