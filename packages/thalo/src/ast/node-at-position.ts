import type { SyntaxNode, Point } from "tree-sitter";
import type { ParsedDocument, ParsedBlock } from "../parser.js";
import {
  findBlockAtPosition,
  positionToPoint,
  type SourceMap,
  type Position,
} from "../source-map.js";
import type {
  Link,
  Tag,
  Timestamp,
  Key,
  TypeExpression,
  Identifier,
  FieldName,
  SectionName,
  Location,
} from "./types.js";
import {
  extractLink,
  extractTag,
  extractTimestamp,
  extractKey,
  extractTypeExpression,
  extractIdentifier,
  extractFieldName,
  extractSectionName,
} from "./extract.js";

// ===================
// Types
// ===================

/**
 * Context for a link node (^link-id)
 */
export interface LinkContext {
  kind: "link";
  linkId: string;
  node: Link;
  sourceMap: SourceMap;
}

/**
 * Context for a tag node (#tag)
 */
export interface TagContext {
  kind: "tag";
  tagName: string;
  node: Tag;
  sourceMap: SourceMap;
}

/**
 * Context for a timestamp node
 */
export interface TimestampContext {
  kind: "timestamp";
  value: string;
  node: Timestamp;
  sourceMap: SourceMap;
}

/**
 * Context for a directive (create, update, define-entity, etc.)
 */
export interface DirectiveContext {
  kind: "directive";
  directive: string;
  location: Location;
  sourceMap: SourceMap;
}

/**
 * Context for an entity name in instance entries
 */
export interface EntityContext {
  kind: "entity";
  entityName: string;
  location: Location;
  sourceMap: SourceMap;
}

/**
 * Context for an entity name in schema entries (define-entity/alter-entity)
 */
export interface SchemaEntityContext {
  kind: "schema_entity";
  entityName: string;
  node: Identifier;
  sourceMap: SourceMap;
}

/**
 * Context for a metadata key
 */
export interface MetadataKeyContext {
  kind: "metadata_key";
  key: string;
  node: Key;
  /** The entity type of the containing entry (if known) */
  entityContext?: string;
  sourceMap: SourceMap;
}

/**
 * Context for a section header in content (# SectionName)
 */
export interface SectionHeaderContext {
  kind: "section_header";
  sectionName: string;
  location: Location;
  /** The entity type of the containing entry (if known) */
  entityContext?: string;
  sourceMap: SourceMap;
}

/**
 * Context for a type expression in schema definitions
 */
export interface TypeContext {
  kind: "type";
  typeName: string;
  node: TypeExpression;
  sourceMap: SourceMap;
}

/**
 * Context for a field name in schema definitions
 */
export interface FieldNameContext {
  kind: "field_name";
  fieldName: string;
  node: FieldName;
  /** The entity being defined/altered */
  entityContext?: string;
  sourceMap: SourceMap;
}

/**
 * Context for a section name in schema definitions
 */
export interface SectionNameContext {
  kind: "section_name";
  sectionName: string;
  node: SectionName;
  /** The entity being defined/altered */
  entityContext?: string;
  sourceMap: SourceMap;
}

/**
 * Context for a title
 */
export interface TitleContext {
  kind: "title";
  title: string;
  location: Location;
  sourceMap: SourceMap;
}

/**
 * Unknown context - position doesn't map to a recognized element
 */
export interface UnknownContext {
  kind: "unknown";
}

/**
 * All possible node contexts
 */
export type NodeContext =
  | LinkContext
  | TagContext
  | TimestampContext
  | DirectiveContext
  | EntityContext
  | SchemaEntityContext
  | MetadataKeyContext
  | SectionHeaderContext
  | TypeContext
  | FieldNameContext
  | SectionNameContext
  | TitleContext
  | UnknownContext;

// ===================
// Helpers
// ===================

/**
 * Extract location from a syntax node
 */
function extractLocation(node: SyntaxNode): Location {
  return {
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    startPosition: node.startPosition,
    endPosition: node.endPosition,
  };
}

/**
 * Find the entry that contains a given node by walking up the tree
 */
