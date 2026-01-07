import type { SyntaxNode } from "tree-sitter";
import type {
  AstNode,
  Location,
  SourceFile,
  Entry,
  InstanceEntry,
  InstanceHeader,
  InstanceDirective,
  Entity,
  SchemaEntry,
  SchemaHeader,
  SchemaDirective,
  SynthesisEntry,
  SynthesisHeader,
  ActualizeEntry,
  ActualizeHeader,
  MetadataBlock,
  SectionsBlock,
  RemoveMetadataBlock,
  RemoveSectionsBlock,
  FieldDefinition,
  FieldRemoval,
  SectionDefinition,
  SectionRemoval,
  TypeExpression,
  PrimitiveType,
  LiteralType,
  ArrayType,
  UnionType,
  Metadata,
  Content,
  MarkdownHeader,
  ContentLine,
  Timestamp,
  Title,
  Link,
  Tag,
  Identifier,
  Key,
  Value,
  ValueContent,
  PlainValue,
  QuotedValue,
  ValueArray,
  QueryList,
  Query,
  QueryCondition,
  FieldName,
  SectionName,
  Description,
  DefaultValue,
} from "./types.js";

/**
 * Extract location information from a tree-sitter node
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
 * Create the base AST node properties
 */
function baseNode<T extends string>(node: SyntaxNode, type: T): AstNode & { type: T } {
  return {
    type,
    location: extractLocation(node),
    syntaxNode: node,
  };
}

/**
 * Get a required child by field name
 */
function getChildByField(node: SyntaxNode, field: string): SyntaxNode {
  const child = node.childForFieldName(field);
  if (!child) {
    throw new Error(`Missing required field '${field}' in ${node.type}`);
  }
  return child;
}

/**
 * Get an optional child by field name
 */
function getOptionalChildByField(node: SyntaxNode, field: string): SyntaxNode | null {
  return node.childForFieldName(field);
}

/**
 * Get all children of a specific type
 */
function getChildrenByType(node: SyntaxNode, type: string): SyntaxNode[] {
  return node.namedChildren.filter((child) => child.type === type);
}

/**
 * Get the first child of a specific type
 */
function getChildByType(node: SyntaxNode, type: string): SyntaxNode | null {
  return node.namedChildren.find((child) => child.type === type) ?? null;
}

/**
 * Strip quotes from a quoted string
 */
function stripQuotes(text: string): string {
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1);
  }
  return text;
}

// ===================
// Extractors
// ===================

/**
 * Extract a SourceFile from the root node
 */
export function extractSourceFile(node: SyntaxNode): SourceFile {
  if (node.type !== "source_file") {
    throw new Error(`Expected source_file, got ${node.type}`);
  }

  const entries: Entry[] = [];
  for (const child of node.namedChildren) {
    if (child.type === "entry") {
      const entry = extractEntry(child);
      if (entry) {
        entries.push(entry);
      }
    }
  }

  return {
    ...baseNode(node, "source_file"),
    entries,
  };
}

/**
 * Extract an Entry from an entry node
 */
export function extractEntry(node: SyntaxNode): Entry | null {
  const child = node.namedChildren[0];
  if (!child) {
    return null;
  }

  if (child.type === "instance_entry") {
    return extractInstanceEntry(child);
  }
  if (child.type === "schema_entry") {
    return extractSchemaEntry(child);
  }
  if (child.type === "synthesis_entry") {
    return extractSynthesisEntry(child);
  }
  if (child.type === "actualize_entry") {
    return extractActualizeEntry(child);
  }
  return null;
}

/**
 * Extract an InstanceEntry
 */
export function extractInstanceEntry(node: SyntaxNode): InstanceEntry {
  const headerNode = getChildByType(node, "instance_header");
  if (!headerNode) {
    throw new Error("Missing instance_header in instance_entry");
  }

  const metadataNodes = getChildrenByType(node, "metadata");
  const contentNode = getChildByType(node, "content");

  return {
    ...baseNode(node, "instance_entry"),
    header: extractInstanceHeader(headerNode),
    metadata: metadataNodes.map(extractMetadata),
    content: contentNode ? extractContent(contentNode) : null,
  };
}

