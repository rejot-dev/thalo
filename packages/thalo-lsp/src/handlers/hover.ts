import type { Hover, Position } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  parseDocument,
  findNodeAtPosition,
  getHoverInfo,
  type Workspace,
  type Position as ThaloPosition,
} from "@rejot-dev/thalo";

/**
 * Get the file type from a URI
 */
function getFileType(uri: string): "thalo" | "markdown" {
  if (uri.endsWith(".thalo")) {
    return "thalo";
  }
  if (uri.endsWith(".md")) {
    return "markdown";
  }
  return "thalo";
}

/**
 * Convert LSP Position to thalo Position (both are 0-based).
 */
function lspToThaloPosition(pos: Position): ThaloPosition {
  return { line: pos.line, column: pos.character };
}

/**
 * Handle textDocument/hover request
 *
 * Provides hover information for various syntax elements:
 * - ^link-id: Shows target entry details
 * - #tag: Shows tag usage statistics
 * - Directives: Shows documentation
 * - Entity names: Shows schema with fields and sections
 * - Metadata keys: Shows field type and description
 * - Type expressions: Shows type documentation
 * - Section headers: Shows section description
 * - Timestamps: Shows entry info or link reference hint
 *
 * Supports both standalone .thalo files and thalo blocks embedded in markdown.
 *
 * @param workspace - The thalo workspace
 * @param document - The text document
 * @param position - The hover position
 * @returns Hover information, or null if nothing to show
 */
export function handleHover(
  workspace: Workspace,
  document: TextDocument,
  position: Position,
): Hover | null {
  const fileType = getFileType(document.uri);

  try {
    // Parse the document
    const parsed = parseDocument(document.getText(), {
      fileType,
      filename: document.uri,
    });

    // Find what element is at the position using the AST
    const context = findNodeAtPosition(parsed, lspToThaloPosition(position));

    // Get hover info from the service
    const result = getHoverInfo(workspace, context);

    if (!result) {
      return null;
    }

    // Convert to LSP Hover format
    const hover: Hover = {
      contents: {
        kind: "markdown",
        value: result.content,
      },
    };

    // Add range if available
    if (result.range) {
      hover.range = {
        start: {
          line: result.range.startPosition.row,
          character: result.range.startPosition.column,
        },
        end: {
          line: result.range.endPosition.row,
          character: result.range.endPosition.column,
        },
      };
    }

    return hover;
  } catch (error) {
    console.error(`[thalo-lsp] Error in hover handler:`, error);
    return null;
  }
}
