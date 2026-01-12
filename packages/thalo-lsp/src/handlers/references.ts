import type { Position, Location, ReferenceContext } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  findNodeAtPosition,
  findReferences,
  findTagReferences,
  findEntityReferences,
  findFieldReferences,
  findSectionReferences,
  type Workspace,
  type Position as ThaloPosition,
} from "@rejot-dev/thalo";
import { parseDocument } from "@rejot-dev/thalo/native";

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
 * Handle textDocument/references request
 *
 * Finds all references to various syntax elements at the given position:
 * - ^link-id → All usages of that link
 * - #tag → All entries with that tag
 * - Entity name → All entries using that entity type
 * - Metadata key → All entries using that field
 * - Section header → All entries with that section
 *
 * Supports both standalone .thalo files and thalo blocks embedded in markdown.
 *
 * @param workspace - The thalo workspace
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
  const fileType = getFileType(document.uri);

  try {
    // Parse the document
    const parsed = parseDocument(document.getText(), {
      fileType,
      filename: document.uri,
    });

    // Find what element is at the position using the AST
    const nodeContext = findNodeAtPosition(parsed, lspToThaloPosition(position));

    switch (nodeContext.kind) {
      case "link": {
        // Find all references to this link
        const result = findReferences(workspace, nodeContext.linkId, context.includeDeclaration);
        if (result) {
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
        return null;
      }

      case "tag": {
        // Find all entries with this tag
        const result = findTagReferences(workspace, nodeContext.tagName);
        return result.references.map((ref) => ({
          uri: pathToUri(ref.file),
          range: {
            start: {
              line: ref.location.startPosition.row,
              character: ref.location.startPosition.column,
            },
            end: {
              line: ref.location.endPosition.row,
              character: ref.location.endPosition.column,
            },
          },
        }));
      }

      case "entity":
      case "schema_entity": {
        // Find all entries using this entity type
        const entityName =
          nodeContext.kind === "entity" ? nodeContext.entityName : nodeContext.entityName;
        const result = findEntityReferences(workspace, entityName, context.includeDeclaration);
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

      case "metadata_key": {
        // Find all entries using this field
        const result = findFieldReferences(workspace, nodeContext.key, nodeContext.entityContext);
        const locations: Location[] = [];

        // Include definition if requested
        if (context.includeDeclaration && result.definition) {
          locations.push({
            uri: pathToUri(result.definition.file),
            range: {
              start: {
                line: result.definition.location.startPosition.row,
                character: result.definition.location.startPosition.column,
              },
              end: {
                line: result.definition.location.endPosition.row,
                character: result.definition.location.endPosition.column,
              },
            },
          });
        }

        // Add all references
        for (const ref of result.references) {
          locations.push({
            uri: pathToUri(ref.file),
            range: {
              start: {
                line: ref.location.startPosition.row,
                character: ref.location.startPosition.column,
              },
              end: {
                line: ref.location.endPosition.row,
                character: ref.location.endPosition.column,
              },
            },
          });
        }

        return locations;
      }

      case "section_header": {
        // Find all entries with this section
        const result = findSectionReferences(
          workspace,
          nodeContext.sectionName,
          nodeContext.entityContext,
        );
        const locations: Location[] = [];

        // Include definition if requested
        if (context.includeDeclaration && result.definition) {
          locations.push({
            uri: pathToUri(result.definition.file),
            range: {
              start: {
                line: result.definition.location.startPosition.row,
                character: result.definition.location.startPosition.column,
              },
              end: {
                line: result.definition.location.endPosition.row,
                character: result.definition.location.endPosition.column,
              },
            },
          });
        }

        // Add all references
        for (const ref of result.references) {
          locations.push({
            uri: pathToUri(ref.file),
            range: {
              start: {
                line: ref.location.startPosition.row,
                character: ref.location.startPosition.column,
              },
              end: {
                line: ref.location.endPosition.row,
                character: ref.location.endPosition.column,
              },
            },
          });
        }

        return locations;
      }

      case "field_name": {
        // In schema definitions, find all usages of this field
        const result = findFieldReferences(
          workspace,
          nodeContext.fieldName,
          nodeContext.entityContext,
        );
        const locations: Location[] = [];

        // Include definition if requested
        if (context.includeDeclaration && result.definition) {
          locations.push({
            uri: pathToUri(result.definition.file),
            range: {
              start: {
                line: result.definition.location.startPosition.row,
                character: result.definition.location.startPosition.column,
              },
              end: {
                line: result.definition.location.endPosition.row,
                character: result.definition.location.endPosition.column,
              },
            },
          });
        }

        for (const ref of result.references) {
          locations.push({
            uri: pathToUri(ref.file),
            range: {
              start: {
                line: ref.location.startPosition.row,
                character: ref.location.startPosition.column,
              },
              end: {
                line: ref.location.endPosition.row,
                character: ref.location.endPosition.column,
              },
            },
          });
        }

        return locations;
      }

      case "section_name": {
        // In schema definitions, find all usages of this section
        const result = findSectionReferences(
          workspace,
          nodeContext.sectionName,
          nodeContext.entityContext,
        );
        const locations: Location[] = [];

        // Include definition if requested
        if (context.includeDeclaration && result.definition) {
          locations.push({
            uri: pathToUri(result.definition.file),
            range: {
              start: {
                line: result.definition.location.startPosition.row,
                character: result.definition.location.startPosition.column,
              },
              end: {
                line: result.definition.location.endPosition.row,
                character: result.definition.location.endPosition.column,
              },
            },
          });
        }

        for (const ref of result.references) {
          locations.push({
            uri: pathToUri(ref.file),
            range: {
              start: {
                line: ref.location.startPosition.row,
                character: ref.location.startPosition.column,
              },
              end: {
                line: ref.location.endPosition.row,
                character: ref.location.endPosition.column,
              },
            },
          });
        }

        return locations;
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`[thalo-lsp] Error in references handler:`, error);
    return null;
  }
}
