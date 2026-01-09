import type { Location } from "../ast/types.js";
import type { SourceMap } from "../source-map.js";

// ===================
// Schema Entry Types (used by SchemaRegistry)
// ===================

/**
 * A schema entry (define-entity/alter-entity)
 */
export interface ModelSchemaEntry {
  kind: "schema";
  /** The timestamp from the header */
  timestamp: string;
  /** The directive (define-entity or alter-entity) */
  directive: "define-entity" | "alter-entity";
  /** The entity name being defined/altered */
  entityName: string;
  /** The title/description */
  title: string;
  /** Explicit link ID from header (if any) */
  linkId: string | null;
  /** Tags from the header */
  tags: string[];
  /** Field definitions (for define/alter) */
  fields: ModelFieldDefinition[];
  /** Section definitions (for define/alter) */
  sections: ModelSectionDefinition[];
  /** Field removals (for alter) */
  removeFields: string[];
  /** Section removals (for alter) */
  removeSections: string[];
  /** Location in source (block-relative) */
  location: Location;
  /** The file path containing this entry */
  file: string;
  /** Source map for translating block-relative to file-absolute positions */
  sourceMap: SourceMap;
}

/**
 * A field definition from a schema entry
 */
export interface ModelFieldDefinition {
  name: string;
  optional: boolean;
  type: ModelTypeExpression;
  /** The typed default value content (quoted, link, or datetime) */
  defaultValue: ModelDefaultValue | null;
  description: string | null;
  location: Location;
}

/**
 * A typed default value from a field definition.
 * Can be a quoted string, link reference, or datetime.
 */
export type ModelDefaultValue =
  | { kind: "quoted"; value: string; raw: string }
  | { kind: "link"; id: string; raw: string }
  | { kind: "datetime"; value: string; raw: string };

/**
 * A section definition from a schema entry
 */
export interface ModelSectionDefinition {
  name: string;
  optional: boolean;
  description: string | null;
  location: Location;
}

/**
 * Type expressions in field definitions
 */
export type ModelTypeExpression =
  | ModelPrimitiveType
  | ModelLiteralType
  | ModelArrayType
  | ModelUnionType;

export interface ModelPrimitiveType {
  kind: "primitive";
  name: "string" | "datetime" | "date-range" | "link";
}

export interface ModelLiteralType {
  kind: "literal";
  value: string;
}

export interface ModelArrayType {
  kind: "array";
  elementType: ModelPrimitiveType | ModelLiteralType | ModelUnionType;
}

export interface ModelUnionType {
  kind: "union";
  members: (ModelPrimitiveType | ModelLiteralType | ModelArrayType)[];
}

// ===================
// Query Types
// ===================

/**
 * A parsed query for filtering entries
 * Example: "lore where subject = ^self and #career"
 */
export interface Query {
  /** The entity type to query (lore, opinion, etc.) */
  entity: string;
  /** Filter conditions (ANDed together) */
  conditions: QueryCondition[];
}

/**
 * A single condition in a query
 */
export type QueryCondition = FieldCondition | TagCondition | LinkCondition;

/**
 * A field equality condition: field = value
 */
export interface FieldCondition {
  kind: "field";
  field: string;
  value: string;
}

/**
 * A tag condition: #tag (entry must have this tag)
 */
export interface TagCondition {
  kind: "tag";
  tag: string;
}

/**
 * A link condition: ^link (entry must have this link)
 */
export interface LinkCondition {
  kind: "link";
  link: string;
}