/**
 * Extract an InstanceHeader
 */
export function extractInstanceHeader(node: SyntaxNode): InstanceHeader {
  const timestampNode = getChildByField(node, "timestamp");
  const directiveNode = getChildByField(node, "directive");
  const entityNode = getChildByField(node, "entity");
  const titleNode = getChildByField(node, "title");

  const linkNodes = getChildrenByType(node, "link");
  const tagNodes = getChildrenByType(node, "tag");

  return {
    ...baseNode(node, "instance_header"),
    timestamp: extractTimestamp(timestampNode),
    directive: directiveNode.text as InstanceDirective,
    entity: entityNode.text as Entity,
    title: extractTitle(titleNode),
    link: linkNodes.length > 0 ? extractLink(linkNodes[0]) : null,
    tags: tagNodes.map(extractTag),
  };
}

/**
 * Extract a SchemaEntry
 */
export function extractSchemaEntry(node: SyntaxNode): SchemaEntry {
  const headerNode = getChildByType(node, "schema_header");
  if (!headerNode) {
    throw new Error("Missing schema_header in schema_entry");
  }

  const metadataBlockNode = getChildByType(node, "metadata_block");
  const sectionsBlockNode = getChildByType(node, "sections_block");
  const removeMetadataBlockNode = getChildByType(node, "remove_metadata_block");
  const removeSectionsBlockNode = getChildByType(node, "remove_sections_block");

  return {
    ...baseNode(node, "schema_entry"),
    header: extractSchemaHeader(headerNode),
    metadataBlock: metadataBlockNode ? extractMetadataBlock(metadataBlockNode) : null,
    sectionsBlock: sectionsBlockNode ? extractSectionsBlock(sectionsBlockNode) : null,
    removeMetadataBlock: removeMetadataBlockNode
      ? extractRemoveMetadataBlock(removeMetadataBlockNode)
      : null,
    removeSectionsBlock: removeSectionsBlockNode
      ? extractRemoveSectionsBlock(removeSectionsBlockNode)
      : null,
  };
}

/**
 * Extract a SchemaHeader
 */
export function extractSchemaHeader(node: SyntaxNode): SchemaHeader {
  const timestampNode = getChildByField(node, "timestamp");
  const directiveNode = getChildByField(node, "directive");
  const entityNameNode = getChildByField(node, "entity_name");
  const titleNode = getChildByField(node, "title");

  const linkNodes = getChildrenByType(node, "link");
  const tagNodes = getChildrenByType(node, "tag");

  return {
    ...baseNode(node, "schema_header"),
    timestamp: extractTimestamp(timestampNode),
    directive: directiveNode.text as SchemaDirective,
    entityName: extractIdentifier(entityNameNode),
    title: extractTitle(titleNode),
    link: linkNodes.length > 0 ? extractLink(linkNodes[0]) : null,
    tags: tagNodes.map(extractTag),
  };
}

/**
 * Extract a SynthesisEntry
 */
export function extractSynthesisEntry(node: SyntaxNode): SynthesisEntry {
  const headerNode = getChildByType(node, "synthesis_header");
  if (!headerNode) {
    throw new Error("Missing synthesis_header in synthesis_entry");
  }

  const metadataNodes = getChildrenByType(node, "metadata");
  const contentNode = getChildByType(node, "content");

  return {
    ...baseNode(node, "synthesis_entry"),
    header: extractSynthesisHeader(headerNode),
    metadata: metadataNodes.map(extractMetadata),
    content: contentNode ? extractContent(contentNode) : null,
  };
}

/**
 * Extract a SynthesisHeader
 */
