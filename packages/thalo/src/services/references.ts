import type { Workspace } from "../model/workspace.js";
import type { Location } from "../ast/types.js";
import type { LinkReference, LinkDefinition } from "../model/types.js";
import { toFileLocation } from "../source-map.js";

/**
 * A reference location
 */
export interface ReferenceLocation {
  /** The file containing the reference */
  file: string;
  /** Location of the reference (file-absolute) */
  location: Location;
  /** Whether this is the definition (vs a reference) */
  isDefinition: boolean;
}

/**
 * Result of a find-references query
 */
export interface ReferencesResult {
  /** The link ID */
  linkId: string;
  /** The definition (if it exists) */
  definition: LinkDefinition | undefined;
  /** All references to this link */
  references: LinkReference[];
  /** All locations (definition + references) with file-absolute positions */
  locations: ReferenceLocation[];
}

/**
 * Find all references to a link ID
 *
 * @param workspace - The workspace to search in
 * @param linkId - The link ID to find (without ^ prefix)
 * @param includeDefinition - Whether to include the definition in the results
 * @returns The references result with file-absolute locations
 */
export function findReferences(
  workspace: Workspace,
  linkId: string,
  includeDefinition = true,
): ReferencesResult {
  const definition = workspace.getLinkDefinition(linkId);
  const references = workspace.getLinkReferences(linkId);

  const locations: ReferenceLocation[] = [];

  // Add definition first if requested
  if (includeDefinition && definition) {
    // Convert block-relative to file-absolute location
    const fileLocation = toFileLocation(definition.entry.sourceMap, definition.location);
    locations.push({
      file: definition.file,
      location: fileLocation,
      isDefinition: true,
    });
  }

  // Add all references
  for (const ref of references) {
    // Convert block-relative to file-absolute location
    const fileLocation = toFileLocation(ref.entry.sourceMap, ref.location);
    locations.push({
      file: ref.file,
      location: fileLocation,
      isDefinition: false,
    });
  }

  return {
    linkId,
    definition,
    references,
    locations,
  };
}

/**
 * Find all references at a given position in a file
 *
 * @param workspace - The workspace to search in
 * @param file - The file path
 * @param offset - The character offset in the file
 * @param includeDefinition - Whether to include the definition in the results
 * @returns The references result, or undefined if no link at position
 */
export function findReferencesAtPosition(
  workspace: Workspace,
  file: string,
  offset: number,
  includeDefinition = true,
): ReferencesResult | undefined {
  const doc = workspace.getDocument(file);
  if (!doc) {
    return undefined;
  }

  // Find link at the given offset
  const linkId = findLinkAtOffset(doc.source, offset);
  if (!linkId) {
    return undefined;
  }

  return findReferences(workspace, linkId, includeDefinition);
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
