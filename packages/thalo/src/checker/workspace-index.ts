import type {
  Entry,
  InstanceEntry,
  SchemaEntry,
  SynthesisEntry,
  ActualizeEntry,
} from "../ast/types.js";
import type { SemanticModel } from "../semantic/types.js";
import type { SourceMap } from "../source-map.js";
import type { Workspace } from "../model/workspace.js";

/**
 * An entry with its context (model, file, sourceMap) for reporting diagnostics.
 */
export interface IndexedEntry<T extends Entry> {
  /** The AST entry */
  entry: T;
  /** The semantic model containing this entry */
  model: SemanticModel;
  /** The file path */
  file: string;
  /** Source map for position translation */
  sourceMap: SourceMap;
}

/**
 * Pre-computed indices for efficient rule execution.
 *
 * Instead of each rule iterating over all models and entries,
 * rules can query this index for pre-grouped data.
 */
export interface WorkspaceIndex {
  // Entry indices by type
  /** All instance entries (create/update) */
  readonly instanceEntries: IndexedEntry<InstanceEntry>[];
  /** All schema entries (define-entity/alter-entity) */
  readonly schemaEntries: IndexedEntry<SchemaEntry>[];
  /** All synthesis entries (define-synthesis) */
  readonly synthesisEntries: IndexedEntry<SynthesisEntry>[];
  /** All actualize entries (actualize-synthesis) */
  readonly actualizeEntries: IndexedEntry<ActualizeEntry>[];

  // Pre-grouped indices for schema entries
  /** define-entity entries grouped by entity name */
  readonly defineEntitiesByName: ReadonlyMap<string, IndexedEntry<SchemaEntry>[]>;
  /** alter-entity entries grouped by entity name */
  readonly alterEntitiesByName: ReadonlyMap<string, IndexedEntry<SchemaEntry>[]>;

  // Pre-grouped indices for instance entries
  /** Instance entries grouped by entity type */
  readonly instancesByEntity: ReadonlyMap<string, IndexedEntry<InstanceEntry>[]>;
  /** Instance entries by their link ID (for entries that define a link) */
  readonly instancesByLinkId: ReadonlyMap<string, IndexedEntry<InstanceEntry>>;

  // Cross-reference indices
  /** Entries that reference a specific link ID (in metadata or as actualize target) */
  readonly entriesReferencingLink: ReadonlyMap<string, IndexedEntry<Entry>[]>;
  /** Entries that use a specific entity type (instance entries) */
  readonly entriesUsingEntity: ReadonlyMap<string, IndexedEntry<Entry>[]>;
}

/**
 * Mutable builder for WorkspaceIndex.
 */
interface WorkspaceIndexBuilder {
  instanceEntries: IndexedEntry<InstanceEntry>[];
  schemaEntries: IndexedEntry<SchemaEntry>[];
  synthesisEntries: IndexedEntry<SynthesisEntry>[];
  actualizeEntries: IndexedEntry<ActualizeEntry>[];
  defineEntitiesByName: Map<string, IndexedEntry<SchemaEntry>[]>;
  alterEntitiesByName: Map<string, IndexedEntry<SchemaEntry>[]>;
  instancesByEntity: Map<string, IndexedEntry<InstanceEntry>[]>;
  instancesByLinkId: Map<string, IndexedEntry<InstanceEntry>>;
  entriesReferencingLink: Map<string, IndexedEntry<Entry>[]>;
  entriesUsingEntity: Map<string, IndexedEntry<Entry>[]>;
}

/**
 * Create an empty workspace index builder.
 */
function createEmptyBuilder(): WorkspaceIndexBuilder {
  return {
    instanceEntries: [],
    schemaEntries: [],
    synthesisEntries: [],
    actualizeEntries: [],
    defineEntitiesByName: new Map(),
    alterEntitiesByName: new Map(),
    instancesByEntity: new Map(),
    instancesByLinkId: new Map(),
    entriesReferencingLink: new Map(),
    entriesUsingEntity: new Map(),
  };
}

/**
 * Add an item to a map of arrays.
 */
function addToMapArray<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key);
  if (arr) {
    arr.push(value);
  } else {
    map.set(key, [value]);
  }
}

/**
 * Extract link IDs referenced in an entry's metadata.
 */
