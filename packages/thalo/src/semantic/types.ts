import type { Location, SourceFile, Entry, SchemaEntry } from "../ast/types.js";
import type { SourceMap } from "../source-map.js";
import type { ParsedBlock } from "../parser.js";

// ===================
// Link Index Types
// ===================

/**
 * A link definition in an entry header.
 * Created when an entry has an explicit ^linkId in its header.
 */
export interface LinkDefinition {
  /** The link ID (without ^ prefix) */
  id: string;
  /** The file path containing this definition */
  file: string;
  /** Location of the link in the source */
  location: Location;
  /** The entry that defines this link */
  entry: Entry;
}

/**
 * A link reference in metadata or as an actualize target.
 * Created when an entry references another entry via ^linkId.
 */
export interface LinkReference {
  /** The link ID (without ^ prefix) */
  id: string;
  /** The file path containing this reference */
  file: string;
  /** Location of the link in the source */
  location: Location;
  /** The entry containing this reference */
  entry: Entry;
  /** The context where this reference appears (metadata key or "target") */
  context: string;
}

/**
 * Index for link definitions and references within a document.
 */
export interface LinkIndex {
  /** Map from link ID to its definition (if any) */
  definitions: Map<string, LinkDefinition>;
  /** Map from link ID to all references */
  references: Map<string, LinkReference[]>;
}

// ===================
// Semantic Model
// ===================

/**
 * A semantic model for a single document.
 * Contains the AST plus indexes built during semantic analysis.
 *
 * This is the per-document semantic representation. The Workspace
 * aggregates multiple SemanticModels and combines their indexes.
 */
export interface SemanticModel {
  /** The AST for this document */
  ast: SourceFile;
  /** The file path */
  file: string;
  /** The original source text */
  source: string;
  /** Source map for position translation (block-relative to file-absolute) */
  sourceMap: SourceMap;
  /** The parsed blocks (containing tree-sitter trees) for CST operations */
  blocks: ParsedBlock[];

  /**
   * Link index for this document.
   * Contains definitions and references found in this document only.
   */
  linkIndex: LinkIndex;

  /**
   * Schema entries from this document.
   * These are used by the SchemaRegistry at the workspace level
   * to build resolved entity schemas.
   */
  schemaEntries: SchemaEntry[];
}
