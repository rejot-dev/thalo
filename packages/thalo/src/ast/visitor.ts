/**
 * AST Visitor Infrastructure
 *
 * Provides a visitor pattern for traversing and processing AST nodes.
 * Supports both void visitors (for side effects) and value-returning visitors.
 *
 * @example
 * // Collecting all syntax errors from an AST
 * class ErrorCollector extends BaseVisitor<void> {
 *   errors: SyntaxErrorNode[] = [];
 *
 *   visitSyntaxError(node: SyntaxErrorNode): void {
 *     this.errors.push(node);
 *   }
 * }
 *
 * const collector = new ErrorCollector();
 * walkAst(ast, collector);
 * console.log(collector.errors);
 */

import type {
  AstNode,
  SourceFile,
  Entry,
  InstanceEntry,
  InstanceHeader,
  SchemaEntry,
  SchemaHeader,
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
  DatePart,
  TimePart,
  TimezonePart,
  Timestamp,
  Title,
  Link,
  Tag,
  Identifier,
  Key,
  Value,
  QuotedValue,
  LinkValue,
  DatetimeValue,
  DaterangeValue,
  NumberValue,
  QueryValue,
  ValueArray,
  Query,
  FieldCondition,
  TagCondition,
  LinkCondition,
  FieldName,
  SectionName,
  Description,
  DefaultValue,
  SyntaxErrorNode,
} from "./ast-types.js";

/**
 * Visitor interface with optional methods for each AST node type.
 *
 * Implement only the methods you need - unimplemented methods will
 * fall through to visitDefault (which visits children by default).
 */
export interface AstVisitor<T = void> {
  /**
   * Main entry point - dispatches to the appropriate visit method
   */
  visit(node: AstNode): T;

  // Core nodes
  visitSourceFile?(node: SourceFile): T;
  visitEntry?(node: Entry): T;

  // Entry types
  visitInstanceEntry?(node: InstanceEntry): T;
  visitSchemaEntry?(node: SchemaEntry): T;
  visitSynthesisEntry?(node: SynthesisEntry): T;
  visitActualizeEntry?(node: ActualizeEntry): T;

  // Header types
  visitInstanceHeader?(node: InstanceHeader): T;
  visitSchemaHeader?(node: SchemaHeader): T;
  visitSynthesisHeader?(node: SynthesisHeader): T;
  visitActualizeHeader?(node: ActualizeHeader): T;

  // Schema blocks
  visitMetadataBlock?(node: MetadataBlock): T;
  visitSectionsBlock?(node: SectionsBlock): T;
  visitRemoveMetadataBlock?(node: RemoveMetadataBlock): T;
  visitRemoveSectionsBlock?(node: RemoveSectionsBlock): T;

  // Field and section definitions
  visitFieldDefinition?(node: FieldDefinition): T;
  visitFieldRemoval?(node: FieldRemoval): T;
  visitSectionDefinition?(node: SectionDefinition): T;
  visitSectionRemoval?(node: SectionRemoval): T;

  // Type expressions
  visitTypeExpression?(node: TypeExpression): T;
  visitPrimitiveType?(node: PrimitiveType): T;
  visitLiteralType?(node: LiteralType): T;
  visitArrayType?(node: ArrayType): T;
  visitUnionType?(node: UnionType): T;

  // Instance entry components
  visitMetadata?(node: Metadata): T;
  visitContent?(node: Content): T;
  visitMarkdownHeader?(node: MarkdownHeader): T;
  visitContentLine?(node: ContentLine): T;

  // Timestamp parts
  visitDatePart?(node: DatePart): T;
  visitTimePart?(node: TimePart): T;
  visitTimezonePart?(node: TimezonePart): T;
  visitTimestamp?(node: Timestamp): T;

  // Terminal nodes
  visitTitle?(node: Title): T;
  visitLink?(node: Link): T;
  visitTag?(node: Tag): T;
  visitIdentifier?(node: Identifier): T;
  visitKey?(node: Key): T;
  visitValue?(node: Value): T;
  visitFieldName?(node: FieldName): T;
  visitSectionName?(node: SectionName): T;
  visitDescription?(node: Description): T;
  visitDefaultValue?(node: DefaultValue): T;

  // Value types
  visitQuotedValue?(node: QuotedValue): T;
  visitLinkValue?(node: LinkValue): T;
  visitDatetimeValue?(node: DatetimeValue): T;
  visitDaterangeValue?(node: DaterangeValue): T;
  visitNumberValue?(node: NumberValue): T;
  visitQueryValue?(node: QueryValue): T;
  visitValueArray?(node: ValueArray): T;