function findContainingEntry(node: SyntaxNode): SyntaxNode | null {
  let current: SyntaxNode | null = node;
  while (current) {
    if (current.type === "entry") {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Get the entity context (entity type name) from an entry node
 */
function getEntityContextFromEntry(entryNode: SyntaxNode): string | undefined {
  // entry contains one of: instance_entry, schema_entry, synthesis_entry, actualize_entry
  const child = entryNode.namedChildren[0];
  if (!child) {
    return undefined;
  }

  if (child.type === "instance_entry") {
    const header = child.namedChildren.find((n) => n.type === "instance_header");
    if (header) {
      const entityNode = header.childForFieldName("entity");
      if (entityNode) {
        return entityNode.text;
      }
    }
  } else if (child.type === "schema_entry") {
    const header = child.namedChildren.find((n) => n.type === "schema_header");
    if (header) {
      const entityNameNode = header.childForFieldName("entity_name");
      if (entityNameNode) {
        return entityNameNode.text;
      }
    }
  } else if (child.type === "synthesis_entry" || child.type === "actualize_entry") {
    return "synthesis";
  }

  return undefined;
}

/**
 * Check if position is within a node
 */
function isPositionInNode(point: Point, node: SyntaxNode): boolean {
  const start = node.startPosition;
  const end = node.endPosition;

  // Before start
  if (point.row < start.row || (point.row === start.row && point.column < start.column)) {
    return false;
  }
  // After end
  if (point.row > end.row || (point.row === end.row && point.column > end.column)) {
    return false;
  }
  return true;
}

// ===================
// Directive detection
// ===================

/**
 * Check if position is on a directive keyword within a header
 */
function checkForDirective(
  node: SyntaxNode,
  point: Point,
  sourceMap: SourceMap,
): DirectiveContext | null {
  // Walk up to find header
  let current: SyntaxNode | null = node;
  while (current) {
    if (
      current.type === "instance_header" ||
      current.type === "schema_header" ||
      current.type === "synthesis_header" ||
      current.type === "actualize_header"
    ) {
      const directiveNode = current.childForFieldName("directive");
      if (directiveNode && isPositionInNode(point, directiveNode)) {
        return {
          kind: "directive",
          directive: directiveNode.text,
          location: extractLocation(directiveNode),
          sourceMap,
        };
      }
      // For synthesis_header, check if on "define-synthesis" text
      if (current.type === "synthesis_header") {
        const timestampNode = current.childForFieldName("timestamp");
        if (timestampNode) {
          const afterTimestamp = timestampNode.endPosition;
          const titleNode = current.childForFieldName("title");
          if (
            titleNode &&
            point.row === afterTimestamp.row &&
            point.column > afterTimestamp.column &&
            point.column < titleNode.startPosition.column
          ) {
            return {
              kind: "directive",
              directive: "define-synthesis",
              location: {
                startIndex: timestampNode.endIndex + 1,
                endIndex: titleNode.startIndex - 1,
                startPosition: { row: afterTimestamp.row, column: afterTimestamp.column + 1 },
                endPosition: {
                  row: titleNode.startPosition.row,
                  column: titleNode.startPosition.column - 1,
                },
              },
              sourceMap,
            };
          }
        }
      }
      // For actualize_header, check if on "actualize-synthesis" text
      if (current.type === "actualize_header") {
        const timestampNode = current.childForFieldName("timestamp");
        const targetNode = current.childForFieldName("target");
        if (timestampNode && targetNode) {
          const afterTimestamp = timestampNode.endPosition;
          // "actualize-synthesis" is between timestamp and target
          if (
            point.row === afterTimestamp.row &&
            point.column > afterTimestamp.column &&
            point.column < targetNode.startPosition.column
          ) {
            return {
              kind: "directive",
              directive: "actualize-synthesis",
              location: {
                startIndex: timestampNode.endIndex + 1,
                endIndex: targetNode.startIndex - 1,
                startPosition: { row: afterTimestamp.row, column: afterTimestamp.column + 1 },
                endPosition: {
                  row: targetNode.startPosition.row,
                  column: targetNode.startPosition.column - 1,
                },
              },
              sourceMap,
            };
          }
        }
      }
      break;
    }
    current = current.parent;
  }
  return null;
}

// ===================
// Main function
// ===================

/**
 * Find the semantic context of a node at a given position in a parsed document.
 *
 * This function handles both standalone .thalo files and embedded thalo blocks
 * in markdown files. It uses the source map to convert file-absolute positions
 * to block-relative positions before querying the AST.
 *
 * @param parsed - The parsed document (may contain multiple blocks for markdown)
 * @param position - File-absolute position (0-based line and column)
 * @returns The semantic context at the position, or { kind: "unknown" } if not recognized
 */
export function findNodeAtPosition(parsed: ParsedDocument, position: Position): NodeContext {
  // Find which block contains the position
  const match = findBlockAtPosition(parsed.blocks, position);
  if (!match) {
    return { kind: "unknown" };
  }

  const { block, blockPosition } = match;
  const point = positionToPoint(blockPosition);

  // Use tree-sitter to find the deepest node at this position
  const rootNode = block.tree.rootNode;
  let node = rootNode.descendantForPosition(point);

  if (!node) {
    return { kind: "unknown" };
  }

  // Handle edge case: position is at the exact end of a node
  // In this case, descendantForPosition might return the parent node
  // Try to find a child node that ends exactly at this position
  const endMatchingChild = findChildEndingAt(node, point);
  if (endMatchingChild) {
    node = endMatchingChild;
  }

  return classifyNode(node, point, block);
}

/**
 * Find a child node that ends exactly at the given position.
 * This helps handle edge cases where cursor is right at the end of a token.
 */
function findChildEndingAt(node: SyntaxNode, point: Point): SyntaxNode | null {
  for (const child of node.namedChildren) {
    const end = child.endPosition;
    // Check if this child ends exactly at the point
    if (end.row === point.row && end.column === point.column) {
      // Recursively check for deeper matches
      const deeper = findChildEndingAt(child, point);
      return deeper || child;
    }
    // Check if point is within this child
    if (isPositionInNode(point, child)) {
      return findChildEndingAt(child, point);
    }
  }
  return null;
}

/**
 * Classify a syntax node into a semantic context
 */
function classifyNode(node: SyntaxNode, point: Point, block: ParsedBlock): NodeContext {
  const { sourceMap } = block;

  // Direct node type matches
  switch (node.type) {
    case "link":
      return {
        kind: "link",
        linkId: extractLink(node).id,
        node: extractLink(node),
        sourceMap,
      };

    case "tag":
      return {
        kind: "tag",
        tagName: extractTag(node).name,
        node: extractTag(node),
        sourceMap,
      };

    case "timestamp":
      return {
        kind: "timestamp",
        value: extractTimestamp(node).value,
        node: extractTimestamp(node),
        sourceMap,
      };

    case "key":
      return classifyKeyNode(node, sourceMap);

    case "primitive_type":
    case "literal_type":
    case "array_type":
    case "union_type":
      return {
        kind: "type",
        typeName: node.type === "primitive_type" ? node.text : node.type,
        node: extractTypeExpression(node.parent ?? node),
        sourceMap,
      };

    case "field_name":
      return classifyFieldNameNode(node, sourceMap);

    case "section_name":
      return classifySectionNameNode(node, sourceMap);

    case "title":
      return {
        kind: "title",
        title: node.text.slice(1, -1), // Remove quotes
        location: extractLocation(node),
        sourceMap,
      };

    case "identifier":
      // Could be entity name in schema header
      return classifyIdentifierNode(node, sourceMap);

    case "markdown_header":
      // Section header in content
      return classifyMarkdownHeader(node, sourceMap);
  }

  // Check if we're on a directive keyword
  const directiveContext = checkForDirective(node, point, sourceMap);
  if (directiveContext) {
    return directiveContext;
  }

  // Check parent nodes for context
  let current: SyntaxNode | null = node;
  while (current) {
    // Check for entity in instance header
    if (current.type === "instance_header") {
      const entityNode = current.childForFieldName("entity");
      if (entityNode && isPositionInNode(point, entityNode)) {
        return {
          kind: "entity",
          entityName: entityNode.text,
          location: extractLocation(entityNode),
          sourceMap,
        };
      }
    }

    // Check for entity_name in schema header
    if (current.type === "schema_header") {
      const entityNameNode = current.childForFieldName("entity_name");
      if (entityNameNode && isPositionInNode(point, entityNameNode)) {
        return {
          kind: "schema_entity",
          entityName: entityNameNode.text,
          node: extractIdentifier(entityNameNode),
          sourceMap,
        };
      }
    }

    current = current.parent;
  }

  // Fallback: check if we're on text that looks like an entity position
  // This handles cases where the parser couldn't match the entity (unknown entity names)
  const entityFallback = checkForUnrecognizedEntity(node, point, sourceMap, block);
  if (entityFallback) {
    return entityFallback;
  }

  // Fallback: check if we're on a section header in content
  const sectionFallback = checkForSectionHeader(node, point, sourceMap, block);
  if (sectionFallback) {
    return sectionFallback;
  }

  return { kind: "unknown" };
}

/**
 * Check if we're on text that looks like an entity name but wasn't recognized by parser.
 * This handles the case of unknown/invalid entity names.
 */
function checkForUnrecognizedEntity(
  _node: SyntaxNode,
  point: Point,
  sourceMap: SourceMap,
  block: ParsedBlock,
): EntityContext | null {
  // Look for ERROR nodes or unrecognized text after "create" or "update"
  const lineText = getLineTextFromBlock(block, point.row);
  if (!lineText) {
    return null;
  }

  // Check if line starts with timestamp + create/update pattern
  const match = lineText.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))\s+(create|update)\s+([a-z][a-zA-Z0-9\-_]*)/,
  );
  if (!match) {
    return null;
  }

  const [fullMatch, , , entityName] = match;
  const entityStart = fullMatch.lastIndexOf(entityName);
  const entityEnd = entityStart + entityName.length;

  // Check if position is within the entity name
  if (point.column >= entityStart && point.column <= entityEnd) {
    return {
      kind: "entity",
      entityName,
      location: {
        startIndex: 0,
        endIndex: 0,
        startPosition: { row: point.row, column: entityStart },
        endPosition: { row: point.row, column: entityEnd },
      },
      sourceMap,
    };
  }

  return null;
}

