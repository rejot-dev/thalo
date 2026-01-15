import type { SourceFile, Entry, SchemaEntry, Metadata, Location } from "../ast/ast-types.js";
import type { SourceMap } from "../source-map.js";
import type { ParsedBlock, GenericTree } from "../parser.shared.js";

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
  blocks: ParsedBlock<GenericTree>[];

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

  /**
   * Dirty flags for incremental updates.
   * When true, the corresponding index needs to be rebuilt.
   */
  dirty?: SemanticModelDirtyFlags;
}

/**
 * Dirty flags indicating which parts of the semantic model need rebuilding.
 */
export interface SemanticModelDirtyFlags {
  /** Link index needs rebuild (definitions or references changed) */
  linkIndex: boolean;
  /** Schema entries need re-extraction (schema entries changed) */
  schemaEntries: boolean;
}

/**
 * Result of an incremental semantic model update.
 */
export interface SemanticUpdateResult {
  /** Link IDs that were added (new definitions) */
  addedLinkDefinitions: string[];
  /** Link IDs that were removed (deleted definitions) */
  removedLinkDefinitions: string[];
  /** Link IDs whose references changed */
  changedLinkReferences: string[];
  /** Whether schema entries changed */
  schemaEntriesChanged: boolean;
  /** Entity names whose schema definitions changed */
  changedEntityNames: string[];
}

/**
 * Options for analyzing a document
 */
export interface AnalyzeOptions {
  /** The file path for this document */
  file: string;
  /** The original source text */
  source: string;
  /** Source map for position translation */
  sourceMap: SourceMap;
  /** The parsed blocks (containing tree-sitter trees) */
  blocks: ParsedBlock<GenericTree>[];
}

/**
 * Analyze an AST to produce a SemanticModel.
 *
 * This function traverses the AST and builds indexes:
 * - Link definitions (entries with explicit ^linkId)
 * - Link references (^linkId in metadata values or actualize targets)
 * - Schema entries for later resolution by SchemaRegistry
 */
export function analyze(ast: SourceFile, options: AnalyzeOptions): SemanticModel {
  const { file, source, sourceMap, blocks } = options;

  return {
    ast,
    file,
    source,
    sourceMap,
    blocks,
    linkIndex: buildLinkIndex(ast, file),
    schemaEntries: collectSchemaEntries(ast),
  };
}

/**
 * Build a link index from an AST.
 * Iterates over all entries and indexes link definitions and references.
 */
function buildLinkIndex(ast: SourceFile, file: string): LinkIndex {
  const definitions = new Map<string, LinkDefinition>();
  const references = new Map<string, LinkReference[]>();

  for (const entry of ast.entries) {
    indexEntryLinks(entry, file, definitions, references);
  }

  return { definitions, references };
}

/**
 * Index all links from an entry.
 */
function indexEntryLinks(
  entry: Entry,
  file: string,
  definitions: Map<string, LinkDefinition>,
  references: Map<string, LinkReference[]>,
): void {
  // Index header link definition
  const linkDef = getEntryLinkDefinition(entry);
  if (linkDef) {
    definitions.set(linkDef.id, {
      id: linkDef.id,
      file,
      location: linkDef.location,
      entry,
    });
  }

  // Index references based on entry type
  if (entry.type === "instance_entry" || entry.type === "synthesis_entry") {
    indexMetadataLinks(entry.metadata, entry, file, references);
  } else if (entry.type === "actualize_entry") {
    // Actualize target is a reference
    addReference(references, {
      id: entry.header.target.id,
      file,
      location: entry.header.target.location,
      entry,
      context: "target",
    });
    indexMetadataLinks(entry.metadata, entry, file, references);
  }
}

/**
 * Get the link definition from an entry's header (if any).
 */
function getEntryLinkDefinition(
  entry: Entry,
): { id: string; location: import("../ast/ast-types.js").Location } | null {
  switch (entry.type) {
    case "instance_entry":
      return entry.header.link
        ? { id: entry.header.link.id, location: entry.header.link.location }
        : null;
    case "schema_entry":
      return entry.header.link
        ? { id: entry.header.link.id, location: entry.header.link.location }
        : null;
    case "synthesis_entry":
      return { id: entry.header.linkId.id, location: entry.header.linkId.location };
    case "actualize_entry":
      return null; // Actualize entries don't define links
  }
}

