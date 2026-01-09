import type { Workspace } from "../model/workspace.js";
import type { Location } from "../ast/types.js";
import type { LinkDefinition } from "../semantic/types.js";
import { toFileLocation, positionFromOffset } from "../source-map.js";
import { findNodeAtPosition } from "../ast/node-at-position.js";

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

  // Get the model to access the source map
  const model = workspace.getModel(definition.file);
  if (!model) {
    return undefined;
  }

  // Convert block-relative location to file-absolute location
  const fileLocation = toFileLocation(model.sourceMap, definition.location);

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

  return findDefinition(workspace, context.linkId);
}
