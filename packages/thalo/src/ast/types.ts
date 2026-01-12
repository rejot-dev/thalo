/**
 * Tree-sitter Point interface (row and column).
 *
 * Compatible with both tree-sitter (native) and web-tree-sitter (web).
 */
export interface Point {
  row: number;
  column: number;
}

/**
 * Minimal SyntaxNode interface compatible with both tree-sitter and web-tree-sitter.
 *
 * This interface represents the common subset of properties and methods available
 * in both tree-sitter's `SyntaxNode` and web-tree-sitter's `Node`.
 *
 * We define our own interface rather than importing from tree-sitter because:
 * 1. tree-sitter is a peer dependency, not a regular dependency
 * 2. The native and web versions have slightly different interfaces
 * 3. We only need a minimal subset of the full tree-sitter API
 *
 * Note: In web-tree-sitter, namedChildren, children, and childrenForFieldName can
 * contain null values. Native tree-sitter doesn't include nulls, but the type
 * `(SyntaxNode | null)[]` is compatible with `SyntaxNode[]` (contravariance).
 * Code should filter out nulls when needed using `.filter((c): c is SyntaxNode => c !== null)`.
 */
export interface SyntaxNode {
  readonly id: number;
  readonly type: string;
  readonly text: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly startPosition: Point;
  readonly endPosition: Point;
  readonly namedChildren: readonly (SyntaxNode | null)[];
  readonly children: readonly (SyntaxNode | null)[];
  readonly parent: SyntaxNode | null;
  childForFieldName(fieldName: string): SyntaxNode | null;
  childrenForFieldName(fieldName: string): (SyntaxNode | null)[];
  descendantForPosition(start: Point, end?: Point): SyntaxNode | null;
  descendantsOfType(
    type: string | string[],
    startPosition?: Point,
    endPosition?: Point,
  ): (SyntaxNode | null)[];
  readonly hasError: boolean;
}

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
// Syntax Errors
// ===================

/**
 * Known syntax error codes that can be emitted by the AST builder.
 * These represent recoverable syntax errors where we can still produce a partial AST.
 */
export type SyntaxErrorCode =
  | "missing_timezone"
  | "missing_entity"
  | "missing_title"
  | "missing_link_id"
  | "invalid_directive"
  | "invalid_timestamp"
  | "malformed_metadata"
  | "parse_error";

/**
 * A syntax error node that can appear inline in the AST.
 * Represents recoverable syntax errors that don't prevent further parsing.
 *
 * @example
 * // A timestamp without timezone would have:
 * timestamp: {
 *   type: "timestamp",
 *   value: "2026-01-05T18:00",
 *   date: { ... },
 *   time: { ... },
 *   timezone: {
 *     type: "syntax_error",
 *     code: "missing_timezone",
 *     message: "Timestamp requires timezone",
 *     text: "2026-01-05T18:00"
 *   }
 * }
 */
export interface SyntaxErrorNode<Code extends SyntaxErrorCode = SyntaxErrorCode> extends AstNode {
  type: "syntax_error";
  /** The specific error code */
  code: Code;
  /** Human-readable error message */
  message: string;
  /** The malformed source text that caused the error */
  text: string;
}

/**
 * Result type for AST nodes that may contain syntax errors.
 * Used to represent optional or validated fields that can fail gracefully.
 *
 * @example
 * // In Timestamp type:
 * timezone: Result<TimezonePart, "missing_timezone">
 * // Can be either a valid TimezonePart or a SyntaxErrorNode with code "missing_timezone"
 */
export type Result<T, E extends SyntaxErrorCode> = T | SyntaxErrorNode<E>;

/**
 * Type guard to check if a Result is a SyntaxErrorNode
 */
export function isSyntaxError<T, E extends SyntaxErrorCode>(
  result: Result<T, E>,
): result is SyntaxErrorNode<E> {
  return (result as SyntaxErrorNode).type === "syntax_error";
}