/**
 * Index link references from metadata values.
 */
function indexMetadataLinks(
  metadata: Metadata[],
  entry: Entry,
  file: string,
  references: Map<string, LinkReference[]>,
): void {
  for (const m of metadata) {
    const content = m.value.content;

    if (content.type === "link_value") {
      addReference(references, {
        id: content.link.id,
        file,
        location: content.link.location,
        entry,
        context: m.key.value,
      });
    } else if (content.type === "value_array") {
      for (const element of content.elements) {
        if (element.type === "link") {
          addReference(references, {
            id: element.id,
            file,
            location: element.location,
            entry,
            context: m.key.value,
          });
        }
      }
    }
  }
}

/**
 * Add a reference to the references map.
 */
function addReference(references: Map<string, LinkReference[]>, ref: LinkReference): void {
  const refs = references.get(ref.id) ?? [];
  refs.push(ref);
  references.set(ref.id, refs);
}

/**
 * Collect all schema entries from an AST.
 */
function collectSchemaEntries(ast: SourceFile): SchemaEntry[] {
  return ast.entries.filter((e): e is SchemaEntry => e.type === "schema_entry");
}

// ===================
// Incremental Updates
// ===================

/**
 * Update a semantic model incrementally when the AST changes.
 *
 * This function compares the old and new ASTs, identifies what changed,
 * and updates the model's indexes accordingly. This is more efficient
 * than rebuilding the entire model from scratch.
 *
 * @param model - The existing semantic model to update
 * @param newAst - The new AST after changes
 * @param newSource - The new source text
 * @param newSourceMap - The new source map
 * @param newBlocks - The new parsed blocks
 * @returns Information about what changed
 */
export function updateSemanticModel(
  model: SemanticModel,
  newAst: SourceFile,
  newSource: string,
  newSourceMap: SourceMap,
  newBlocks: ParsedBlock<GenericTree>[],
): SemanticUpdateResult {
  const oldAst = model.ast;
  const file = model.file;

  // Track what changed
  const result: SemanticUpdateResult = {
    addedLinkDefinitions: [],
    removedLinkDefinitions: [],
    changedLinkReferences: [],
    schemaEntriesChanged: false,
    changedEntityNames: [],
  };

  // Build entry sets for comparison (using position as identity)
  const oldEntryKeys = new Set(oldAst.entries.map(entryKey));
  const newEntryKeys = new Set(newAst.entries.map(entryKey));

  // Find added and removed entries
  const addedEntries: Entry[] = [];
  const removedEntries: Entry[] = [];

  for (const entry of oldAst.entries) {
    if (!newEntryKeys.has(entryKey(entry))) {
      removedEntries.push(entry);
    }
  }

  for (const entry of newAst.entries) {
    if (!oldEntryKeys.has(entryKey(entry))) {
      addedEntries.push(entry);
    }
  }

  // Update link index
  const linkResult = updateLinkIndex(model.linkIndex, file, removedEntries, addedEntries);
  result.addedLinkDefinitions = linkResult.addedDefinitions;
  result.removedLinkDefinitions = linkResult.removedDefinitions;
  result.changedLinkReferences = linkResult.changedReferences;

  // Update schema entries
  const oldSchemaEntries = model.schemaEntries;
  const newSchemaEntries = collectSchemaEntries(newAst);

  // Check if schema entries changed
  if (!schemaEntriesEqual(oldSchemaEntries, newSchemaEntries)) {
    result.schemaEntriesChanged = true;

    // Find changed entity names
    const oldEntityNames = new Set(oldSchemaEntries.map((e) => e.header.entityName.value));
    const newEntityNames = new Set(newSchemaEntries.map((e) => e.header.entityName.value));

    for (const name of oldEntityNames) {
      if (!newEntityNames.has(name)) {
        result.changedEntityNames.push(name);
      }
    }
    for (const name of newEntityNames) {
      if (!oldEntityNames.has(name)) {
        result.changedEntityNames.push(name);
      }
    }

    // Also check for modified entries (same name but different content)
    for (const oldEntry of oldSchemaEntries) {
      const newEntry = newSchemaEntries.find(
        (e) => e.header.entityName.value === oldEntry.header.entityName.value,
      );
      if (newEntry && !schemaEntryEqual(oldEntry, newEntry)) {
        if (!result.changedEntityNames.includes(oldEntry.header.entityName.value)) {
          result.changedEntityNames.push(oldEntry.header.entityName.value);
        }
      }
    }
  }

  // Update the model in place
  model.ast = newAst;
  model.source = newSource;
  model.sourceMap = newSourceMap;
  model.blocks = newBlocks;
  model.schemaEntries = newSchemaEntries;
  model.dirty = {
    linkIndex: false,
    schemaEntries: false,
  };

  return result;
}

