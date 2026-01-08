import type { Diagnostic as LspDiagnostic, DiagnosticSeverity } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  checkDocument,
  type Workspace,
  type Diagnostic as PtallDiagnostic,
  type Severity,
} from "@rejot-dev/ptall";

/**
 * Map ptall severity to LSP DiagnosticSeverity
 */
function mapSeverity(severity: Severity): DiagnosticSeverity {
  switch (severity) {
    case "error":
      return 1; // DiagnosticSeverity.Error
    case "warning":
      return 2; // DiagnosticSeverity.Warning
    case "info":
      return 3; // DiagnosticSeverity.Information
    default:
      return 3;
  }
}

/**
 * Convert a URI to a file path
 */
function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return decodeURIComponent(uri.slice(7));
  }
  return uri;
}

/**
 * Convert a ptall Diagnostic to an LSP Diagnostic
 */
function convertDiagnostic(diagnostic: PtallDiagnostic): LspDiagnostic {
  return {
    range: {
      start: {
        line: diagnostic.location.startPosition.row,
        character: diagnostic.location.startPosition.column,
      },
      end: {
        line: diagnostic.location.endPosition.row,
        character: diagnostic.location.endPosition.column,
      },
    },
    severity: mapSeverity(diagnostic.severity),
    code: diagnostic.code,
    source: "ptall",
    message: diagnostic.message,
  };
}

/**
 * Get diagnostics for a document
 *
 * @param workspace - The ptall workspace
 * @param textDocument - The LSP text document
 * @returns Array of LSP diagnostics
 */
export function getDiagnostics(workspace: Workspace, textDocument: TextDocument): LspDiagnostic[] {
  const path = uriToPath(textDocument.uri);
  const document = workspace.getDocument(path);

  if (!document) {
    return [];
  }

  try {
    const ptallDiagnostics = checkDocument(document, workspace);
    return ptallDiagnostics.map(convertDiagnostic);
  } catch (error) {
    // Return a diagnostic for parse errors
    console.error(`[ptall-lsp] Error checking ${path}:`, error);
    return [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        severity: 1, // Error
        source: "ptall",
        message: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }
}
