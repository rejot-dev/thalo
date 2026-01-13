import type {
  ModelSchemaEntry,
  ModelFieldDefinition,
  ModelSectionDefinition,
  ModelDefaultValue,
  ModelTypeExpression,
} from "./types.js";
import type {
  Entry,
  SchemaEntry,
  InstanceEntry,
  SynthesisEntry,
  ActualizeEntry,
  FieldDefinition,
  SectionDefinition,
  TypeExpression,
  DefaultValue as AstDefaultValue,
} from "../ast/types.js";
import type { SemanticModel, LinkIndex, LinkDefinition, LinkReference } from "../semantic/types.js";
import type { ThaloParser, GenericTree, FileType } from "../parser.shared.js";
import { extractSourceFile } from "../ast/extract.js";
import { analyze, updateSemanticModel } from "../semantic/analyzer.js";
import { SchemaRegistry } from "../schema/registry.js";
import { identitySourceMap, type SourceMap } from "../source-map.js";
import { Document, type EditResult } from "./document.js";
import { LineIndex, computeEdit } from "./line-index.js";
import { formatTimestamp } from "../formatters.js";

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
 * Result of applying an edit or update to the workspace.
 * Used for incremental diagnostics and targeted invalidation.
 */
export interface InvalidationResult {
  /** Files whose diagnostics may have changed */
  affectedFiles: string[];
  /** Whether schema definitions changed (affects type checking) */
  schemasChanged: boolean;
  /** Whether link definitions changed (affects link resolution) */
  linksChanged: boolean;
  /** Entity names whose schemas changed */
  changedEntityNames: string[];
  /** Link IDs that were added or removed */
  changedLinkIds: string[];
}

/**
 * A workspace containing multiple thalo documents.
 * Provides cross-file link resolution and schema management.
 *
 * The workspace is parser-agnostic - it accepts any parser that implements
 * the ThaloParser interface, allowing it to work with both native (Node.js)
 * and web (WASM) tree-sitter implementations.
 *
 * @example
 * ```typescript
 * // With native parser (Node.js) - parser is optional, defaults to native
 * import { Workspace } from "@rejot-dev/thalo";
 * const workspace = new Workspace();
 *
 * // With explicit parser
 * import { createParser } from "@rejot-dev/thalo/native";
 * const parser = createParser();
 * const workspace = new Workspace(parser);
 *
 * // With web parser (browser)
 * import { createParser } from "@rejot-dev/thalo/web";
 * const parser = await createParser({ treeSitterWasm, languageWasm });
 * const workspace = new Workspace(parser);
 * ```
 */
export class Workspace {
  private parser: ThaloParser<GenericTree>;
  private models = new Map<string, SemanticModel>();
  private documents = new Map<string, Document<GenericTree>>();
  private _schemaRegistry = new SchemaRegistry();
  private _linkIndex: LinkIndex = {
    definitions: new Map(),
    references: new Map(),
  };

  // Dependency tracking for targeted invalidation
  // linkId -> Set of files that reference this link
  private linkDependencies = new Map<string, Set<string>>();
  // entityName -> Set of files that use this entity (as instances)
  private entityDependencies = new Map<string, Set<string>>();

  /**
   * Create a new Workspace.
   *
   * @param parser - A ThaloParser instance. For Node.js, use createParser() from "@rejot-dev/thalo".
   *                 For browser, use createParser() from "@rejot-dev/thalo/web".
   */
  constructor(parser: ThaloParser<GenericTree>) {
    this.parser = parser;
  }

  /**
   * Get the schema registry for this workspace
   */
  get schemaRegistry(): SchemaRegistry {
    return this._schemaRegistry;
  }

  /**
   * Get the combined link index for all documents.
   */
  get linkIndex(): LinkIndex {
    return this._linkIndex;
  }

