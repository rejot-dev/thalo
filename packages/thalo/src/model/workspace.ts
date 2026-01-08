import { Document } from "./document.js";
import type {
  ModelEntry,
  ModelInstanceEntry,
  ModelSchemaEntry,
  LinkDefinition,
  LinkReference,
  LinkIndex,
} from "./types.js";
import { SchemaRegistry } from "../schema/registry.js";
import type { FileType } from "../parser.js";

/**
 * Options for adding a document to the workspace
 */
export interface AddDocumentOptions {
  /** The file type. If not provided, uses heuristics based on filename or content. */
  fileType?: FileType;
  /** The filename/path for the document (required for workspace indexing) */
  filename: string;
}

/**
 * A workspace containing multiple thalo documents.
 * Provides cross-file link resolution and schema management.
 */
export class Workspace {
  private documents = new Map<string, Document>();
  private _schemaRegistry = new SchemaRegistry();
  private _linkIndex: LinkIndex = {
    definitions: new Map(),
    references: new Map(),
  };

  /**
   * Get the schema registry for this workspace
   */
  get schemaRegistry(): SchemaRegistry {
    return this._schemaRegistry;
  }

  /**
   * Get the combined link index for all documents
   */
  get linkIndex(): LinkIndex {
    return this._linkIndex;
  }

  /**
   * Add a document to the workspace
   */
  addDocument(source: string, options: AddDocumentOptions): Document {
    const { filename, fileType } = options;

    // Remove existing document if present
    this.removeDocument(filename);

    const doc = Document.parse(source, { filename, fileType });
    this.documents.set(filename, doc);

    // Update schema registry with schema entries
    for (const entry of doc.schemaEntries) {
      this._schemaRegistry.add(entry);
    }

    // Merge link index
    this.mergeLinks(doc);

    return doc;
  }

  /**
   * Remove a document from the workspace
   */
  removeDocument(file: string): void {
    const doc = this.documents.get(file);
    if (!doc) {
      return;
    }

    this.documents.delete(file);

    // Rebuild schema registry and link index
    this.rebuild();
  }

  /**
   * Get a document by file path
   */
  getDocument(file: string): Document | undefined {
    return this.documents.get(file);
  }

  /**
   * Check if a document exists
   */
  hasDocument(file: string): boolean {
    return this.documents.has(file);
  }

  /**
   * Get all document file paths
   */
  files(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Get all documents
   */
  allDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get all entries across all documents
   */
  allEntries(): ModelEntry[] {
    const entries: ModelEntry[] = [];
    for (const doc of this.documents.values()) {
      entries.push(...doc.entries);
    }
    return entries;
  }

  /**
   * Get all instance entries across all documents
   */
  allInstanceEntries(): ModelInstanceEntry[] {
    const entries: ModelInstanceEntry[] = [];
    for (const doc of this.documents.values()) {
      entries.push(...doc.instanceEntries);
    }
    return entries;
  }

  /**
   * Get all schema entries across all documents
   */
  allSchemaEntries(): ModelSchemaEntry[] {
    const entries: ModelSchemaEntry[] = [];
    for (const doc of this.documents.values()) {
      entries.push(...doc.schemaEntries);
    }
    return entries;
  }

  /**
   * Find an entry by timestamp or link ID across all documents
   */
  findEntry(id: string): ModelEntry | undefined {
    for (const doc of this.documents.values()) {
      const entry = doc.findEntry(id);
      if (entry) {
        return entry;
      }
    }
    return undefined;
  }

  /**
   * Get the definition for a link ID
   */
  getLinkDefinition(id: string): LinkDefinition | undefined {
    return this._linkIndex.definitions.get(id);
  }

  /**
   * Get all references for a link ID
   */
  getLinkReferences(id: string): LinkReference[] {
    return this._linkIndex.references.get(id) ?? [];
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents.clear();
    this._schemaRegistry.clear();
    this._linkIndex = {
      definitions: new Map(),
      references: new Map(),
    };
  }

  /**
   * Rebuild schema registry and link index from all documents
   */
  private rebuild(): void {
    this._schemaRegistry.clear();
    this._linkIndex = {
      definitions: new Map(),
      references: new Map(),
    };

    for (const doc of this.documents.values()) {
      // Add schema entries
      for (const entry of doc.schemaEntries) {
        this._schemaRegistry.add(entry);
      }

      // Merge links
      this.mergeLinks(doc);
    }
  }

  /**
   * Merge a document's links into the workspace index
   */
  private mergeLinks(doc: Document): void {
    // Merge definitions
    for (const [id, def] of doc.linkIndex.definitions) {
      // Note: later definitions override earlier ones (same ID)
      this._linkIndex.definitions.set(id, def);
    }

    // Merge references
    for (const [id, refs] of doc.linkIndex.references) {
      const existing = this._linkIndex.references.get(id) ?? [];
      existing.push(...refs);
      this._linkIndex.references.set(id, existing);
    }
  }
}
