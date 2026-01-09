import type { SourceFile, Entry, SchemaEntry, Metadata } from "../ast/types.js";
import type { SourceMap } from "../source-map.js";
import type { SemanticModel, LinkIndex, LinkDefinition, LinkReference } from "./types.js";

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
  const { file, source, sourceMap } = options;

  return {
    ast,
    file,
    source,
    sourceMap,
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
): { id: string; location: import("../ast/types.js").Location } | null {
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

/**
 * Alias for analyze() for backward compatibility.
 */
export const analyzeDocument = analyze;
