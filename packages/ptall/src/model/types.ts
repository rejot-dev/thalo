import type { Location } from "../ast/types.js";

// ===================
// Model Types
// ===================

/**
 * A link definition in an entry header
 */
export interface LinkDefinition {
  /** The link ID (without ^ prefix) */
  id: string;
  /** The file path containing this definition */
  file: string;
  /** Location of the link in the source */
  location: Location;
  /** The entry that defines this link */
  entry: ModelEntry;
}

/**
 * A link reference in metadata
 */
export interface LinkReference {
  /** The link ID (without ^ prefix) */
  id: string;
  /** The file path containing this reference */
  file: string;
  /** Location of the link in the source */
  location: Location;
  /** The entry containing this reference */
  entry: ModelEntry;
  /** The metadata key where this reference appears */
  metadataKey: string;
}

/**
 * Index for link definitions and references
 */
export interface LinkIndex {
  /** Map from link ID to its definition (if any) */
  definitions: Map<string, LinkDefinition>;
  /** Map from link ID to all references */
  references: Map<string, LinkReference[]>;
}

// ===================
// Entry Types
// ===================

export type ModelEntry = ModelInstanceEntry | ModelSchemaEntry;

/**
 * An instance entry (create/update lore, opinion, etc.)
 */
export interface ModelInstanceEntry {
  kind: "instance";
  /** The timestamp from the header */
  timestamp: string;
  /** The directive (create or update) */
  directive: "create" | "update";
  /** The entity type (lore, opinion, etc.) */
  entity: string;
  /** The title text */
  title: string;
  /** Explicit link ID from header (if any) */
  linkId: string | null;
  /** Tags from the header */
  tags: string[];
  /** Metadata key-value pairs */
  metadata: Map<string, MetadataValue>;
  /** Section names found in content */
  sections: string[];
  /** Location in source */
  location: Location;
  /** The file path containing this entry */
  file: string;
  /** Offset in the file (for markdown extraction) */
  blockOffset: number;
}

/**
 * A metadata value
 */
export interface MetadataValue {
  /** The raw value text */
  raw: string;
  /** If the value is a link, the link ID (without ^) */
  linkId: string | null;
  /** Location in source */
  location: Location;
}

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
  /** Location in source */
  location: Location;
  /** The file path containing this entry */
  file: string;
  /** Offset in the file (for markdown extraction) */
  blockOffset: number;
}

/**
 * A field definition from a schema entry
 */
export interface ModelFieldDefinition {
  name: string;
  optional: boolean;
  type: ModelTypeExpression;
  defaultValue: string | null;
  description: string | null;
  location: Location;
}

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
  name: "string" | "date" | "date-range" | "link";
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