  // Query types
  visitQuery?(node: Query): T;
  visitFieldCondition?(node: FieldCondition): T;
  visitTagCondition?(node: TagCondition): T;
  visitLinkCondition?(node: LinkCondition): T;

  // Error nodes
  visitSyntaxError?(node: SyntaxErrorNode): T;
}

/**
 * Convert a snake_case type name to PascalCase method name
 * e.g., "source_file" -> "SourceFile"
 */
function toPascalCase(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Get the visitor method name for a node type
 * e.g., "source_file" -> "visitSourceFile"
 */
function getVisitorMethodName(type: string): string {
  return `visit${toPascalCase(type)}`;
}

/**
 * Get all child nodes of an AST node.
 *
 * This function knows the structure of each AST node type and returns
 * all child nodes in a consistent order.
 */
export function getChildren(node: AstNode): AstNode[] {
  const children: AstNode[] = [];

  switch (node.type) {
    case "source_file":
      children.push(...(node as SourceFile).entries);
      break;

    case "instance_entry": {
      const n = node as InstanceEntry;
      children.push(n.header);
      children.push(...n.metadata);
      if (n.content) {
        children.push(n.content);
      }
      break;
    }

    case "schema_entry": {
      const n = node as SchemaEntry;
      children.push(n.header);
      if (n.metadataBlock) {
        children.push(n.metadataBlock);
      }
      if (n.sectionsBlock) {
        children.push(n.sectionsBlock);
      }
      if (n.removeMetadataBlock) {
        children.push(n.removeMetadataBlock);
      }
      if (n.removeSectionsBlock) {
        children.push(n.removeSectionsBlock);
      }
      break;
    }

    case "synthesis_entry": {
      const n = node as SynthesisEntry;
      children.push(n.header);
      children.push(...n.metadata);
      if (n.content) {
        children.push(n.content);
      }
      break;
    }

    case "actualize_entry": {
      const n = node as ActualizeEntry;
      children.push(n.header);
      children.push(...n.metadata);
      break;
    }

    case "instance_header": {
      const n = node as InstanceHeader;
      children.push(n.timestamp);
      children.push(n.title);
      if (n.link) {
        children.push(n.link);
      }
      children.push(...n.tags);
      break;
    }

    case "schema_header": {
      const n = node as SchemaHeader;
      children.push(n.timestamp);
      children.push(n.entityName);
      children.push(n.title);
      if (n.link) {
        children.push(n.link);
      }
      children.push(...n.tags);
      break;
    }

    case "synthesis_header": {
      const n = node as SynthesisHeader;
      children.push(n.timestamp);
      children.push(n.title);
      children.push(n.linkId);
      children.push(...n.tags);
      break;
    }

    case "actualize_header": {
      const n = node as ActualizeHeader;
      children.push(n.timestamp);
      children.push(n.target);
      break;
    }

    case "metadata_block":
      children.push(...(node as MetadataBlock).fields);
      break;

    case "sections_block":
      children.push(...(node as SectionsBlock).sections);
      break;

    case "remove_metadata_block":
      children.push(...(node as RemoveMetadataBlock).fields);
      break;

    case "remove_sections_block":
      children.push(...(node as RemoveSectionsBlock).sections);
      break;

    case "field_definition": {
      const n = node as FieldDefinition;
      children.push(n.name);
      children.push(n.typeExpr);
      if (n.defaultValue) {
        children.push(n.defaultValue);
      }
      if (n.description) {
        children.push(n.description);
      }
      break;
    }

    case "field_removal": {
      const n = node as FieldRemoval;
      children.push(n.name);
      if (n.reason) {
        children.push(n.reason);
      }
      break;
    }

    case "section_definition": {
      const n = node as SectionDefinition;
      children.push(n.name);
      if (n.description) {
        children.push(n.description);
      }
      break;
    }

    case "section_removal": {
      const n = node as SectionRemoval;
      children.push(n.name);
      if (n.reason) {
        children.push(n.reason);
      }
      break;
    }

    case "array_type":
      children.push((node as ArrayType).elementType);
      break;

    case "union_type":
      children.push(...(node as UnionType).members);
      break;

    case "metadata": {
      const n = node as Metadata;
      children.push(n.key);
      children.push(n.value);
      break;
    }

    case "content":
      children.push(...(node as Content).children);
      break;

    case "timestamp": {
      const n = node as Timestamp;
      if (n.date) {
        children.push(n.date);
      }
      if (n.time) {
        children.push(n.time);
      }
      if (n.timezone) {
        children.push(n.timezone);
      }
      break;
    }

    case "value": {
      const n = node as Value;
      children.push(n.content);
      break;
    }

    case "default_value": {
      const n = node as DefaultValue;
      children.push(n.content);
      break;
    }

    case "link_value":
      children.push((node as LinkValue).link);
      break;

    case "query_value":
      children.push((node as QueryValue).query);
      break;

    case "value_array":
      children.push(...(node as ValueArray).elements);
      break;

    case "query":
      children.push(...(node as Query).conditions);
      break;

    // Terminal nodes - no children
    case "primitive_type":
    case "literal_type":
    case "markdown_header":
    case "content_line":
    case "date_part":
    case "time_part":
    case "timezone_part":
    case "title":
    case "link":
    case "tag":
    case "identifier":
    case "key":
    case "field_name":
    case "section_name":
    case "description":
    case "quoted_value":
    case "datetime_value":
    case "daterange":
    case "number_value":
    case "field_condition":
    case "tag_condition":
    case "link_condition":
    case "syntax_error":
      // No children
      break;
  }

  return children;
}

/**
 * Abstract base visitor with default dispatch behavior.
 *
 * Subclasses can override specific visit methods and call super.visit()
 * to continue traversal to children.
 *
 * @example
 * class CountNodes extends BaseVisitor<void> {
 *   count = 0;
 *
 *   protected visitDefault(node: AstNode): void {
 *     this.count++;
 *     super.visitDefault(node); // Continue to children
 *   }
 * }
 */
export abstract class BaseVisitor<T = void> implements AstVisitor<T> {
  /**
   * Main dispatch method - routes to the appropriate visit method based on node type.
   */
  visit(node: AstNode): T {
    const methodName = getVisitorMethodName(node.type);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const method = (this as any)[methodName];

    if (typeof method === "function") {
      return method.call(this, node);
    }

    return this.visitDefault(node);
  }

  /**
   * Default handler for nodes without a specific visit method.
   * By default, visits all children.
   *
   * Override this to change the default behavior.
   */
  protected visitDefault(node: AstNode): T {
    const children = getChildren(node);
    for (const child of children) {
      this.visit(child);
    }
    return undefined as T;
  }
}

/**
 * Walk an AST with a visitor, starting from the given node.
 *
 * This is a convenience function that calls visitor.visit(node).
 *
 * @param node - The root node to start traversal from
 * @param visitor - The visitor to use for traversal
 * @returns The result of visiting the root node
 *
 * @example
 * const errorCollector = new ErrorCollector();
 * walkAst(sourceFile, errorCollector);
 */
export function walkAst<T>(node: AstNode, visitor: AstVisitor<T>): T {
  return visitor.visit(node);
}

/**
 * Walk an AST with a callback for each node.
 *
 * This is a simpler alternative to creating a visitor class.
 *
 * @param node - The root node to start traversal from
 * @param callback - Called for each node in depth-first order
 *
 * @example
 * forEachNode(sourceFile, (node) => {
 *   if (node.type === "syntax_error") {
 *     console.log("Found error:", node);
 *   }
 * });
 */
export function forEachNode(node: AstNode, callback: (node: AstNode) => void): void {
  callback(node);
  const children = getChildren(node);
  for (const child of children) {
    forEachNode(child, callback);
  }
}

/**
 * Collect all nodes of a specific type from an AST.
 *
 * @param node - The root node to search from
 * @param type - The node type to collect (e.g., "syntax_error", "link")
 * @returns Array of nodes matching the type
 *
 * @example
 * const links = collectNodes(sourceFile, "link");
 * const errors = collectNodes(sourceFile, "syntax_error");
 */
export function collectNodes<N extends AstNode>(root: AstNode, type: string): N[] {
  const results: N[] = [];
  forEachNode(root, (node) => {
    if (node.type === type) {
      results.push(node as N);
    }
  });
  return results;
}

/**
 * Collect all syntax errors from an AST.
 *
 * @param root - The root node to search from
 * @returns Array of SyntaxErrorNode instances
 */
export function collectSyntaxErrors(root: AstNode): SyntaxErrorNode[] {
  return collectNodes<SyntaxErrorNode>(root, "syntax_error");
}