/**
 * Get line text from a parsed block
 */
function getLineTextFromBlock(block: ParsedBlock, lineNumber: number): string | null {
  const lines = block.source.split("\n");
  if (lineNumber >= 0 && lineNumber < lines.length) {
    return lines[lineNumber];
  }
  return null;
}

/**
 * Check if we're on a section header in content (# SectionName)
 * This handles cases where the parser might not properly recognize content section headers
 */
function checkForSectionHeader(
  node: SyntaxNode,
  point: Point,
  sourceMap: SourceMap,
  block: ParsedBlock,
): SectionHeaderContext | null {
  const lineText = getLineTextFromBlock(block, point.row);
  if (!lineText) {
    return null;
  }

  // Check for section header pattern: optional indent + # + section name
  const match = lineText.match(/^(\s*)#\s*([A-Z][a-zA-Z0-9]*)/);
  if (!match) {
    return null;
  }

  const [fullMatch, indent, sectionName] = match;
  const hashStart = indent.length;
  const sectionStart = lineText.indexOf(sectionName, hashStart);
  const sectionEnd = sectionStart + sectionName.length;

  // Check if position is on the section name
  if (point.column >= hashStart && point.column <= sectionEnd) {
    // Find the entity context from the containing entry
    const entry = findContainingEntry(node);
    const entityContext = entry ? getEntityContextFromEntry(entry) : undefined;

    return {
      kind: "section_header",
      sectionName,
      location: {
        startIndex: 0,
        endIndex: 0,
        startPosition: { row: point.row, column: hashStart },
        endPosition: { row: point.row, column: fullMatch.length },
      },
      entityContext,
      sourceMap,
    };
  }

  return null;
}

/**
 * Classify a key node (metadata key)
 */
function classifyKeyNode(node: SyntaxNode, sourceMap: SourceMap): MetadataKeyContext {
  const entry = findContainingEntry(node);
  const entityContext = entry ? getEntityContextFromEntry(entry) : undefined;

  return {
    kind: "metadata_key",
    key: extractKey(node).value,
    node: extractKey(node),
    entityContext,
    sourceMap,
  };
}

/**
 * Classify a field_name node in schema definitions
 */
function classifyFieldNameNode(node: SyntaxNode, sourceMap: SourceMap): FieldNameContext {
  const entry = findContainingEntry(node);
  const entityContext = entry ? getEntityContextFromEntry(entry) : undefined;

  return {
    kind: "field_name",
    fieldName: extractFieldName(node).value,
    node: extractFieldName(node),
    entityContext,
    sourceMap,
  };
}

/**
 * Classify a section_name node in schema definitions
 */
function classifySectionNameNode(node: SyntaxNode, sourceMap: SourceMap): SectionNameContext {
  const entry = findContainingEntry(node);
  const entityContext = entry ? getEntityContextFromEntry(entry) : undefined;

  return {
    kind: "section_name",
    sectionName: extractSectionName(node).value,
    node: extractSectionName(node),
    entityContext,
    sourceMap,
  };
}

/**
 * Classify an identifier node
 */
function classifyIdentifierNode(node: SyntaxNode, sourceMap: SourceMap): NodeContext {
  // Check if this is the entity_name in a schema header
  const parent = node.parent;
  if (parent?.type === "schema_header") {
    const entityNameNode = parent.childForFieldName("entity_name");
    if (entityNameNode && entityNameNode.id === node.id) {
      return {
        kind: "schema_entity",
        entityName: node.text,
        node: extractIdentifier(node),
        sourceMap,
      };
    }
  }

  return { kind: "unknown" };
}

/**
 * Classify a markdown_header node (section in content)
 */
function classifyMarkdownHeader(node: SyntaxNode, sourceMap: SourceMap): SectionHeaderContext {
  const entry = findContainingEntry(node);
  const entityContext = entry ? getEntityContextFromEntry(entry) : undefined;

  // Extract section name from "# SectionName" format
  const text = node.text.trim();
  const match = text.match(/^#\s*([A-Z][a-zA-Z0-9]*)/);
  const sectionName = match ? match[1] : text.replace(/^#\s*/, "");

  return {
    kind: "section_header",
    sectionName,
    location: extractLocation(node),
    entityContext,
    sourceMap,
  };
}
