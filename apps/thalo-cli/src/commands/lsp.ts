import {
  createConnection as createLspConnection,
  ProposedFeatures,
} from "vscode-languageserver/node.js";
import { startServer } from "@rejot-dev/thalo-lsp";
import type { CommandDef } from "../cli.js";

/**
 * LSP command - starts the Language Server Protocol server
 *
 * This is used by editors (VS Code, etc.) to provide language features.
 * Communication happens over stdio.
 */
export const lspCommand: CommandDef = {
  name: "lsp",
  description: "Start the Language Server Protocol server (for editor integration)",
  options: {
    stdio: {
      type: "boolean",
      description: "Use stdio transport (default, accepted for compatibility)",
      default: false,
    },
  },
  action: () => {
    // Create connection explicitly with stdio streams
    // Note: --stdio is accepted for compatibility with vscode-languageclient but is always the default
    const connection = createLspConnection(ProposedFeatures.all, process.stdin, process.stdout);
    startServer(connection);
  },
};