export function extractSynthesisHeader(node: SyntaxNode): SynthesisHeader {
  const timestampNode = getChildByField(node, "timestamp");
  const titleNode = getChildByField(node, "title");
  const linkIdNode = getChildByField(node, "link_id");

  const tagNodes = getChildrenByType(node, "tag");

  return {
    ...baseNode(node, "synthesis_header"),
    timestamp: extractTimestamp(timestampNode),
    title: extractTitle(titleNode),
    linkId: extractLink(linkIdNode),
    tags: tagNodes.map(extractTag),
  };
}

/**
 * Extract an ActualizeEntry
 */
export function extractActualizeEntry(node: SyntaxNode): ActualizeEntry {
  const headerNode = getChildByType(node, "actualize_header");
  if (!headerNode) {
    throw new Error("Missing actualize_header in actualize_entry");
  }

  const metadataNodes = getChildrenByType(node, "metadata");

  return {
    ...baseNode(node, "actualize_entry"),
    header: extractActualizeHeader(headerNode),
    metadata: metadataNodes.map(extractMetadata),
  };
}

/**
 * Extract an ActualizeHeader
 */
export function extractActualizeHeader(node: SyntaxNode): ActualizeHeader {
  const timestampNode = getChildByField(node, "timestamp");
  const targetNode = getChildByField(node, "target");

  return {
    ...baseNode(node, "actualize_header"),
    timestamp: extractTimestamp(timestampNode),
    target: extractLink(targetNode),
  };
}

/**
 * Extract a MetadataBlock
 */
export function extractMetadataBlock(node: SyntaxNode): MetadataBlock {
  const fieldNodes = getChildrenByType(node, "field_definition");
  return {
    ...baseNode(node, "metadata_block"),
    fields: fieldNodes.map(extractFieldDefinition),
  };
}

/**
 * Extract a SectionsBlock
 */
export function extractSectionsBlock(node: SyntaxNode): SectionsBlock {
  const sectionNodes = getChildrenByType(node, "section_definition");
  return {
    ...baseNode(node, "sections_block"),
    sections: sectionNodes.map(extractSectionDefinition),
  };
}

/**
 * Extract a RemoveMetadataBlock
 */
export function extractRemoveMetadataBlock(node: SyntaxNode): RemoveMetadataBlock {
  const fieldNodes = getChildrenByType(node, "field_removal");
  return {
    ...baseNode(node, "remove_metadata_block"),
    fields: fieldNodes.map(extractFieldRemoval),
  };
}

/**
 * Extract a RemoveSectionsBlock
 */
export function extractRemoveSectionsBlock(node: SyntaxNode): RemoveSectionsBlock {
  const sectionNodes = getChildrenByType(node, "section_removal");
  return {
    ...baseNode(node, "remove_sections_block"),
    sections: sectionNodes.map(extractSectionRemoval),
  };
}

/**
 * Extract a FieldDefinition
 */
export function extractFieldDefinition(node: SyntaxNode): FieldDefinition {
  const nameNode = getChildByType(node, "field_name");
  if (!nameNode) {
    throw new Error("Missing field_name in field_definition");
  }

  const optionalMarker = getChildByType(node, "optional_marker");
  const typeNode = getChildByField(node, "type");
  const defaultNode = getOptionalChildByField(node, "default");
  const descriptionNode = getOptionalChildByField(node, "description");

  return {
    ...baseNode(node, "field_definition"),
    name: extractFieldName(nameNode),
    optional: optionalMarker !== null,
    typeExpr: extractTypeExpression(typeNode),
    defaultValue: defaultNode ? extractDefaultValue(defaultNode) : null,
    description: descriptionNode ? extractDescription(descriptionNode) : null,
  };
}

/**
 * Extract a FieldRemoval
 */
export function extractFieldRemoval(node: SyntaxNode): FieldRemoval {
  const nameNode = getChildByType(node, "field_name");
  if (!nameNode) {
    throw new Error("Missing field_name in field_removal");
  }

  const reasonNode = getOptionalChildByField(node, "reason");

  return {
    ...baseNode(node, "field_removal"),
    name: extractFieldName(nameNode),
    reason: reasonNode ? extractDescription(reasonNode) : null,
  };
}

