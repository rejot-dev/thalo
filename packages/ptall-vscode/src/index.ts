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
  const formatter = vscode.languages.registerDocumentFormattingEditProvider("ptall", {
    async provideDocumentFormattingEdits(
      document: vscode.TextDocument,
    ): Promise<vscode.TextEdit[]> {
      const text = document.getText();

      try {
        // Dynamic import for ESM modules
        const prettier = await import("prettier");
        const ptallPrettier = await import("@wilco/ptall-prettier");

        const formatted = await prettier.format(text, {
          parser: "ptall",
          plugins: [ptallPrettier],
        });

        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(text.length),
        );

        return [vscode.TextEdit.replace(fullRange, formatted)];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Ptall formatting failed: ${message}`);
        return [];
      }
    },
  });

  context.subscriptions.push(formatter);
}

async function startLanguageServer(context: vscode.ExtensionContext): Promise<LanguageClient> {
  // Resolve the server module path from @wilco/ptall-lsp
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
    documentSelector: [{ scheme: "file", language: "ptall" }],
    synchronize: {
      // Watch for file changes in ptall and markdown files (for cross-file features)
      fileEvents: [
        vscode.workspace.createFileSystemWatcher("**/*.ptall"),
        vscode.workspace.createFileSystemWatcher("**/*.md"),
      ],
    },
  };

  const client = new LanguageClient("ptall", "Ptall Language Server", serverOptions, clientOptions);

  // Start the client (also launches the server)
  await client.start();

  context.subscriptions.push({
    dispose: () => client.stop(),
  });

  return client;
}

/**
 * Resolve the path to the LSP server module.
 * We require the @wilco/ptall-lsp package and get the path to server.js
 */
function resolveServerPath(): string {
  // require.resolve finds the package entry point, we need the server.js instead
  const lspPackagePath = require.resolve("@wilco/ptall-lsp");
  // The package exports index.js, but we need server.js in the same dist folder
  return path.join(path.dirname(lspPackagePath), "server.js");
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
  }
}
