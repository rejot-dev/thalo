import * as path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Start the Language Server
  client = await startLanguageServer(context);

  // Register the Prettier-based formatter
  const formatter = vscode.languages.registerDocumentFormattingEditProvider("thalo", {
    async provideDocumentFormattingEdits(
      document: vscode.TextDocument,
    ): Promise<vscode.TextEdit[]> {
      const text = document.getText();

      try {
        // Dynamic import for ESM modules
        const prettier = await import("prettier");
        const thaloPrettier = await import("@rejot-dev/thalo-prettier");

        const formatted = await prettier.format(text, {
          parser: "thalo",
          plugins: [thaloPrettier],
        });

        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(text.length),
        );

        return [vscode.TextEdit.replace(fullRange, formatted)];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Thalo formatting failed: ${message}`);
        return [];
      }
    },
  });

  context.subscriptions.push(formatter);
}

async function startLanguageServer(context: vscode.ExtensionContext): Promise<LanguageClient> {
  // Resolve the server module path from @rejot-dev/thalo-lsp
  const serverModule = resolveServerPath();

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.stdio,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "thalo" },
      { scheme: "untitled", language: "thalo" },
      // Enable LSP features for thalo blocks embedded in markdown files
      { scheme: "file", language: "markdown" },
    ],
    synchronize: {
      // Watch for file changes in thalo and markdown files (for cross-file features)
      fileEvents: [
        vscode.workspace.createFileSystemWatcher("**/*.thalo"),
        vscode.workspace.createFileSystemWatcher("**/*.md"),
      ],
    },
  };

  const client = new LanguageClient("thalo", "Thalo Language Server", serverOptions, clientOptions);

  // Start the client (also launches the server)
  await client.start();

  context.subscriptions.push({
    dispose: () => client.stop(),
  });

  return client;
}

/**
 * Resolve the path to the LSP server module.
 * We require the @rejot-dev/thalo-lsp package and get the path to server.js
 */
function resolveServerPath(): string {
  // require.resolve finds the package entry point, we need the server.js instead
  const lspPackagePath = require.resolve("@rejot-dev/thalo-lsp");
  // The package exports index.js, but we need server.js in the same dist folder
  return path.join(path.dirname(lspPackagePath), "server.js");
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
  }
}