  /**
   * Add a document to the workspace.
   */
  addDocument(source: string, options: AddDocumentOptions): SemanticModel {
    const { filename, fileType } = options;

    // Remove existing document if present
    this.removeDocument(filename);

    // Parse and create SemanticModel
    const parsed = this.parser.parseDocument(source, { fileType, filename });
    if (parsed.blocks.length === 0) {
      // Empty document - create minimal model
      const emptyLocation = {
        startIndex: 0,
        endIndex: 0,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
      };
      // Empty document has no syntax tree, but SemanticModel still needs a valid structure
      const model: SemanticModel = {
        ast: {
          type: "source_file",
          entries: [],
          syntaxErrors: [],
          location: emptyLocation,
          // Safe: empty documents have no syntax tree; this is only used for empty file edge case
          syntaxNode: null as unknown as import("tree-sitter").SyntaxNode,
        },
        file: filename,
        source,
        sourceMap: identitySourceMap(),
        blocks: [],
        linkIndex: { definitions: new Map(), references: new Map() },
        schemaEntries: [],
      };
      this.models.set(filename, model);
      return model;
    }

    // For now, only process the first block (standard for .thalo files)
    const block = parsed.blocks[0];
    // Type assertion: both native and web tree-sitter rootNode have compatible interfaces
    const ast = extractSourceFile(block.tree.rootNode as import("tree-sitter").SyntaxNode);
    const model = analyze(ast, {
      file: filename,
      source,
      sourceMap: block.sourceMap,
      blocks: parsed.blocks,
    });
    this.models.set(filename, model);

    // Update schema registry with converted schema entries
    for (const entry of model.schemaEntries) {
      const modelEntry = convertToModelSchemaEntry(entry, filename, model.sourceMap);
      if (modelEntry) {
        this._schemaRegistry.add(modelEntry);
      }
    }

    // Merge link index
    this.mergeLinks(model);

    return model;
  }

  /**
   * Remove a document from the workspace
   */
  removeDocument(file: string): void {
    if (!this.models.has(file)) {
      return;
    }

    this.models.delete(file);

    // Rebuild schema registry and link index
    this.rebuild();
  }

  /**
   * Get a SemanticModel by file path.
   */
  getModel(file: string): SemanticModel | undefined {
    return this.models.get(file);
  }

  /**
   * Check if a document exists
   */
  hasDocument(file: string): boolean {
    return this.models.has(file);
  }

