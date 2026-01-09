import type { Workspace } from "../model/workspace.js";
import type { Location } from "../ast/types.js";
import type { LinkReference, LinkDefinition } from "../semantic/types.js";
import { toFileLocation, positionFromOffset } from "../source-map.js";
import { findNodeAtPosition } from "../ast/node-at-position.js";

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
    // Get source map from model
    const model = workspace.getModel(definition.file);
    if (model) {
      const fileLocation = toFileLocation(model.sourceMap, definition.location);
      locations.push({
        file: definition.file,
        location: fileLocation,
        isDefinition: true,
      });
    }
  }

  // Add all references
  for (const ref of references) {
    // Get source map from model
    const model = workspace.getModel(ref.file);
    if (model) {
      const fileLocation = toFileLocation(model.sourceMap, ref.location);
      locations.push({
        file: ref.file,
        location: fileLocation,
        isDefinition: false,
      });
    }
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
  const model = workspace.getModel(file);
  if (!model) {
    return undefined;
  }

  // Convert offset to position
  const position = positionFromOffset(model.source, offset);

  // Use AST-based node detection
  const context = findNodeAtPosition({ blocks: model.blocks }, position);

  // Only handle link contexts
  if (context.kind !== "link") {
    return undefined;
  }

  return findReferences(workspace, context.linkId, includeDefinition);
}
