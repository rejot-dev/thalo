import type { Position, Location, ReferenceContext } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

// TODO: Import and use @wilco/ptall services
// import { findReferencesAtPosition } from "@wilco/ptall/services";

/**
 * Handle textDocument/references request
 *
 * Finds all references to a ^link-id at the given position.
 *
 * @param document - The text document
 * @param position - The position in the document (line/character)
 * @param context - Reference context (includeDeclaration)
 * @returns Array of reference locations, or null if not found
 *
 * ## Implementation Notes
 *
 * The current @wilco/ptall services use character offsets:
 * - findReferencesAtPosition(workspace, file, offset, includeDefinition)
 *
 * To integrate with LSP, we need to:
 * 1. Convert LSP Position (line/character) to character offset
 * 2. Call the ptall service with context.includeDeclaration
 * 3. Convert each result location to LSP Location
 *
 * The ReferenceContext includes:
 * - includeDeclaration: boolean - whether to include the definition
 */
export function handleReferences(
  document: TextDocument,
  position: Position,
  context: ReferenceContext,
): Location[] | null {
  // Convert LSP position to offset
  const _offset = document.offsetAt(position);
  const _includeDeclaration = context.includeDeclaration;

  // TODO: Implement using @wilco/ptall
  //
  // Steps:
  // 1. Get or create workspace (needs to track all open documents)
  // 2. const result = findReferencesAtPosition(workspace, document.uri, offset, includeDeclaration);
  // 3. if (!result) return null;
  // 4. Convert result.locations to LSP Location array:
  //    return result.locations.map(loc => ({
  //      uri: loc.file,
  //      range: {
  //        start: offsetToPosition(loc.location.startOffset),
  //        end: offsetToPosition(loc.location.endOffset),
  //      },
  //    }));

  console.error(
    `[ptall-lsp] References request at ${position.line}:${position.character} (not implemented)`,
  );
  return null;
}
