import type { Position, Location } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  findNodeAtPosition,
  findDefinition,
  findEntityDefinition,
  findFieldDefinition,
  findSectionDefinition,
  type Workspace,
  type Position as ThaloPosition,
} from "@rejot-dev/thalo";
import { parseDocument } from "@rejot-dev/thalo/native";

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
 * Handle textDocument/definition request
 *
 * Finds the definition location for various syntax elements at the given position:
 * - ^link-id → Entry definition
 * - Entity name in instance/alter-entity → define-entity
 * - Metadata key → Field definition in schema
 * - Section header → Section definition in schema
 *
 * Supports both standalone .thalo files and thalo blocks embedded in markdown.
 *
 * @param workspace - The thalo workspace
 * @param document - The text document
 * @param position - The position in the document (line/character)
 * @returns The definition location, or null if not found
 */
export function handleDefinition(
  workspace: Workspace,
  document: TextDocument,
  position: Position,
): Location | null {
  const fileType = getFileType(document.uri);

  try {
    // Parse the document
    const parsed = parseDocument(document.getText(), {
      fileType,
      filename: document.uri,
    });

    // Find what element is at the position using the AST
    const context = findNodeAtPosition(parsed, lspToThaloPosition(position));

    switch (context.kind) {
      case "link": {
        // Find the definition for this link
        const result = findDefinition(workspace, context.linkId);
        if (result) {
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
        return null;
      }

      case "entity":
      case "schema_entity": {
        // Find the define-entity for this entity
        const entityName = context.kind === "entity" ? context.entityName : context.entityName;
        const result = findEntityDefinition(workspace, entityName);
        if (result) {
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
        return null;
      }

      case "metadata_key": {
        // Find the field definition in the schema
        const result = findFieldDefinition(workspace, context.key, context.entityContext);
        if (result) {
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
        return null;
      }

      case "section_header": {
        // Find the section definition in the schema
        const result = findSectionDefinition(workspace, context.sectionName, context.entityContext);
        if (result) {
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
        return null;
      }

      case "field_name": {
        // In schema definitions, go to the field definition itself
        const result = findFieldDefinition(workspace, context.fieldName, context.entityContext);
        if (result) {
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
        return null;
      }

      case "section_name": {
        // In schema definitions, go to the section definition itself
        const result = findSectionDefinition(workspace, context.sectionName, context.entityContext);
        if (result) {
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
        return null;
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`[thalo-lsp] Error in definition handler:`, error);
    return null;
  }
}
