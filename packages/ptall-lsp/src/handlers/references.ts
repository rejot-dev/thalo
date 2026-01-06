import type { Position, Location, ReferenceContext } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { findReferencesAtPosition, type Workspace } from "@wilco/ptall";

/**
 * Convert a file path to a URI
 */
function pathToUri(path: string): string {
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
 * Handle textDocument/references request
 *
 * Finds all references to a ^link-id at the given position.
 *
 * @param workspace - The ptall workspace
 * @param document - The text document
 * @param position - The position in the document (line/character)
 * @param context - Reference context (includeDeclaration)
 * @returns Array of reference locations, or null if not found
 */
export function handleReferences(
  workspace: Workspace,
  document: TextDocument,
  position: Position,
  context: ReferenceContext,
): Location[] | null {
  const path = uriToPath(document.uri);

  // Convert LSP Position to character offset
  const offset = document.offsetAt(position);

  // Use ptall service to find references
  const result = findReferencesAtPosition(workspace, path, offset, context.includeDeclaration);

  if (!result) {
    return null;
  }

  // Convert ptall locations to LSP locations
  return result.locations.map((loc) => ({
    uri: pathToUri(loc.file),
    range: {
      start: {
        line: loc.location.startPosition.row,
        character: loc.location.startPosition.column,
      },
      end: {
        line: loc.location.endPosition.row,
        character: loc.location.endPosition.column,
      },
    },
  }));
}