/**
 * Extract a SectionDefinition
 */
export function extractSectionDefinition(node: SyntaxNode): SectionDefinition {
  const nameNode = getChildByType(node, "section_name");
  if (!nameNode) {
    throw new Error("Missing section_name in section_definition");
  }

  const optionalMarker = getChildByType(node, "optional_marker");
  const descriptionNode = getOptionalChildByField(node, "description");

  return {
    ...baseNode(node, "section_definition"),
    name: extractSectionName(nameNode),
    optional: optionalMarker !== null,
    description: descriptionNode ? extractDescription(descriptionNode) : null,
  };
}

/**
 * Extract a SectionRemoval
 */
export function extractSectionRemoval(node: SyntaxNode): SectionRemoval {
  const nameNode = getChildByType(node, "section_name");
  if (!nameNode) {
    throw new Error("Missing section_name in section_removal");
  }

  const reasonNode = getOptionalChildByField(node, "reason");

  return {
    ...baseNode(node, "section_removal"),
    name: extractSectionName(nameNode),
    reason: reasonNode ? extractDescription(reasonNode) : null,
  };
}

/**
 * Extract a TypeExpression
 */
export function extractTypeExpression(node: SyntaxNode): TypeExpression {
  // type_expression wraps the actual type
  const child = node.namedChildren[0];
  if (!child) {
    throw new Error("Empty type_expression");
  }

  switch (child.type) {
    case "primitive_type":
      return extractPrimitiveType(child);
    case "literal_type":
      return extractLiteralType(child);
    case "array_type":
      return extractArrayType(child);
    case "union_type":
      return extractUnionType(child);
    default:
      throw new Error(`Unknown type expression: ${child.type}`);
  }
}

/**
 * Extract a PrimitiveType
 */
export function extractPrimitiveType(node: SyntaxNode): PrimitiveType {
  return {
    ...baseNode(node, "primitive_type"),
    name: node.text as PrimitiveType["name"],
  };
}

/**
 * Extract a LiteralType
 */
export function extractLiteralType(node: SyntaxNode): LiteralType {
  return {
    ...baseNode(node, "literal_type"),
    value: stripQuotes(node.text),
  };
}

/**
 * Extract an ArrayType
 */
export function extractArrayType(node: SyntaxNode): ArrayType {
  const child = node.namedChildren[0];
  if (!child) {
    throw new Error("Empty array_type");
  }

  let elementType: PrimitiveType | LiteralType | UnionType;
  if (child.type === "primitive_type") {
    elementType = extractPrimitiveType(child);
  } else if (child.type === "literal_type") {
    elementType = extractLiteralType(child);
  } else if (child.type === "paren_type") {
    // Parenthesized type: extract the inner type_expression
    const innerTypeExpr = child.namedChildren[0];
    if (!innerTypeExpr) {
      throw new Error("Empty paren_type");
    }
    const extracted = extractTypeExpression(innerTypeExpr);
    // paren_type is only valid with union types in arrays
    if (extracted.type !== "union_type") {
      throw new Error(`Unexpected paren_type content: ${extracted.type}`);
    }
    elementType = extracted;
  } else {
    throw new Error(`Invalid array element type: ${child.type}`);
  }

  return {
    ...baseNode(node, "array_type"),
    elementType,
  };
}

/**
 * Extract a UnionType
 */
export function extractUnionType(node: SyntaxNode): UnionType {
  const members: (PrimitiveType | LiteralType | ArrayType)[] = [];

  for (const child of node.namedChildren) {
    switch (child.type) {
      case "primitive_type":
        members.push(extractPrimitiveType(child));
        break;
      case "literal_type":
        members.push(extractLiteralType(child));
        break;
      case "array_type":
        members.push(extractArrayType(child));
        break;
    }
  }

  return {
    ...baseNode(node, "union_type"),
    members,
  };
}