/**
 * Type guard to check if a Result is a valid value (not a SyntaxErrorNode)
 */
export function isValidResult<T, E extends SyntaxErrorCode>(result: Result<T, E>): result is T {
  return (result as SyntaxErrorNode).type !== "syntax_error";
}

// ===================
// Source File
// ===================

export interface SourceFile extends AstNode {
  type: "source_file";
  entries: Entry[];
  /** Root-level syntax errors (malformed entries that couldn't be parsed) */
  syntaxErrors: SyntaxErrorNode[];
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
  name: "string" | "datetime" | "date-range" | "link";
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

// ===================
// Timestamp Parts (decomposed)
// ===================

/**
 * The date portion of a timestamp (YYYY-MM-DD)
 */
export interface DatePart extends AstNode {
  type: "date_part";
  year: number;
  month: number;
  day: number;
  /** The formatted date string (YYYY-MM-DD) */
  value: string;
}

/**
 * The time portion of a timestamp (HH:MM)
 */
export interface TimePart extends AstNode {
  type: "time_part";
  hour: number;
  minute: number;
  /** The formatted time string (HH:MM) */
  value: string;
}

/**
 * The timezone portion of a timestamp (e.g., "Z", "+05:30", "-08:00")
 */
export interface TimezonePart extends AstNode {
  type: "timezone_part";
  /** The timezone string (e.g., "Z", "+05:30", "-08:00") */
  value: string;
  /** Offset from UTC in minutes (0 for Z, positive for east, negative for west) */
  offsetMinutes: number;
}

/**
 * A timestamp value with decomposed parts.
 *
 * The timezone can be a SyntaxErrorNode if missing.
 *
 * @example
 * // Fully decomposed timestamp:
 * {
 *   type: "timestamp",
 *   value: "2026-01-05T18:00Z",
 *   date: { type: "date_part", year: 2026, month: 1, day: 5, value: "2026-01-05", ... },
 *   time: { type: "time_part", hour: 18, minute: 0, value: "18:00", ... },
 *   timezone: { type: "timezone_part", value: "Z", offsetMinutes: 0, ... }
 * }
 *
 * @example
 * // Timestamp with missing timezone (syntax error):
 * {
 *   type: "timestamp",
 *   value: "2026-01-05T18:00",
 *   date: { ... },
 *   time: { ... },
 *   timezone: { type: "syntax_error", code: "missing_timezone", message: "...", text: "..." }
 * }
 */
export interface Timestamp extends AstNode {
  type: "timestamp";
  /** The full timestamp string */
  value: string;
  /** Decomposed date part */
  date: DatePart;
  /** Decomposed time part */
  time: TimePart;
  /** Decomposed timezone part, or SyntaxErrorNode if missing */
  timezone: Result<TimezonePart, "missing_timezone">;
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
 * Typed value content from the grammar.
 * All values must be explicitly typed (no plain/unquoted values).
 */
export type ValueContent =
  | QuotedValue
  | LinkValue
  | DatetimeValue
  | DateRangeValue
  | QueryValue
  | ValueArray;

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

export interface DatetimeValue extends AstNode {
  type: "datetime_value";
  /** The datetime value (YYYY-MM-DD or YYYY-MM-DDTHH:MM) */
  value: string;
}

export interface DateRangeValue extends AstNode {
  type: "date_range";
  /** The raw date range text */
  raw: string;
}

export interface QueryValue extends AstNode {
  type: "query_value";
  /** The parsed query */
  query: Query;
}

export interface ValueArray extends AstNode {
  type: "value_array";
  /** Elements of the array (links, quoted values, datetimes, date ranges, or queries) */
  elements: (Link | QuotedValue | DatetimeValue | DateRangeValue | Query)[];
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
  /** The typed value content (quoted_value, link, or datetime) */
  content: QuotedValue | Link | DatetimeValue;
}
