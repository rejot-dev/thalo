import type { SyntaxNode, Point } from "tree-sitter";

/**
 * Location information for an AST node
 */
export interface Location {
  startIndex: number;
  endIndex: number;
  startPosition: Point;
  endPosition: Point;
}

/**
 * Base interface for all AST nodes
 */
export interface AstNode {
  type: string;
  location: Location;
  /** The underlying tree-sitter node */
  syntaxNode: SyntaxNode;
}

// ===================
// Source File
// ===================

export interface SourceFile extends AstNode {
  type: "source_file";
  entries: Entry[];
}

// ===================
// Entries
// ===================

export type Entry = InstanceEntry | SchemaEntry | SynthesisEntry | ActualizeEntry;

// ===================
// Instance Entries (create/update)
// ===================

export interface InstanceEntry extends AstNode {
  type: "instance_entry";
  header: InstanceHeader;
  metadata: Metadata[];
  content: Content | null;
}

export interface InstanceHeader extends AstNode {
  type: "instance_header";
  timestamp: Timestamp;
  directive: InstanceDirective;
  entity: Entity;
  title: Title;
  link: Link | null;
  tags: Tag[];
}

export type InstanceDirective = "create" | "update";

export type Entity = "lore" | "opinion" | "reference" | "journal";

// ===================
// Schema Entries (define-entity/alter-entity)
// ===================

export interface SchemaEntry extends AstNode {
  type: "schema_entry";
  header: SchemaHeader;
  metadataBlock: MetadataBlock | null;
  sectionsBlock: SectionsBlock | null;
  removeMetadataBlock: RemoveMetadataBlock | null;
  removeSectionsBlock: RemoveSectionsBlock | null;
}

export interface SchemaHeader extends AstNode {
  type: "schema_header";
  timestamp: Timestamp;
  directive: SchemaDirective;
  entityName: Identifier;
  title: Title;
  link: Link | null;
  tags: Tag[];
}

export type SchemaDirective = "define-entity" | "alter-entity";

// ===================
// Synthesis Entries (define-synthesis)
// ===================

export interface SynthesisEntry extends AstNode {
  type: "synthesis_entry";
  header: SynthesisHeader;
  metadata: Metadata[];
  content: Content | null;
}

export interface SynthesisHeader extends AstNode {
  type: "synthesis_header";
  timestamp: Timestamp;
  title: Title;
  linkId: Link;
  tags: Tag[];
}

// ===================
// Actualize Entries (actualize-synthesis)
// ===================

export interface ActualizeEntry extends AstNode {
  type: "actualize_entry";
  header: ActualizeHeader;
  metadata: Metadata[];
}

export interface ActualizeHeader extends AstNode {
  type: "actualize_header";
  timestamp: Timestamp;
  target: Link;
}

// ===================
// Schema Blocks
// ===================

export interface MetadataBlock extends AstNode {
  type: "metadata_block";
  fields: FieldDefinition[];
}

export interface SectionsBlock extends AstNode {
  type: "sections_block";
  sections: SectionDefinition[];
}

export interface RemoveMetadataBlock extends AstNode {
  type: "remove_metadata_block";
  fields: FieldRemoval[];
}

export interface RemoveSectionsBlock extends AstNode {
  type: "remove_sections_block";
  sections: SectionRemoval[];
}

// ===================
// Field Definitions
// ===================

export interface FieldDefinition extends AstNode {
  type: "field_definition";
  name: FieldName;
  optional: boolean;
  typeExpr: TypeExpression;
  defaultValue: DefaultValue | null;
  description: Description | null;
}

export interface FieldRemoval extends AstNode {
  type: "field_removal";
  name: FieldName;
  reason: Description | null;
}

// ===================
// Section Definitions
// ===================

export interface SectionDefinition extends AstNode {
  type: "section_definition";
  name: SectionName;
  optional: boolean;
  description: Description | null;
}

export interface SectionRemoval extends AstNode {
  type: "section_removal";
  name: SectionName;
  reason: Description | null;
}

