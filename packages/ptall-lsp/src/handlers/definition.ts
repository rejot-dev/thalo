import type { Position, Location } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { findDefinitionAtPosition, type Workspace } from "@wilco/ptall";

/**
 * Convert a file path to a URI
 */
function pathToUri(path: string): string {
  // Add file:// prefix if not present
  if (!path.startsWith("file://")) {
    return `file://${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  }
  return path;
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
 * Handle textDocument/definition request
 *
 * Finds the definition location for a ^link-id at the given position.
 *
 * @param workspace - The ptall workspace
 * @param document - The text document
 * @param position - The position in the document (line/character)
 * @returns The definition location, or null if not found
 */
export function handleDefinition(
  workspace: Workspace,
  document: TextDocument,
  position: Position,
): Location | null {
  const path = uriToPath(document.uri);

  // Convert LSP Position (line/character) to character offset
  const offset = document.offsetAt(position);

  // Use ptall service to find definition
  const result = findDefinitionAtPosition(workspace, path, offset);

  if (!result) {
    return null;
  }

  // Convert ptall Location to LSP Location
  return {
    uri: pathToUri(result.file),
    range: {
      start: {
        line: result.location.startPosition.row,
        character: result.location.startPosition.column,
      },
      end: {
        line: result.location.endPosition.row,
        character: result.location.endPosition.column,
      },
    },
  };
}
