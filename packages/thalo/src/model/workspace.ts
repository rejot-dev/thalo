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
import { extractSourceFile } from "../ast/extract.js";
import { analyze } from "../semantic/analyzer.js";
import type { SemanticModel, LinkIndex as SemanticLinkIndex } from "../semantic/types.js";
import type { Entry } from "../ast/types.js";

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
 *
 * The workspace maintains both Document instances (for backward compatibility
 * with Model types) and SemanticModel instances (for the new AST-based approach).
 */
export class Workspace {
  private documents = new Map<string, Document>();
  private _schemaRegistry = new SchemaRegistry();
  private _linkIndex: LinkIndex = {
    definitions: new Map(),
    references: new Map(),
  };

  /**
   * SemanticModels stored alongside Documents.
   * These contain the AST and semantic indexes.
   */
  private semanticModels = new Map<string, SemanticModel>();

  /**
   * Combined semantic link index across all SemanticModels.
   * Uses AST Entry types instead of ModelEntry types.
   */
  private _semanticLinkIndex: SemanticLinkIndex = {
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
   * Get the combined link index for all documents.
   * Uses ModelEntry types for backward compatibility.
   */
  get linkIndex(): LinkIndex {
    return this._linkIndex;
  }

  /**
   * Get the combined semantic link index for all documents.
   * Uses AST Entry types for the new architecture.
   */
  get semanticLinkIndex(): SemanticLinkIndex {
    return this._semanticLinkIndex;
  }

  /**
   * Add a document to the workspace.
   * Creates both a Document (for backward compatibility) and a SemanticModel.
   */
  addDocument(source: string, options: AddDocumentOptions): Document {
    const { filename, fileType } = options;

    // Remove existing document if present
    this.removeDocument(filename);

    // Parse and create Document (backward compatible)
    const doc = Document.parse(source, { filename, fileType });
    this.documents.set(filename, doc);

    // Also create SemanticModel for the new architecture
    // For now, we extract AST from the first block only (same as Document)
    // TODO: Handle multiple blocks properly when migrating away from Document
    if (doc.blocks.length > 0) {
      const block = doc.blocks[0];
      const ast = extractSourceFile(block.tree.rootNode);
      const model = analyze(ast, {
        file: filename,
        source,
        sourceMap: block.sourceMap,
      });
      this.semanticModels.set(filename, model);
      this.mergeSemanticLinks(model);
    }

    // Update schema registry with schema entries
    for (const entry of doc.schemaEntries) {
      this._schemaRegistry.add(entry);
    }

    // Merge link index (backward compatible)
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
    this.semanticModels.delete(file);

    // Rebuild schema registry and link index
    this.rebuild();
  }

  /**
   * Get a document by file path.
   * @deprecated Use getModel() for the new architecture
   */
  getDocument(file: string): Document | undefined {
    return this.documents.get(file);
  }

  /**
   * Get a SemanticModel by file path.
   */
  getModel(file: string): SemanticModel | undefined {
    return this.semanticModels.get(file);
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
   * Get all documents.
   * @deprecated Use allModels() for the new architecture
   */
  allDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get all SemanticModels.
   */
  allModels(): SemanticModel[] {
    return Array.from(this.semanticModels.values());
  }

  /**
   * Get all entries across all documents.
   * Uses ModelEntry types for backward compatibility.
   * @deprecated Use allAstEntries() for the new architecture
   */
  allEntries(): ModelEntry[] {
    const entries: ModelEntry[] = [];
    for (const doc of this.documents.values()) {
      entries.push(...doc.entries);
    }
    return entries;
  }

  /**
   * Get all AST entries across all SemanticModels.
   * Uses AST Entry types for the new architecture.
   */
  allAstEntries(): Entry[] {
    const entries: Entry[] = [];
    for (const model of this.semanticModels.values()) {
      entries.push(...model.ast.entries);
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
   * Clear all documents and semantic models
   */
  clear(): void {
    this.documents.clear();
    this.semanticModels.clear();
    this._schemaRegistry.clear();
    this._linkIndex = {
      definitions: new Map(),
      references: new Map(),
    };
    this._semanticLinkIndex = {
      definitions: new Map(),
      references: new Map(),
    };
  }

  /**
   * Rebuild schema registry and link indexes from all documents
   */
  private rebuild(): void {
    this._schemaRegistry.clear();
    this._linkIndex = {
      definitions: new Map(),
      references: new Map(),
    };
    this._semanticLinkIndex = {
      definitions: new Map(),
      references: new Map(),
    };

    for (const doc of this.documents.values()) {
      // Add schema entries
      for (const entry of doc.schemaEntries) {
        this._schemaRegistry.add(entry);
      }

      // Merge links (backward compatible)
      this.mergeLinks(doc);
    }

    // Rebuild semantic link index from semantic models
    for (const model of this.semanticModels.values()) {
      this.mergeSemanticLinks(model);
    }
  }

  /**
   * Merge a document's links into the workspace index (backward compatible)
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

  /**
   * Merge a SemanticModel's links into the semantic link index
   */
  private mergeSemanticLinks(model: SemanticModel): void {
    // Merge definitions
    for (const [id, def] of model.linkIndex.definitions) {
      // Note: later definitions override earlier ones (same ID)
      this._semanticLinkIndex.definitions.set(id, def);
    }

    // Merge references
    for (const [id, refs] of model.linkIndex.references) {
      const existing = this._semanticLinkIndex.references.get(id) ?? [];
      existing.push(...refs);
      this._semanticLinkIndex.references.set(id, existing);
    }
  }
}
