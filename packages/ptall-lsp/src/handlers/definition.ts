import type { Position, Location } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  findDefinitionAtPosition,
  findEntityDefinition,
  findFieldDefinition,
  findSectionDefinition,
  type Workspace,
} from "@rejot-dev/ptall";

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

// ===================
// Position Detection
// ===================

type DefinitionContext =
  | { kind: "link"; linkId: string }
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
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))\s+(create|update|define-entity|alter-entity|define-synthesis|actualize-synthesis)\s+(\S+)/,
    );
    if (headerMatch) {
      const [, timestamp, directive, entity] = headerMatch;
      if (directive === "create" || directive === "update") {
        return { entity, timestamp };
      }
      // For schema entries, entity is the entityName being defined
      // For synthesis entries, entity is the title/link - we return null for entity context
      if (directive === "define-synthesis" || directive === "actualize-synthesis") {
        return { entity: "synthesis", timestamp };
      }
      return { entity, timestamp };
    }

    // Stop if we hit an empty line (start of entry) or are past reasonable content
    if (text.trim() === "" && line < lineNumber - 1) {
      // Keep going - entries can have blank lines
    }
  }

  return null;
}

/**
 * Detect what the cursor is on for definition purposes
 */
function detectDefinitionContext(
  document: TextDocument,
  position: Position,
): DefinitionContext | null {
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

  // Check for entry header line (timestamp + directive + entity)
  const headerMatch = lineText.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))\s+(create|update)\s+([a-z][a-zA-Z0-9\-_]*)/,
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

  // Check for alter-entity header (go to define-entity)
  const alterMatch = lineText.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))\s+alter-entity\s+([a-z][a-zA-Z0-9\-_]*)/,
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
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))\s+actualize-synthesis\s+(\^[a-zA-Z0-9\-_]+)/,
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
      // Check if cursor is on the section name
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
 * Handle textDocument/definition request
 *
 * Finds the definition location for various syntax elements at the given position:
 * - ^link-id → Entry definition
 * - Entity name in instance/alter-entity → define-entity
 * - Metadata key → Field definition in schema
 * - Section header → Section definition in schema
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

  // First try the context-aware detection
  const context = detectDefinitionContext(document, position);

  if (context) {
    switch (context.kind) {
      case "link": {
        // Use existing link definition service
        const offset = document.offsetAt(position);
        const result = findDefinitionAtPosition(workspace, path, offset);
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

      case "entity": {
        // Find the define-entity for this entity
        const result = findEntityDefinition(workspace, context.entityName);
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
    }
  }

  // Fallback: try the original link-based lookup
  const offset = document.offsetAt(position);
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
