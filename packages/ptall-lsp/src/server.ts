import {
  createConnection as createLspConnection,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  type Connection,
  DidChangeConfigurationNotification,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Workspace, type FileType } from "@wilco/ptall";

import { serverCapabilities, tokenLegend } from "./capabilities.js";
import { handleDefinition } from "./handlers/definition.js";
import { handleReferences } from "./handlers/references.js";
import { handleSemanticTokens } from "./handlers/semantic-tokens.js";
import { getDiagnostics } from "./handlers/diagnostics.js";
import { handleHover } from "./handlers/hover.js";
import { handleCompletion, handleCompletionResolve } from "./handlers/completions.js";

/**
 * Server state
 */
interface ServerState {
  /** The ptall workspace for cross-file features */
  workspace: Workspace;
  /** Text documents managed by the server */
  documents: Map<string, TextDocument>;
  /** The LSP connection */
  connection: Connection;
}

/**
 * Create the initial server state
 */
function createServerState(connection: Connection): ServerState {
  return {
    workspace: new Workspace(),
    documents: new Map(),
    connection,
  };
}

/**
 * Get the file type from a URI
 */
function getFileType(uri: string): FileType {
  if (uri.endsWith(".ptall")) {
    return "ptall";
  }
  if (uri.endsWith(".md")) {
    return "markdown";
  }
  // Default to ptall
  return "ptall";
}

/**
 * Convert a URI to a file path
 */
function uriToPath(uri: string): string {
  // Remove file:// prefix
  if (uri.startsWith("file://")) {
    return decodeURIComponent(uri.slice(7));
  }
  return uri;
}

/**
 * Update a document in the workspace and publish diagnostics
 */
function updateDocument(state: ServerState, doc: TextDocument): void {
  const path = uriToPath(doc.uri);
  const fileType = getFileType(doc.uri);

  try {
    state.workspace.addDocument(doc.getText(), {
      filename: path,
      fileType,
    });

    // Publish diagnostics after successful parse
    const diagnostics = getDiagnostics(state.workspace, doc);
    state.connection.sendDiagnostics({
      uri: doc.uri,
      diagnostics,
    });
  } catch (error) {
    // Log parse errors but don't crash
    console.error(`[ptall-lsp] Parse error in ${path}:`, error);

    // Send a parse error diagnostic
    state.connection.sendDiagnostics({
      uri: doc.uri,
      diagnostics: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
          severity: 1, // Error
          source: "ptall",
          message: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    });
  }
}

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
  const state = createServerState(connection);

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

    // Register for configuration changes
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  });

  // Document lifecycle
  connection.onDidOpenTextDocument((params) => {
    const doc = TextDocument.create(
      params.textDocument.uri,
      params.textDocument.languageId,
      params.textDocument.version,
      params.textDocument.text,
    );
    state.documents.set(params.textDocument.uri, doc);
    updateDocument(state, doc);

    console.error(`[ptall-lsp] Opened: ${params.textDocument.uri}`);
  });

  connection.onDidChangeTextDocument((params) => {
    const doc = state.documents.get(params.textDocument.uri);
    if (doc) {
      const updated = TextDocument.update(doc, params.contentChanges, params.textDocument.version);
      state.documents.set(params.textDocument.uri, updated);
      updateDocument(state, updated);
    }
  });

  connection.onDidCloseTextDocument((params) => {
    state.documents.delete(params.textDocument.uri);
    const path = uriToPath(params.textDocument.uri);
    state.workspace.removeDocument(path);

    // Clear diagnostics for closed document
    connection.sendDiagnostics({
      uri: params.textDocument.uri,
      diagnostics: [],
    });

    console.error(`[ptall-lsp] Closed: ${params.textDocument.uri}`);
  });

  // Go to Definition
  connection.onDefinition((params) => {
    const doc = state.documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    return handleDefinition(state.workspace, doc, params.position);
  });

  // Find All References
  connection.onReferences((params) => {
    const doc = state.documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    return handleReferences(state.workspace, doc, params.position, params.context);
  });

  // Hover
  connection.onHover((params) => {
    const doc = state.documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    return handleHover(state.workspace, doc, params.position);
  });

  // Completion
  connection.onCompletion((params) => {
    const doc = state.documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    return handleCompletion(state.workspace, doc, params);
  });

  // Completion resolve
  connection.onCompletionResolve((item) => {
    return handleCompletionResolve(item);
  });

  // Semantic Tokens (full)
  connection.onRequest("textDocument/semanticTokens/full", (params) => {
    const doc = state.documents.get(params.textDocument.uri);
    if (!doc) {
      return { data: [] };
    }

    return handleSemanticTokens(doc);
  });

  // Start listening
  connection.listen();
  console.error("[ptall-lsp] Server started");
}

// Run server when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

// Export for testing
export { tokenLegend };
