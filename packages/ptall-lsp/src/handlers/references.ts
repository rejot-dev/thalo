import type { Position, Location, ReferenceContext } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  findReferencesAtPosition,
  findTagReferences,
  findEntityReferences,
  findFieldReferences,
  findSectionReferences,
  type Workspace,
} from "@rejot-dev/ptall";

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

// ===================
// Position Detection
// ===================

type ReferenceTargetContext =
  | { kind: "link"; linkId: string }
  | { kind: "tag"; tagName: string }
  | { kind: "entity"; entityName: string }
  | { kind: "metadata_key"; key: string; entityContext: string | undefined }
  | { kind: "section_header"; sectionName: string; entityContext: string | undefined };

/**
 * Find entry header (for entity context) by scanning up from a line
 */
function findEntryHeader(
  document: TextDocument,
  lineNumber: number,
): { entity: string; timestamp: string } | null {
  // Look backwards for an entry header
  for (let line = lineNumber; line >= 0; line--) {
    const text = document.getText({
      start: { line, character: 0 },
      end: { line: line + 1, character: 0 },
    });

    // Entry header starts with a timestamp
    const headerMatch = text.match(
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})\s+(create|update|define-entity|alter-entity|define-synthesis|actualize-synthesis)\s+(\S+)/,
    );
    if (headerMatch) {
      const [, timestamp, directive, entity] = headerMatch;
      if (directive === "create" || directive === "update") {
        return { entity, timestamp };
      }
      // For synthesis entries, return synthesis as the entity context
      if (directive === "define-synthesis" || directive === "actualize-synthesis") {
        return { entity: "synthesis", timestamp };
      }
      return { entity, timestamp };
    }
  }

  return null;
}

/**
 * Detect what the cursor is on for reference purposes
 */
function detectReferenceContext(
  document: TextDocument,
  position: Position,
): ReferenceTargetContext | null {
  const line = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  });
  const lineText = line.trimEnd();

  // Check for link (^link-id) at position
  const linkRegex = /\^[A-Za-z0-9\-_/.:]+/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(lineText)) !== null) {
    if (position.character >= match.index && position.character <= match.index + match[0].length) {
      return { kind: "link", linkId: match[0].slice(1) };
    }
  }

  // Check for tag (#tag-name) at position
  const tagRegex = /#[A-Za-z0-9\-_/.]+/g;
  while ((match = tagRegex.exec(lineText)) !== null) {
    if (position.character >= match.index && position.character <= match.index + match[0].length) {
      return { kind: "tag", tagName: match[0].slice(1) };
    }
  }

  // Check for entry header line (timestamp + directive + entity)
  const headerMatch = lineText.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})\s+(create|update)\s+([a-z][a-zA-Z0-9\-_]*)/,
  );
  if (headerMatch) {
    const [fullMatch, , , entityName] = headerMatch;
    // Calculate where the entity name starts
    const entityStart = fullMatch.lastIndexOf(entityName);
    const entityEnd = entityStart + entityName.length;

    if (position.character >= entityStart && position.character <= entityEnd) {
      return { kind: "entity", entityName };
    }
  }

  // Check for define-entity header (find all usages of this entity)
  const defineMatch = lineText.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})\s+define-entity\s+([a-z][a-zA-Z0-9\-_]*)/,
  );
  if (defineMatch) {
    const [fullMatch, , entityName] = defineMatch;
    const entityStart = fullMatch.lastIndexOf(entityName);
    const entityEnd = entityStart + entityName.length;

    if (position.character >= entityStart && position.character <= entityEnd) {
      return { kind: "entity", entityName };
    }
  }

  // Check for alter-entity header (find all usages of this entity)
  const alterMatch = lineText.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})\s+alter-entity\s+([a-z][a-zA-Z0-9\-_]*)/,
  );
  if (alterMatch) {
    const [fullMatch, , entityName] = alterMatch;
    const entityStart = fullMatch.lastIndexOf(entityName);
    const entityEnd = entityStart + entityName.length;

    if (position.character >= entityStart && position.character <= entityEnd) {
      return { kind: "entity", entityName };
    }
  }

  // Check for actualize-synthesis header (link target after directive)
  const actualizeMatch = lineText.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})\s+actualize-synthesis\s+(\^[a-zA-Z0-9\-_]+)/,
  );
  if (actualizeMatch) {
    const [fullMatch, , linkRef] = actualizeMatch;
    const linkStart = fullMatch.lastIndexOf(linkRef);
    const linkEnd = linkStart + linkRef.length;

    if (position.character >= linkStart && position.character <= linkEnd) {
      return { kind: "link", linkId: linkRef.slice(1) };
    }
  }

  // Check for metadata key on indented lines
  const indentMatch = lineText.match(/^(\s+)/);
  if (indentMatch) {
    const indent = indentMatch[1].length;
    const afterIndent = lineText.slice(indent);
    const relativeChar = position.character - indent;

    // Metadata line: key: value
    const metadataMatch = afterIndent.match(/^([a-z][a-zA-Z0-9\-_]*)\s*:/);
    if (metadataMatch && relativeChar >= 0 && relativeChar <= metadataMatch[1].length) {
      const header = findEntryHeader(document, position.line);
      return {
        kind: "metadata_key",
        key: metadataMatch[1],
        entityContext: header?.entity,
      };
    }

    // Section header in content: # SectionName
    const sectionMatch = afterIndent.match(/^#\s*([A-Z][a-zA-Z0-9]*)/);
    if (sectionMatch && relativeChar >= 0) {
      const hashEnd = afterIndent.indexOf(sectionMatch[1]);
      const sectionEnd = hashEnd + sectionMatch[1].length;

      if (relativeChar >= hashEnd && relativeChar <= sectionEnd) {
        const header = findEntryHeader(document, position.line);
        return {
          kind: "section_header",
          sectionName: sectionMatch[1],
          entityContext: header?.entity,
        };
      }
    }
  }

  return null;
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

  // First try context-aware detection
  const refContext = detectReferenceContext(document, position);

  if (refContext) {
    switch (refContext.kind) {
      case "link": {
        // Use existing link references service
        const offset = document.offsetAt(position);
        const result = findReferencesAtPosition(
          workspace,
          path,
          offset,
          context.includeDeclaration,
        );
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
        const result = findTagReferences(workspace, refContext.tagName);
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

      case "entity": {
        // Find all entries using this entity type
        const result = findEntityReferences(
          workspace,
          refContext.entityName,
          context.includeDeclaration,
        );
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
        const result = findFieldReferences(workspace, refContext.key, refContext.entityContext);
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
          refContext.sectionName,
          refContext.entityContext,
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
    }
  }

  // Fallback: try the original link-based lookup
  const offset = document.offsetAt(position);
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