/**
 * Extract a Metadata entry
 */
export function extractMetadata(node: SyntaxNode): Metadata {
  const keyNode = getChildByField(node, "key");
  const valueNode = getChildByField(node, "value");

  return {
    ...baseNode(node, "metadata"),
    key: extractKey(keyNode),
    value: extractValue(valueNode),
  };
}

/**
 * Extract Content
 */
export function extractContent(node: SyntaxNode): Content {
  const children: (MarkdownHeader | ContentLine)[] = [];

  for (const child of node.namedChildren) {
    if (child.type === "markdown_header") {
      children.push(extractMarkdownHeader(child));
    } else if (child.type === "content_line") {
      children.push(extractContentLine(child));
    }
  }

  return {
    ...baseNode(node, "content"),
    children,
  };
}

/**
 * Extract a MarkdownHeader
 */
export function extractMarkdownHeader(node: SyntaxNode): MarkdownHeader {
  return {
    ...baseNode(node, "markdown_header"),
    text: node.text.trim(),
  };
}

/**
 * Extract a ContentLine
 */
export function extractContentLine(node: SyntaxNode): ContentLine {
  return {
    ...baseNode(node, "content_line"),
    text: node.text.trim(),
  };
}

// ===================
// Terminal Extractors
// ===================

export function extractTimestamp(node: SyntaxNode): Timestamp {
  return {
    ...baseNode(node, "timestamp"),
    value: node.text,
  };
}

export function extractTitle(node: SyntaxNode): Title {
  return {
    ...baseNode(node, "title"),
    value: stripQuotes(node.text),
  };
}

export function extractLink(node: SyntaxNode): Link {
  const text = node.text.trim();
  return {
    ...baseNode(node, "link"),
    id: text.slice(1), // Remove ^ prefix
  };
}

export function extractTag(node: SyntaxNode): Tag {
  const text = node.text.trim();
  return {
    ...baseNode(node, "tag"),
    name: text.slice(1), // Remove # prefix
  };
}

export function extractIdentifier(node: SyntaxNode): Identifier {
  return {
    ...baseNode(node, "identifier"),
    value: node.text,
  };
}

export function extractKey(node: SyntaxNode): Key {
  return {
    ...baseNode(node, "key"),
    value: node.text,
  };
}

export function extractValue(node: SyntaxNode): Value {
  const child = node.namedChildren[0];
  if (!child) {
    // Fallback for empty or unrecognized values
    return {
      ...baseNode(node, "value"),
      raw: node.text.trim(),
      content: {
        ...baseNode(node, "plain_value"),
        words: [node.text.trim()],
        text: node.text.trim(),
      },
    };
  }

  return {
    ...baseNode(node, "value"),
    raw: node.text.trim(),
    content: extractValueContent(child),
  };
}

/**
 * Extract typed value content from a child node of value
 */
function extractValueContent(node: SyntaxNode): ValueContent {
  switch (node.type) {
    case "plain_value":
      return extractPlainValue(node);
    case "quoted_value":
      return extractQuotedValue(node);
    case "link":
      return {
        ...baseNode(node, "link_value"),
        link: extractLink(node),
      };
    case "date_range":
      return {
        ...baseNode(node, "date_range"),
        raw: node.text.trim(),
      };
    case "value_array":
      return extractValueArray(node);
    case "query_list":
      return extractQueryList(node);
    default:
      // Fallback: treat as plain value
      return {
        ...baseNode(node, "plain_value"),
        words: [node.text.trim()],
        text: node.text.trim(),
      };
  }
}

function extractPlainValue(node: SyntaxNode): PlainValue {
  const words = node.namedChildren
    .filter((child) => child.type === "value_word")
    .map((child) => child.text);

  return {
    ...baseNode(node, "plain_value"),
    words,
    text: words.join(" "),
  };
}

