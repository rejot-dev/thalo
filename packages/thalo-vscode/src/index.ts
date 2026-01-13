import { spawn } from "node:child_process";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

/**
 * Get the CLI path from configuration or use default
 */
function getCliPath(): string {
  const config = vscode.workspace.getConfiguration("thalo");
  const configuredPath = config.get<string>("cliPath");

  if (configuredPath && configuredPath.trim() !== "") {
    return configuredPath;
  }

  // Default: assume thalo is in PATH
  return "thalo";
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const cliPath = getCliPath();

  // Verify CLI is available
  const cliAvailable = await checkCliAvailable(cliPath);
  if (!cliAvailable) {
    vscode.window.showWarningMessage(
      `Thalo CLI not found at "${cliPath}". Install with: npm install -g @rejot-dev/thalo-cli\n` +
        `Or configure the path in settings: thalo.cliPath`,
    );
    // Continue anyway - user might install it later
  }

  // Start the Language Server
  try {
    client = await startLanguageServer(context, cliPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to start Thalo language server: ${message}`);
  }

  // Register the formatter (uses CLI)
  const formatter = vscode.languages.registerDocumentFormattingEditProvider("thalo", {
    async provideDocumentFormattingEdits(
      document: vscode.TextDocument,
    ): Promise<vscode.TextEdit[]> {
      const currentCliPath = getCliPath();
      const text = document.getText();

      try {
        const formatted = await formatWithCli(currentCliPath, text);

        if (formatted === text) {
          return [];
        }

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

  // Register command to restart the language server
  const restartCommand = vscode.commands.registerCommand("thalo.restartServer", async () => {
    const oldClient = client;

    try {
      if (oldClient) {
        await oldClient.stop();
      }

      const newCliPath = getCliPath();
      const newClient = await startLanguageServer(context, newCliPath);

      // Only reassign after successful start
      client = newClient;
      vscode.window.showInformationMessage("Thalo language server restarted");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to restart Thalo language server: ${message}`);

      // Attempt to restore the old client if it exists
      if (oldClient) {
        try {
          await oldClient.start();
          client = oldClient;
        } catch {
          // Old client couldn't be restarted, leave client in undefined state
          client = undefined;
        }
      }
    }
  });

  context.subscriptions.push(restartCommand);
}

/**
 * Check if the CLI is available
 */
async function checkCliAvailable(cliPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cliPath, ["--version"], {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Format text using the CLI
 */
async function formatWithCli(cliPath: string, text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cliPath, ["format", "--stdin"], {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to run thalo format: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `thalo format exited with code ${code}`));
      }
    });

    // Write input and close stdin
    proc.stdin.write(text);
    proc.stdin.end();
  });
}

async function startLanguageServer(
  context: vscode.ExtensionContext,
  cliPath: string,
): Promise<LanguageClient> {
  // Use the CLI as the server command
  const serverOptions: ServerOptions = {
    run: {
      command: cliPath,
      args: ["lsp"],
      transport: TransportKind.stdio,
    },
    debug: {
      command: cliPath,
      args: ["lsp"],
      transport: TransportKind.stdio,
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

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
  }
}
