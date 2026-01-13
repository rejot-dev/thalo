import type { SyntaxNode } from "./types.js";
import { buildTimestamp, createSyntaxError } from "./builder.js";
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
  SyntaxErrorNode,
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
  QuotedValue,
  DatetimeValue,
  DaterangeValue,
  NumberValue,
  ValueArray,
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
  return node.namedChildren.filter(
    (child): child is SyntaxNode => child !== null && child.type === type,
  );
}

/**
 * Get the first child of a specific type
 */
function getChildByType(node: SyntaxNode, type: string): SyntaxNode | null {
  return (
    node.namedChildren.find(
      (child): child is SyntaxNode => child !== null && child.type === type,
    ) ?? null
  );
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

/**
 * Recursively find all ERROR nodes within a syntax tree.
 * Used to capture syntax errors nested inside entries.
 */
function findErrorNodes(node: SyntaxNode): SyntaxNode[] {
  const errors: SyntaxNode[] = [];

  function walk(n: SyntaxNode): void {
    if (n.type === "ERROR") {
      errors.push(n);
      // Don't recurse into ERROR nodes - they may contain fragments
      // that look like valid nodes but are part of the error
      return;
    }
    for (const child of n.children) {
      if (child) {
        walk(child);
      }
    }
  }

  walk(node);
  return errors;
}

/**
 * Convert an ERROR syntax node to a SyntaxErrorNode
 */
function errorNodeToSyntaxError(node: SyntaxNode): SyntaxErrorNode {
  const text = node.text.trim();
  return {
    type: "syntax_error",
    code: "parse_error",
    message: `Parse error: unexpected content "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"`,
    text: node.text,
    location: extractLocation(node),
    syntaxNode: node,
  };
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
  const syntaxErrors: SyntaxErrorNode[] = [];

  for (const child of node.namedChildren) {
    if (!child) {
      // Skip nulls (web-tree-sitter can return null in arrays)
      continue;
    }

    if (child.type === "entry") {
      const entry = extractEntry(child);
      if (entry) {
        entries.push(entry);
      }
      // Collect ERROR nodes nested inside entries (tree-sitter may nest errors
      // inside entries when there's recoverable content after the error)
      if (child.hasError) {
        const nestedErrors = findErrorNodes(child);
        for (const errorNode of nestedErrors) {
          syntaxErrors.push(errorNodeToSyntaxError(errorNode));
        }
      }
    } else if (child.type === "ERROR") {
      syntaxErrors.push(errorNodeToSyntaxError(child));
    }
  }

  return {
    ...baseNode(node, "source_file"),
    entries,
    syntaxErrors,
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

  if (child.type === "data_entry") {
    return extractDataEntry(child);
  }
  if (child.type === "schema_entry") {
    return extractSchemaEntry(child);
  }
  return null;
}

/**
 * Extract a DataEntry - handles instance, synthesis, and actualize entries
 * based on the directive type
 */
export function extractDataEntry(
  node: SyntaxNode,
): InstanceEntry | SynthesisEntry | ActualizeEntry {
  const directiveNode = getChildByField(node, "directive");
  const directive = directiveNode.text;

  if (directive === "define-synthesis") {
    return extractSynthesisEntryFromData(node);
  }
  if (directive === "actualize-synthesis") {
    return extractActualizeEntryFromData(node);
  }
  // Default: instance entry (create/update)
  return extractInstanceEntryFromData(node);
}

/**
 * Extract an InstanceEntry from a data_entry node
 */
export function extractInstanceEntryFromData(node: SyntaxNode): InstanceEntry {
  const timestampNode = getChildByField(node, "timestamp");
  const directiveNode = getChildByField(node, "directive");
  const argumentNode = getOptionalChildByField(node, "argument");
  const titleNode = getOptionalChildByField(node, "title");

  const linkNodes = getChildrenByType(node, "link");
  const tagNodes = getChildrenByType(node, "tag");
  const metadataNodes = getChildrenByType(node, "metadata");
  const contentNode = getChildByType(node, "content");

  // For instance entries, argument is the entity (identifier)
  const entityValue = argumentNode?.text || "";

  // Create a synthetic header for compatibility
  const header: InstanceHeader = {
    ...baseNode(node, "instance_header"),
    timestamp: extractTimestamp(timestampNode),
    directive: directiveNode.text as InstanceDirective,
    entity: entityValue as Entity,
    title: titleNode
      ? extractTitle(titleNode)
      : { type: "title", location: extractLocation(node), syntaxNode: node, value: "" },
    // Filter out the argument link from trailing links
    link:
      linkNodes.filter((l) => l !== argumentNode).length > 0
        ? extractLink(linkNodes.filter((l) => l !== argumentNode)[0])
        : null,
    tags: tagNodes.map(extractTag),
  };

  return {
    ...baseNode(node, "instance_entry"),
    header,
    metadata: metadataNodes.map(extractMetadata),
    content: contentNode ? extractContent(contentNode) : null,
  };
}

/**
 * Extract a SynthesisEntry from a data_entry node
 */
export function extractSynthesisEntryFromData(node: SyntaxNode): SynthesisEntry {
  const timestampNode = getChildByField(node, "timestamp");
  const titleNode = getOptionalChildByField(node, "title");
  const argumentNode = getOptionalChildByField(node, "argument");

  const linkNodes = getChildrenByType(node, "link");
  const tagNodes = getChildrenByType(node, "tag");
  const metadataNodes = getChildrenByType(node, "metadata");
  const contentNode = getChildByType(node, "content");

  // For define-synthesis, the argument is the link_id
  // The link_id is either the argument field, or the first link
  const linkIdNode = argumentNode?.type === "link" ? argumentNode : linkNodes[0];

  // Create a synthetic header for compatibility
  const header: SynthesisHeader = {
    ...baseNode(node, "synthesis_header"),
    timestamp: extractTimestamp(timestampNode),
    title: titleNode
      ? extractTitle(titleNode)
      : { type: "title", location: extractLocation(node), syntaxNode: node, value: "" },
    linkId: linkIdNode
      ? extractLink(linkIdNode)
      : { type: "link", location: extractLocation(node), syntaxNode: node, id: "" },
    // Filter out the linkId from trailing tags
    tags: tagNodes.map(extractTag),
  };

  return {
    ...baseNode(node, "synthesis_entry"),
    header,
    metadata: metadataNodes.map(extractMetadata),
    content: contentNode ? extractContent(contentNode) : null,
  };
}

/**
 * Extract an ActualizeEntry from a data_entry node
 */
export function extractActualizeEntryFromData(node: SyntaxNode): ActualizeEntry {
  const timestampNode = getChildByField(node, "timestamp");
  const argumentNode = getOptionalChildByField(node, "argument");

  const linkNodes = getChildrenByType(node, "link");
  const metadataNodes = getChildrenByType(node, "metadata");

  // For actualize-synthesis, the argument (or first link) is the target
  const targetNode = argumentNode?.type === "link" ? argumentNode : linkNodes[0];

  // Create a synthetic header for compatibility
  const header: ActualizeHeader = {
    ...baseNode(node, "actualize_header"),
    timestamp: extractTimestamp(timestampNode),
    target: targetNode
      ? extractLink(targetNode)
      : { type: "link", location: extractLocation(node), syntaxNode: node, id: "" },
  };

  return {
    ...baseNode(node, "actualize_entry"),
    header,
    metadata: metadataNodes.map(extractMetadata),
  };
}

/**
 * Extract a SchemaEntry - header fields are now inline
 */
export function extractSchemaEntry(node: SyntaxNode): SchemaEntry {
  const timestampNode = getChildByField(node, "timestamp");
  const directiveNode = getChildByField(node, "directive");
  const argumentNode = getOptionalChildByField(node, "argument");
  const titleNode = getChildByField(node, "title");

  const linkNodes = getChildrenByType(node, "link");
  const tagNodes = getChildrenByType(node, "tag");

  const metadataBlockNode = getChildByType(node, "metadata_block");
  const sectionsBlockNode = getChildByType(node, "sections_block");
  const removeMetadataBlockNode = getChildByType(node, "remove_metadata_block");
  const removeSectionsBlockNode = getChildByType(node, "remove_sections_block");

  // Create a synthetic header for compatibility
  const header: SchemaHeader = {
    ...baseNode(node, "schema_header"),
    timestamp: extractTimestamp(timestampNode),
    directive: directiveNode.text as SchemaDirective,
    entityName: argumentNode
      ? extractIdentifier(argumentNode)
      : { type: "identifier", location: extractLocation(node), syntaxNode: node, value: "" },
    title: extractTitle(titleNode),
    link: linkNodes.length > 0 ? extractLink(linkNodes[0]) : null,
    tags: tagNodes.map(extractTag),
  };

  return {
    ...baseNode(node, "schema_entry"),
    header,
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
 * Extract a TypeExpression.
 * Returns a SyntaxErrorNode if an unknown type identifier is encountered.
 */
export function extractTypeExpression(
  node: SyntaxNode,
): TypeExpression | SyntaxErrorNode<"unknown_type"> {
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
    case "unknown_type":
      return createSyntaxError(
        "unknown_type",
        `Unknown type '${child.text}'. Valid types: string, datetime, daterange, link, number`,
        child.text,
        child,
      );
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
 * Extract an ArrayType.
 * Returns a SyntaxErrorNode if the element type is unknown.
 */
export function extractArrayType(node: SyntaxNode): ArrayType | SyntaxErrorNode<"unknown_type"> {
  const child = node.namedChildren[0];
  if (!child) {
    throw new Error("Empty array_type");
  }

  let elementType: PrimitiveType | LiteralType | UnionType;
  if (child.type === "primitive_type") {
    elementType = extractPrimitiveType(child);
  } else if (child.type === "literal_type") {
    elementType = extractLiteralType(child);
  } else if (child.type === "unknown_type") {
    // Unknown element type in array - return syntax error for whole type
    return createSyntaxError(
      "unknown_type",
      `Unknown type '${child.text}'. Valid types: string, datetime, daterange, link, number`,
      node.text,
      node,
    );
  } else if (child.type === "paren_type") {
    // Parenthesized type: extract the inner type_expression
    const innerTypeExpr = child.namedChildren[0];
    if (!innerTypeExpr) {
      throw new Error("Empty paren_type");
    }
    const extracted = extractTypeExpression(innerTypeExpr);
    // Propagate syntax errors from inner type
    if (extracted.type === "syntax_error") {
      return extracted;
    }
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
 * Extract a UnionType.
 * Returns a SyntaxErrorNode if any member is an unknown type.
 */
export function extractUnionType(node: SyntaxNode): UnionType | SyntaxErrorNode<"unknown_type"> {
  const members: (PrimitiveType | LiteralType | ArrayType)[] = [];

  for (const child of node.namedChildren) {
    if (!child) {
      continue;
    } // Skip nulls
    switch (child.type) {
      case "primitive_type":
        members.push(extractPrimitiveType(child));
        break;
      case "literal_type":
        members.push(extractLiteralType(child));
        break;
      case "array_type": {
        const arrayType = extractArrayType(child);
        if (arrayType.type === "syntax_error") {
          return arrayType; // Bubble up the error
        }
        members.push(arrayType);
        break;
      }
      case "unknown_type":
        // Unknown type in union - return syntax error for whole type
        return createSyntaxError(
          "unknown_type",
          `Unknown type '${child.text}'. Valid types: string, datetime, daterange, link, number`,
          node.text,
          node,
        );
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
    if (!child) {
      continue;
    } // Skip nulls
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
  return buildTimestamp(node);
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
    // Fallback for empty or unrecognized values - treat as empty quoted value
    return {
      ...baseNode(node, "value"),
      raw: node.text.trim(),
      content: {
        ...baseNode(node, "quoted_value"),
        value: node.text.trim(),
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
    case "quoted_value":
      return extractQuotedValue(node);
    case "link":
      return {
        ...baseNode(node, "link_value"),
        link: extractLink(node),
      };
    case "datetime_value":
      return extractDatetimeValue(node);
    case "daterange":
      return {
        ...baseNode(node, "daterange"),
        raw: node.text.trim(),
      };
    case "number_value":
      return {
        ...baseNode(node, "number_value"),
        raw: node.text.trim(),
        value: parseFloat(node.text.trim()),
      };
    case "value_array":
      return extractValueArray(node);
    case "query":
      return {
        ...baseNode(node, "query_value"),
        query: extractQuery(node),
      };
    default:
      // Fallback: treat as quoted value
      return {
        ...baseNode(node, "quoted_value"),
        value: node.text.trim(),
      };
  }
}

/**
 * Extract a datetime value with its split components
 */
function extractDatetimeValue(node: SyntaxNode): DatetimeValue {
  const dateNode = node.childForFieldName("date");
  const timeNode = node.childForFieldName("time");
  const tzNode = node.childForFieldName("tz");

  return {
    ...baseNode(node, "datetime_value"),
    value: node.text.trim(),
    date: dateNode?.text ?? "",
    time: timeNode?.text ?? null,
    tz: tzNode?.text ?? null,
  };
}

function extractQuotedValue(node: SyntaxNode): QuotedValue {
  return {
    ...baseNode(node, "quoted_value"),
    value: stripQuotes(node.text),
  };
}

function extractValueArray(node: SyntaxNode): ValueArray {
  const elements: (Link | QuotedValue | DatetimeValue | DaterangeValue | NumberValue | Query)[] =
    [];

  for (const child of node.namedChildren) {
    if (!child) {
      continue;
    } // Skip nulls
    if (child.type === "link") {
      elements.push(extractLink(child));
    } else if (child.type === "quoted_value") {
      elements.push(extractQuotedValue(child));
    } else if (child.type === "datetime_value") {
      elements.push(extractDatetimeValue(child));
    } else if (child.type === "daterange") {
      elements.push({
        ...baseNode(child, "daterange"),
        raw: child.text.trim(),
      });
    } else if (child.type === "number_value") {
      elements.push({
        ...baseNode(child, "number_value"),
        raw: child.text.trim(),
        value: parseFloat(child.text.trim()),
      });
    } else if (child.type === "query") {
      elements.push(extractQuery(child));
    }
  }

  return {
    ...baseNode(node, "value_array"),
    elements,
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
      if (!child) {
        continue;
      } // Skip nulls
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
  const child = node.namedChildren[0];
  if (!child) {
    throw new Error("Empty default_value");
  }

  let content: DefaultValue["content"];
  switch (child.type) {
    case "quoted_value":
      content = extractQuotedValue(child);
      break;
    case "link":
      content = extractLink(child);
      break;
    case "datetime_value":
      content = extractDatetimeValue(child);
      break;
    case "number_value":
      content = {
        ...baseNode(child, "number_value"),
        raw: child.text.trim(),
        value: parseFloat(child.text.trim()),
      };
      break;
    default:
      throw new Error(`Unknown default_value child type: ${child.type}`);
  }

  return {
    ...baseNode(node, "default_value"),
    raw: node.text,
    content,
  };
}