function getReferencedLinkIds(entry: Entry): string[] {
  const linkIds: string[] = [];

  if (entry.type === "instance_entry" || entry.type === "synthesis_entry") {
    for (const m of entry.metadata) {
      const content = m.value.content;
      if (content.type === "link_value") {
        linkIds.push(content.link.id);
      } else if (content.type === "value_array") {
        for (const element of content.elements) {
          if (element.type === "link") {
            linkIds.push(element.id);
          }
        }
      }
    }
  } else if (entry.type === "actualize_entry") {
    // Actualize target is a reference
    linkIds.push(entry.header.target.id);
    // Plus any metadata links
    for (const m of entry.metadata) {
      const content = m.value.content;
      if (content.type === "link_value") {
        linkIds.push(content.link.id);
      } else if (content.type === "value_array") {
        for (const element of content.elements) {
          if (element.type === "link") {
            linkIds.push(element.id);
          }
        }
      }
    }
  }

  return linkIds;
}

/**
 * Build a WorkspaceIndex from a Workspace in a single pass.
 *
 * This is more efficient than having each rule iterate over all models
 * and entries independently. Rules can query the pre-built index instead.
 */
export function buildWorkspaceIndex(workspace: Workspace): WorkspaceIndex {
  const builder = createEmptyBuilder();

  // Single iteration over all models and entries
  for (const model of workspace.allModels()) {
    const file = model.file;
    const sourceMap = model.sourceMap;

    for (const entry of model.ast.entries) {
      const indexed = { entry, model, file, sourceMap };

      // Safe casts below: switch narrows entry.type, so the indexed cast is valid
      switch (entry.type) {
        case "instance_entry": {
          const instanceIndexed = indexed as IndexedEntry<InstanceEntry>;
          builder.instanceEntries.push(instanceIndexed);

          // Group by entity
          const entityName = entry.header.entity;
          addToMapArray(builder.instancesByEntity, entityName, instanceIndexed);
          addToMapArray(builder.entriesUsingEntity, entityName, indexed as IndexedEntry<Entry>);

          // Index by link ID if present
          if (entry.header.link) {
            builder.instancesByLinkId.set(entry.header.link.id, instanceIndexed);
          }

          // Track link references
          for (const linkId of getReferencedLinkIds(entry)) {
            addToMapArray(builder.entriesReferencingLink, linkId, indexed as IndexedEntry<Entry>);
          }
          break;
        }

        case "schema_entry": {
          const schemaIndexed = indexed as IndexedEntry<SchemaEntry>;
          builder.schemaEntries.push(schemaIndexed);

          const entityName = entry.header.entityName.value;
          if (entry.header.directive === "define-entity") {
            addToMapArray(builder.defineEntitiesByName, entityName, schemaIndexed);
          } else {
            addToMapArray(builder.alterEntitiesByName, entityName, schemaIndexed);
          }
          break;
        }

        case "synthesis_entry": {
          const synthesisIndexed = indexed as IndexedEntry<SynthesisEntry>;
          builder.synthesisEntries.push(synthesisIndexed);

          // Track link references
          for (const linkId of getReferencedLinkIds(entry)) {
            addToMapArray(builder.entriesReferencingLink, linkId, indexed as IndexedEntry<Entry>);
          }
          break;
        }

        case "actualize_entry": {
          const actualizeIndexed = indexed as IndexedEntry<ActualizeEntry>;
          builder.actualizeEntries.push(actualizeIndexed);

          // Track link references (including target)
          for (const linkId of getReferencedLinkIds(entry)) {
            addToMapArray(builder.entriesReferencingLink, linkId, indexed as IndexedEntry<Entry>);
          }
          break;
        }
      }
    }
  }

  return builder as WorkspaceIndex;
}

/**
 * Get instance entries for a specific entity type from the index.
 */
export function getInstancesForEntity(
  index: WorkspaceIndex,
  entityName: string,
): IndexedEntry<InstanceEntry>[] {
  return index.instancesByEntity.get(entityName) ?? [];
}

/**
 * Get all define-entity entries for a specific entity name.
 */
export function getDefineEntriesForEntity(
  index: WorkspaceIndex,
  entityName: string,
): IndexedEntry<SchemaEntry>[] {
  return index.defineEntitiesByName.get(entityName) ?? [];
}

/**
 * Get all alter-entity entries for a specific entity name.
 */
export function getAlterEntriesForEntity(
  index: WorkspaceIndex,
  entityName: string,
): IndexedEntry<SchemaEntry>[] {
  return index.alterEntitiesByName.get(entityName) ?? [];
}

/**
 * Get all entries that reference a specific link ID.
 */
export function getEntriesReferencingLink(
  index: WorkspaceIndex,
  linkId: string,
): IndexedEntry<Entry>[] {
  return index.entriesReferencingLink.get(linkId) ?? [];
}