function extractQuotedValue(node: SyntaxNode): QuotedValue {
  return {
    ...baseNode(node, "quoted_value"),
    value: stripQuotes(node.text),
  };
}

function extractValueArray(node: SyntaxNode): ValueArray {
  const elements: (Link | QuotedValue)[] = [];

  for (const child of node.namedChildren) {
    if (child.type === "link") {
      elements.push(extractLink(child));
    } else if (child.type === "quoted_value") {
      elements.push(extractQuotedValue(child));
    }
  }

  return {
    ...baseNode(node, "value_array"),
    elements,
  };
}

function extractQueryList(node: SyntaxNode): QueryList {
  const queries = node.namedChildren.filter((child) => child.type === "query").map(extractQuery);

  return {
    ...baseNode(node, "query_list"),
    queries,
  };
}

function extractQuery(node: SyntaxNode): Query {
  const entityNode = node.childForFieldName("entity");
  const conditionsNode = node.childForFieldName("conditions");

  // Get entity text - handle nested query_entity from alias
  let entityText = "";
  if (entityNode) {
    // The aliased query_entity may have a child query_entity
    const innerEntity = entityNode.namedChildren[0];
    entityText = innerEntity ? innerEntity.text : entityNode.text;
  }

  const conditions: QueryCondition[] = [];
  if (conditionsNode) {
    for (const child of conditionsNode.namedChildren) {
      if (child.type === "query_condition") {
        const condition = extractQueryCondition(child);
        if (condition) {
          conditions.push(condition);
        }
      }
    }
  }

  return {
    ...baseNode(node, "query"),
    entity: entityText,
    conditions,
  };
}

function extractQueryCondition(node: SyntaxNode): QueryCondition | null {
  const child = node.namedChildren[0];
  if (!child) {
    return null;
  }

  switch (child.type) {
    case "field_condition": {
      const fieldNode = child.childForFieldName("field");
      const valueNode = child.childForFieldName("value");

      // Handle nested alias for condition_field
      let fieldText = "";
      if (fieldNode) {
        const innerField = fieldNode.namedChildren[0];
        fieldText = innerField ? innerField.text : fieldNode.text;
      }

      // Handle value - could be link, quoted_value, or condition_plain_value
      let valueText = "";
      if (valueNode) {
        if (valueNode.type === "link") {
          valueText = valueNode.text;
        } else if (valueNode.type === "quoted_value") {
          valueText = stripQuotes(valueNode.text);
        } else {
          // condition_plain_value (aliased)
          const inner = valueNode.namedChildren[0];
          valueText = inner ? inner.text : valueNode.text;
        }
      }

      return {
        ...baseNode(child, "field_condition"),
        field: fieldText,
        value: valueText,
      };
    }
    case "tag_condition": {
      const tagNode = getChildByType(child, "tag");
      return {
        ...baseNode(child, "tag_condition"),
        tag: tagNode ? tagNode.text.slice(1) : "", // Remove # prefix
      };
    }
    case "link_condition": {
      const linkNode = getChildByType(child, "link");
      return {
        ...baseNode(child, "link_condition"),
        linkId: linkNode ? linkNode.text.slice(1) : "", // Remove ^ prefix
      };
    }
    default:
      return null;
  }
}

export function extractFieldName(node: SyntaxNode): FieldName {
  return {
    ...baseNode(node, "field_name"),
    value: node.text.trim(),
  };
}

export function extractSectionName(node: SyntaxNode): SectionName {
  return {
    ...baseNode(node, "section_name"),
    value: node.text.trim(),
  };
}

export function extractDescription(node: SyntaxNode): Description {
  return {
    ...baseNode(node, "description"),
    value: stripQuotes(node.text),
  };
}

export function extractDefaultValue(node: SyntaxNode): DefaultValue {
  const literalNode = getChildByType(node, "literal_type");

  return {
    ...baseNode(node, "default_value"),
    raw: node.text,
    literal: literalNode ? extractLiteralType(literalNode) : null,
  };
}
