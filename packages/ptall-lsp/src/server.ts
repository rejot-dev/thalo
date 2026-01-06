import * as fs from "node:fs";
import * as path from "node:path";
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
import { handleCompletion, handleCompletionResolve } from "./handlers/completions/index.js";

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
  /** Workspace folder paths (file system paths, not URIs) */
  workspaceFolders: string[];
}

/**
 * Create the initial server state
 */
function createServerState(connection: Connection): ServerState {
  return {
    workspace: new Workspace(),
    documents: new Map(),
    connection,
    workspaceFolders: [],
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
 * Collect all .ptall and .md files from a directory recursively
 */
function collectPtallFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".ptall") || entry.name.endsWith(".md")) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Load all ptall files from the workspace folders into the workspace.
 * This ensures cross-file features work correctly even for files not yet opened.
 */
function loadWorkspaceFiles(state: ServerState): void {
  for (const folder of state.workspaceFolders) {
    const files = collectPtallFiles(folder);

    for (const file of files) {
      // Skip if already loaded (e.g., from an open document)
      if (state.workspace.getDocument(file)) {
        continue;
      }

      try {
        const source = fs.readFileSync(file, "utf-8");
        const fileType = getFileType(file);
        state.workspace.addDocument(source, { filename: file, fileType });
      } catch (err) {
        console.error(
          `[ptall-lsp] Error loading ${file}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    console.error(`[ptall-lsp] Loaded ${files.length} files from ${folder}`);
  }
}

/**
 * Publish diagnostics for a single document
 */
function publishDiagnosticsForDocument(state: ServerState, doc: TextDocument): void {
  try {
    const diagnostics = getDiagnostics(state.workspace, doc);
    state.connection.sendDiagnostics({
      uri: doc.uri,
      diagnostics,
    });
  } catch (error) {
    const path = uriToPath(doc.uri);
    console.error(`[ptall-lsp] Error getting diagnostics for ${path}:`, error);
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
          message: `Diagnostic error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    });
  }
}

/**
 * Refresh diagnostics for all open documents.
 * This is needed because changes in one file (e.g., removing a define-entity)
 * can affect diagnostics in other files that depend on it.
 */
function refreshAllDiagnostics(state: ServerState): void {
  for (const doc of state.documents.values()) {
    publishDiagnosticsForDocument(state, doc);
  }
}

/**
 * Update a document in the workspace and publish diagnostics for all open documents
 */
function updateDocument(state: ServerState, doc: TextDocument): void {
  const path = uriToPath(doc.uri);
  const fileType = getFileType(doc.uri);

  try {
    state.workspace.addDocument(doc.getText(), {
      filename: path,
      fileType,
    });

    // Refresh diagnostics for all open documents since changes in one file
    // can affect diagnostics in other files (e.g., entity definitions, links)
    refreshAllDiagnostics(state);
  } catch (error) {
    // Log parse errors but don't crash
    console.error(`[ptall-lsp] Parse error in ${path}:`, error);

    // Send a parse error diagnostic for the changed document
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

    // Store workspace folders for later file scanning
    if (params.workspaceFolders) {
      state.workspaceFolders = params.workspaceFolders.map((folder) => uriToPath(folder.uri));
    } else if (params.rootUri) {
      state.workspaceFolders = [uriToPath(params.rootUri)];
    }

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

    // Load all workspace files for cross-file features (entity definitions, links, etc.)
    loadWorkspaceFiles(state);
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
    const filePath = uriToPath(params.textDocument.uri);

    // Reload from disk to pick up saved changes and keep cross-file features working
    try {
      if (fs.existsSync(filePath)) {
        const source = fs.readFileSync(filePath, "utf-8");
        const fileType = getFileType(params.textDocument.uri);
        state.workspace.addDocument(source, { filename: filePath, fileType });
      } else {
        // File was deleted, remove from workspace
        state.workspace.removeDocument(filePath);
      }
    } catch {
      // If we can't read the file, remove it from the workspace
      state.workspace.removeDocument(filePath);
    }

    // Clear diagnostics for closed document (not actively editing it)
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