  /**
   * Get all document file paths
   */
  files(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Get all SemanticModels.
   */
  allModels(): SemanticModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get all AST entries across all SemanticModels.
   */
  allEntries(): Entry[] {
    const entries: Entry[] = [];
    for (const model of this.models.values()) {
      entries.push(...model.ast.entries);
    }
    return entries;
  }

  /**
   * Get all instance entries (create/update) across all SemanticModels.
   */
  allInstanceEntries(): InstanceEntry[] {
    return this.allEntries().filter((e): e is InstanceEntry => e.type === "instance_entry");
  }

  /**
   * Get all schema entries (define-entity/alter-entity) across all SemanticModels.
   */
  allSchemaEntries(): SchemaEntry[] {
    return this.allEntries().filter((e): e is SchemaEntry => e.type === "schema_entry");
  }

  /**
   * Get all synthesis entries (define-synthesis) across all SemanticModels.
   */
  allSynthesisEntries(): SynthesisEntry[] {
    return this.allEntries().filter((e): e is SynthesisEntry => e.type === "synthesis_entry");
  }

  /**
   * Get all actualize entries (actualize-synthesis) across all SemanticModels.
   */
  allActualizeEntries(): ActualizeEntry[] {
    return this.allEntries().filter((e): e is ActualizeEntry => e.type === "actualize_entry");
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
   * Get the Document instance for incremental editing.
   * Returns undefined if the document hasn't been added with incremental support.
   */
  getDocument(file: string): Document<GenericTree> | undefined {
    return this.documents.get(file);
  }

  /**
   * Apply an incremental edit to a document.
   * This is more efficient than addDocument() for small edits.
   *
   * @param filename - The file to edit
   * @param startLine - 0-based start line
   * @param startColumn - 0-based start column
   * @param endLine - 0-based end line
   * @param endColumn - 0-based end column
   * @param newText - The replacement text
   * @returns Information about what was invalidated
   */
  applyEdit(
    filename: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
    newText: string,
  ): InvalidationResult {
    const doc = this.documents.get(filename);
    if (!doc) {
      // Fall back to full re-parse if document wasn't initialized with incremental support
      const model = this.models.get(filename);
      if (!model) {
        return {
          affectedFiles: [],
          schemasChanged: false,
          linksChanged: false,
          changedEntityNames: [],
          changedLinkIds: [],
        };
      }

      // Apply the edit to get new source and do full re-parse
      const lineIndex = new LineIndex(model.source);
      const edit = computeEdit(lineIndex, startLine, startColumn, endLine, endColumn, newText);
      const newSource =
        model.source.slice(0, edit.startIndex) + newText + model.source.slice(edit.oldEndIndex);
      return this.updateDocument(filename, newSource);
    }

    // Apply incremental edit to the Document
    const editResult = doc.applyEdit(startLine, startColumn, endLine, endColumn, newText);

    // Update the semantic model
    return this.updateModelFromDocument(filename, doc, editResult);
  }

  /**
   * Update a document with new content.
   * This replaces the entire document and recalculates all dependencies.
   *
   * @param filename - The file to update
   * @param newSource - The new source content
   * @returns Information about what was invalidated
   */
  updateDocument(filename: string, newSource: string): InvalidationResult {
    // Get or create the Document
    let doc = this.documents.get(filename);
    if (doc) {
      doc.replaceContent(newSource);
    } else {
      doc = new Document(this.parser, filename, newSource);
      this.documents.set(filename, doc);
    }

    // Update the semantic model
    return this.updateModelFromDocument(filename, doc, {
      blockBoundariesChanged: true,
      modifiedBlockIndices: doc.blocks.map((_, i) => i),
      fullReparse: true,
    });
  }

  /**
   * Get files that would be affected by changes in a specific file.
   * Useful for targeted diagnostics refresh.
   */
  getAffectedFiles(filename: string): string[] {
    const model = this.models.get(filename);
    if (!model) {
      return [filename];
    }

    const affected = new Set<string>([filename]);

    // Files that reference links defined in this file
    for (const [linkId] of model.linkIndex.definitions) {
      const dependents = this.linkDependencies.get(linkId);
      if (dependents) {
        for (const dep of dependents) {
          affected.add(dep);
        }
      }
    }

    // Files that use entities defined in this file
    for (const entry of model.schemaEntries) {
      const entityName = entry.header.entityName.value;
      const dependents = this.entityDependencies.get(entityName);
      if (dependents) {
        for (const dep of dependents) {
          affected.add(dep);
        }
      }
    }

    return Array.from(affected);
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.models.clear();
    this.documents.clear();
    this._schemaRegistry.clear();
    this._linkIndex = {
      definitions: new Map(),
      references: new Map(),
    };
    this.linkDependencies.clear();
    this.entityDependencies.clear();
  }

  /**
   * Rebuild schema registry and link index from all models
   */
  private rebuild(): void {
    this._schemaRegistry.clear();
    this._linkIndex = {
      definitions: new Map(),
      references: new Map(),
    };
    this.linkDependencies.clear();
    this.entityDependencies.clear();

    for (const model of this.models.values()) {
      // Add schema entries
      for (const entry of model.schemaEntries) {
        const modelEntry = convertToModelSchemaEntry(entry, model.file, model.sourceMap);
        if (modelEntry) {
          this._schemaRegistry.add(modelEntry);
        }
      }

      // Merge links and track dependencies
      this.mergeLinks(model);

      // Track entity dependencies
      this.updateEntityDependencies(model);
    }
  }

  /**
   * Merge a SemanticModel's links into the workspace link index
   */
  private mergeLinks(model: SemanticModel): void {
    // Merge definitions
    for (const [id, def] of model.linkIndex.definitions) {
      this._linkIndex.definitions.set(id, def);
    }

    // Merge references and track dependencies
    for (const [id, refs] of model.linkIndex.references) {
      const existing = this._linkIndex.references.get(id) ?? [];
      existing.push(...refs);
      this._linkIndex.references.set(id, existing);

      // Track that this file depends on this link
      let deps = this.linkDependencies.get(id);
      if (!deps) {
        deps = new Set();
        this.linkDependencies.set(id, deps);
      }
      deps.add(model.file);
    }
  }

  /**
   * Update entity dependencies for a model
   */
  private updateEntityDependencies(model: SemanticModel): void {
    // Track which entities this file uses
    for (const entry of model.ast.entries) {
      if (entry.type === "instance_entry") {
        const entityName = entry.header.entity;
        let deps = this.entityDependencies.get(entityName);
        if (!deps) {
          deps = new Set();
          this.entityDependencies.set(entityName, deps);
        }
        deps.add(model.file);
      }
    }
  }

  /**
   * Remove a file's dependencies from the tracking maps
   */
  private removeDependencies(file: string): void {
    // Remove from link dependencies
    for (const deps of this.linkDependencies.values()) {
      deps.delete(file);
    }

    // Remove from entity dependencies
    for (const deps of this.entityDependencies.values()) {
      deps.delete(file);
    }
  }

  /**
   * Update the semantic model from a Document's parse results.
   */
  private updateModelFromDocument(
    filename: string,
    doc: Document<GenericTree>,
    editResult: EditResult,
  ): InvalidationResult {
    const result: InvalidationResult = {
      affectedFiles: [filename],
      schemasChanged: false,
      linksChanged: false,
      changedEntityNames: [],
      changedLinkIds: [],
    };

    if (doc.blocks.length === 0) {
      // Empty document - remove existing model
      const oldModel = this.models.get(filename);
      if (oldModel) {
        // Track removed links
        for (const [linkId] of oldModel.linkIndex.definitions) {
          result.changedLinkIds.push(linkId);
          result.linksChanged = true;
        }
        // Track removed schemas
        for (const entry of oldModel.schemaEntries) {
          result.changedEntityNames.push(entry.header.entityName.value);
          result.schemasChanged = true;
        }
        // Remove dependencies
        this.removeDependencies(filename);
      }

      // Create empty model
      const emptyLocation = {
        startIndex: 0,
        endIndex: 0,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
      };
      const model: SemanticModel = {
        ast: {
          type: "source_file",
          entries: [],
          syntaxErrors: [],
          location: emptyLocation,
          // Safe: empty documents have no syntax tree; this is only used for empty file edge case
          syntaxNode: null as unknown as import("tree-sitter").SyntaxNode,
        },
        file: filename,
        source: doc.source,
        sourceMap: identitySourceMap(),
        blocks: [],
        linkIndex: { definitions: new Map(), references: new Map() },
        schemaEntries: [],
      };
      this.models.set(filename, model);
      this.rebuild();

      result.affectedFiles = this.getAffectedFiles(filename);
      return result;
    }

    // Parse the first block
    const block = doc.blocks[0];
    // Type assertion: both native and web tree-sitter rootNode have compatible interfaces
    const newAst = extractSourceFile(block.tree.rootNode as import("tree-sitter").SyntaxNode);
    const newSourceMap = block.sourceMap;
    const newBlocks = doc.blocks.map((b) => ({
      source: b.source,
      sourceMap: b.sourceMap,
      tree: b.tree,
    }));

    const oldModel = this.models.get(filename);
    if (oldModel && !editResult.fullReparse) {
      // Use incremental update
      const updateResult = updateSemanticModel(
        oldModel,
        newAst,
        doc.source,
        newSourceMap,
        newBlocks,
      );

      result.linksChanged =
        updateResult.addedLinkDefinitions.length > 0 ||
        updateResult.removedLinkDefinitions.length > 0;
      result.changedLinkIds = [
        ...updateResult.addedLinkDefinitions,
        ...updateResult.removedLinkDefinitions,
      ];
      result.schemasChanged = updateResult.schemaEntriesChanged;
      result.changedEntityNames = updateResult.changedEntityNames;

      // Rebuild workspace indices if needed
      if (result.schemasChanged || result.linksChanged) {
        this.rebuild();
      }
    } else {
      // Full re-analyze
      const model = analyze(newAst, {
        file: filename,
        source: doc.source,
        sourceMap: newSourceMap,
        blocks: newBlocks,
      });

      // Track what changed compared to old model
      if (oldModel) {
        // Check for link changes
        for (const [linkId] of oldModel.linkIndex.definitions) {
          if (!model.linkIndex.definitions.has(linkId)) {
            result.changedLinkIds.push(linkId);
            result.linksChanged = true;
          }
        }
        for (const [linkId] of model.linkIndex.definitions) {
          if (!oldModel.linkIndex.definitions.has(linkId)) {
            result.changedLinkIds.push(linkId);
            result.linksChanged = true;
          }
        }

        // Check for schema changes
        const oldEntityNames = new Set(
          oldModel.schemaEntries.map((e) => e.header.entityName.value),
        );
        const newEntityNames = new Set(model.schemaEntries.map((e) => e.header.entityName.value));

        for (const name of oldEntityNames) {
          if (!newEntityNames.has(name)) {
            result.changedEntityNames.push(name);
            result.schemasChanged = true;
          }
        }
        for (const name of newEntityNames) {
          if (!oldEntityNames.has(name)) {
            result.changedEntityNames.push(name);
            result.schemasChanged = true;
          }
        }
      } else {
        // New document - everything is new
        for (const [linkId] of model.linkIndex.definitions) {
          result.changedLinkIds.push(linkId);
        }
        for (const entry of model.schemaEntries) {
          result.changedEntityNames.push(entry.header.entityName.value);
        }
        result.linksChanged = result.changedLinkIds.length > 0;
        result.schemasChanged = result.changedEntityNames.length > 0;
      }

      this.models.set(filename, model);
      this.rebuild();
    }

    // Calculate affected files
    result.affectedFiles = this.getAffectedFiles(filename);

    return result;
  }
}

/**
 * Convert AST SchemaEntry to ModelSchemaEntry for SchemaRegistry compatibility.
 * Note: This is a temporary conversion layer until SchemaRegistry is updated to use AST types.
 */
function convertToModelSchemaEntry(
  entry: SchemaEntry,
  file: string,
  sourceMap: SourceMap,
): ModelSchemaEntry | null {
  // Only handle entity schema entries (define-entity or alter-entity)
  const directive = entry.header.directive;
  if (directive !== "define-entity" && directive !== "alter-entity") {
    return null;
  }

  const timestamp = formatTimestamp(entry.header.timestamp);
  const fields = entry.metadataBlock?.fields ?? [];
  const sections = entry.sectionsBlock?.sections ?? [];
  const removeFields = entry.removeMetadataBlock?.fields ?? [];
  const removeSections = entry.removeSectionsBlock?.sections ?? [];

  return {
    kind: "schema",
    timestamp,
    directive,
    entityName: entry.header.entityName.value,
    title: entry.header.title?.value ?? "",
    linkId: entry.header.link?.id ?? null,
    tags: entry.header.tags.map((t) => t.name),
    fields: fields.map(convertFieldDefinition),
    sections: sections.map(convertSectionDefinition),
    removeFields: removeFields.map((f) => f.name.value),
    removeSections: removeSections.map((s) => s.name.value),
    location: entry.location,
    file,
    sourceMap,
  };
}

function convertFieldDefinition(field: FieldDefinition): ModelFieldDefinition {
  return {
    name: field.name.value,
    optional: field.optional,
    type: convertTypeExpression(field.typeExpr),
    defaultValue: field.defaultValue ? convertDefaultValue(field.defaultValue) : null,
    description: field.description?.value ?? null,
    location: field.location,
  };
}

function convertSectionDefinition(section: SectionDefinition): ModelSectionDefinition {
  return {
    name: section.name.value,
    optional: section.optional,
    description: section.description?.value ?? null,
    location: section.location,
  };
}

function convertTypeExpression(
  expr: TypeExpression | import("../ast/types.js").SyntaxErrorNode<"unknown_type">,
): ModelTypeExpression {
  switch (expr.type) {
    case "primitive_type":
      return { kind: "primitive", name: expr.name };
    case "literal_type":
      return { kind: "literal", value: expr.value };
    case "array_type":
      // Safe: array element types cannot be arrays or unions per grammar
      return {
        kind: "array",
        elementType: convertTypeExpression(expr.elementType) as Exclude<
          ModelTypeExpression,
          { kind: "array" | "union" | "unknown" }
        >,
      };
    case "union_type":
      // Safe: union members cannot be unions per grammar
      return {
        kind: "union",
        members: expr.members.map(
          (m) => convertTypeExpression(m) as Exclude<ModelTypeExpression, { kind: "union" }>,
        ),
      };
    case "syntax_error":
      // Unknown type - preserve the name for error messages
      return { kind: "unknown", name: expr.text };
  }
}

function convertDefaultValue(defaultValue: AstDefaultValue): ModelDefaultValue {
  const raw = defaultValue.raw;
  switch (defaultValue.content.type) {
    case "quoted_value":
      return { kind: "quoted", value: defaultValue.content.value, raw };
    case "link":
      return { kind: "link", id: defaultValue.content.id, raw };
    case "datetime_value":
      return { kind: "datetime", value: defaultValue.content.value, raw };
    case "number_value":
      return { kind: "number", value: defaultValue.content.value, raw };
  }
}