// ===================
// Type Expressions
// ===================

export type TypeExpression = PrimitiveType | LiteralType | ArrayType | UnionType;

export interface PrimitiveType extends AstNode {
  type: "primitive_type";
  name: "string" | "date" | "date-range" | "link";
}

export interface LiteralType extends AstNode {
  type: "literal_type";
  value: string;
}

export interface ArrayType extends AstNode {
  type: "array_type";
  elementType: PrimitiveType | LiteralType | UnionType;
}

export interface UnionType extends AstNode {
  type: "union_type";
  members: (PrimitiveType | LiteralType | ArrayType)[];
}

// ===================
// Metadata (instance entries)
// ===================

export interface Metadata extends AstNode {
  type: "metadata";
  key: Key;
  value: Value;
}

// ===================
// Content (instance entries)
// ===================

export interface Content extends AstNode {
  type: "content";
  children: (MarkdownHeader | ContentLine)[];
}

export interface MarkdownHeader extends AstNode {
  type: "markdown_header";
  text: string;
}

export interface ContentLine extends AstNode {
  type: "content_line";
  text: string;
}

// ===================
// Terminal Nodes
// ===================

export interface Timestamp extends AstNode {
  type: "timestamp";
  value: string;
}

export interface Title extends AstNode {
  type: "title";
  /** The title text without surrounding quotes */
  value: string;
}

export interface Link extends AstNode {
  type: "link";
  /** The link ID without the ^ prefix */
  id: string;
}

export interface Tag extends AstNode {
  type: "tag";
  /** The tag name without the # prefix */
  name: string;
}

export interface Identifier extends AstNode {
  type: "identifier";
  value: string;
}

export interface Key extends AstNode {
  type: "key";
  value: string;
}

export interface Value extends AstNode {
  type: "value";
  /** The raw value text */
  raw: string;
  /** The typed value content */
  content: ValueContent;
}

/**
 * Typed value content from the grammar
 */
export type ValueContent =
  | PlainValue
  | QuotedValue
  | LinkValue
  | DateRangeValue
  | ValueArray
  | QueryList;

export interface PlainValue extends AstNode {
  type: "plain_value";
  /** The individual words that make up the value */
  words: string[];
  /** Combined text of all words */
  text: string;
}

export interface QuotedValue extends AstNode {
  type: "quoted_value";
  /** The quoted text without surrounding quotes */
  value: string;
}

export interface LinkValue extends AstNode {
  type: "link_value";
  /** The parsed link */
  link: Link;
}

export interface DateRangeValue extends AstNode {
  type: "date_range";
  /** The raw date range text */
  raw: string;
}

export interface ValueArray extends AstNode {
  type: "value_array";
  /** Elements of the array (links or quoted values) */
  elements: (Link | QuotedValue)[];
}

export interface QueryList extends AstNode {
  type: "query_list";
  /** The individual queries */
  queries: Query[];
}

export interface Query extends AstNode {
  type: "query";
  /** The entity type to query */
  entity: string;
  /** The conditions (ANDed together) */
  conditions: QueryCondition[];
}

export type QueryCondition = FieldCondition | TagCondition | LinkCondition;

export interface FieldCondition extends AstNode {
  type: "field_condition";
  /** The field name */
  field: string;
  /** The field value */
  value: string;
}

export interface TagCondition extends AstNode {
  type: "tag_condition";
  /** The tag (without #) */
  tag: string;
}

export interface LinkCondition extends AstNode {
  type: "link_condition";
  /** The link (without ^) */
  linkId: string;
}

export interface FieldName extends AstNode {
  type: "field_name";
  value: string;
}

export interface SectionName extends AstNode {
  type: "section_name";
  value: string;
}

export interface Description extends AstNode {
  type: "description";
  /** The description text without surrounding quotes */
  value: string;
}

export interface DefaultValue extends AstNode {
  type: "default_value";
  /** The raw default value text */
  raw: string;
  /** If the default is a literal type, the parsed literal */
  literal: LiteralType | null;
}
