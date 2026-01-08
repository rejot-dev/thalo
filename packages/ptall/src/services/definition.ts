import type { Workspace } from "../model/workspace.js";
import type { Location } from "../ast/types.js";
import type { LinkDefinition } from "../model/types.js";
import { toFileLocation } from "../source-map.js";

/**
 * Result of a find-definition query
 */
export interface DefinitionResult {
  /** The file containing the definition */
  file: string;
  /** Location of the definition (file-absolute) */
  location: Location;
  /** The link definition details */
  definition: LinkDefinition;
}

/**
 * Find the definition for a link ID
 *
 * @param workspace - The workspace to search in
 * @param linkId - The link ID to find (without ^ prefix)
 * @returns The definition result with file-absolute location, or undefined if not found
 */
export function findDefinition(workspace: Workspace, linkId: string): DefinitionResult | undefined {
  const definition = workspace.getLinkDefinition(linkId);
  if (!definition) {
    return undefined;
  }

  // Convert block-relative location to file-absolute location
  const fileLocation = toFileLocation(definition.entry.sourceMap, definition.location);

  return {
    file: definition.file,
    location: fileLocation,
    definition,
  };
}

/**
 * Find the definition at a given position in a file
 *
 * @param workspace - The workspace to search in
 * @param file - The file path
 * @param offset - The character offset in the file
 * @returns The definition result, or undefined if no link at position or not found
 */
export function findDefinitionAtPosition(
  workspace: Workspace,
  file: string,
  offset: number,
): DefinitionResult | undefined {
  const doc = workspace.getDocument(file);
  if (!doc) {
    return undefined;
  }

  // Find link at the given offset
  const linkId = findLinkAtOffset(doc.source, offset);
  if (!linkId) {
    return undefined;
  }

  return findDefinition(workspace, linkId);
}

/**
 * Find a link ID at a given offset in source text
 */
function findLinkAtOffset(source: string, offset: number): string | undefined {
  // Look for ^link-id pattern at or around the offset
  const linkRegex = /\^[A-Za-z0-9\-_/.:]+/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(source)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (offset >= start && offset <= end) {
      return match[0].slice(1); // Remove ^ prefix
    }

    // Stop searching if we've passed the offset
    if (start > offset) {
      break;
    }
  }

  return undefined;
}
