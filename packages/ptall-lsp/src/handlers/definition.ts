import type { Position, Location } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

// TODO: Import and use @wilco/ptall services
// import { findDefinitionAtPosition } from "@wilco/ptall/services";

/**
 * Handle textDocument/definition request
 *
 * Finds the definition location for a ^link-id at the given position.
 *
 * @param document - The text document
 * @param position - The position in the document (line/character)
 * @returns The definition location, or null if not found
 *
 * ## Implementation Notes
 *
 * The current @wilco/ptall services use character offsets:
 * - findDefinitionAtPosition(workspace, file, offset)
 *
 * To integrate with LSP, we need to:
 * 1. Convert LSP Position (line/character) to character offset
 * 2. Call the ptall service
 * 3. Convert the result Location (startOffset/endOffset) back to LSP Location
 *
 * Additionally, the ptall services require a Workspace object that tracks
 * all documents and their link definitions/references. We need to:
 * - Create/maintain a Workspace instance
 * - Update it when documents are opened/changed/closed
 * - Use it for cross-file lookups
 */
export function handleDefinition(document: TextDocument, position: Position): Location | null {
  // Convert LSP position to offset
  const _offset = document.offsetAt(position);

  // TODO: Implement using @wilco/ptall
  //
  // Steps:
  // 1. Get or create workspace (needs to track all open documents)
  // 2. const result = findDefinitionAtPosition(workspace, document.uri, offset);
  // 3. if (!result) return null;
  // 4. Convert result.location to LSP Location:
  //    return {
  //      uri: result.file,
  //      range: {
  //        start: offsetToPosition(result.location.startOffset),
  //        end: offsetToPosition(result.location.endOffset),
  //      },
  //    };

  console.error(
    `[ptall-lsp] Definition request at ${position.line}:${position.character} (not implemented)`,
  );
  return null;
}