/**
 * Create a unique key for an entry based on its type and position.
 */
function entryKey(entry: Entry): string {
  return `${entry.type}:${entry.location.startIndex}:${entry.location.endIndex}`;
}

/**
 * Update the link index based on removed and added entries.
 */
function updateLinkIndex(
  linkIndex: LinkIndex,
  file: string,
  removedEntries: Entry[],
  addedEntries: Entry[],
): { addedDefinitions: string[]; removedDefinitions: string[]; changedReferences: string[] } {
  const addedDefinitions: string[] = [];
  const removedDefinitions: string[] = [];
  const changedReferences = new Set<string>();

  // Remove links from removed entries
  for (const entry of removedEntries) {
    const linkDef = getEntryLinkDefinition(entry);
    if (linkDef) {
      linkIndex.definitions.delete(linkDef.id);
      removedDefinitions.push(linkDef.id);
    }

    // Remove references from this entry
    removeEntryReferences(linkIndex.references, entry, changedReferences);
  }

  // Add links from added entries
  for (const entry of addedEntries) {
    indexEntryLinks(entry, file, linkIndex.definitions, linkIndex.references);

    const linkDef = getEntryLinkDefinition(entry);
    if (linkDef) {
      addedDefinitions.push(linkDef.id);
    }

    // Track changed references
    trackEntryReferences(entry, changedReferences);
  }

  return {
    addedDefinitions,
    removedDefinitions,
    changedReferences: Array.from(changedReferences),
  };
}

/**
 * Remove all references from a specific entry.
 */
function removeEntryReferences(
  references: Map<string, LinkReference[]>,
  entry: Entry,
  changedReferences: Set<string>,
): void {
  for (const [linkId, refs] of references) {
    const filtered = refs.filter((ref) => ref.entry !== entry);
    if (filtered.length !== refs.length) {
      changedReferences.add(linkId);
      if (filtered.length === 0) {
        references.delete(linkId);
      } else {
        references.set(linkId, filtered);
      }
    }
  }
}

/**
 * Track which link IDs are referenced by an entry.
 */
function trackEntryReferences(entry: Entry, changedReferences: Set<string>): void {
  if (entry.type === "instance_entry" || entry.type === "synthesis_entry") {
    for (const m of entry.metadata) {
      const content = m.value.content;
      if (content.type === "link_value") {
        changedReferences.add(content.link.id);
      } else if (content.type === "value_array") {
        for (const element of content.elements) {
          if (element.type === "link") {
            changedReferences.add(element.id);
          }
        }
      }
    }
  } else if (entry.type === "actualize_entry") {
    changedReferences.add(entry.header.target.id);
    for (const m of entry.metadata) {
      const content = m.value.content;
      if (content.type === "link_value") {
        changedReferences.add(content.link.id);
      } else if (content.type === "value_array") {
        for (const element of content.elements) {
          if (element.type === "link") {
            changedReferences.add(element.id);
          }
        }
      }
    }
  }
}

/**
 * Check if two arrays of schema entries are equal.
 */
function schemaEntriesEqual(a: SchemaEntry[], b: SchemaEntry[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!schemaEntryEqual(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Check if two schema entries are equal (by entity name and directive).
 */
function schemaEntryEqual(a: SchemaEntry, b: SchemaEntry): boolean {
  return (
    a.header.entityName.value === b.header.entityName.value &&
    a.header.directive === b.header.directive &&
    a.location.startIndex === b.location.startIndex &&
    a.location.endIndex === b.location.endIndex
  );
}
