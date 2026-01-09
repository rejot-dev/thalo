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
  Timestamp,
  TimezonePart,
  DefaultValue as AstDefaultValue,
} from "../ast/types.js";
import { isSyntaxError } from "../ast/types.js";
import type { SemanticModel, LinkIndex, LinkDefinition, LinkReference } from "../semantic/types.js";
import type { FileType } from "../parser.js";
import { parseDocument } from "../parser.js";
import { extractSourceFile } from "../ast/extract.js";
import { analyze } from "../semantic/analyzer.js";
import { SchemaRegistry } from "../schema/registry.js";
import { identitySourceMap, type SourceMap } from "../source-map.js";

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
  private models = new Map<string, SemanticModel>();
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
    const parsed = parseDocument(source, { fileType });
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
    const ast = extractSourceFile(block.tree.rootNode);
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
   * Clear all documents
   */
  clear(): void {
    this.models.clear();
    this._schemaRegistry.clear();
    this._linkIndex = {
      definitions: new Map(),
      references: new Map(),
    };
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

    for (const model of this.models.values()) {
      // Add schema entries
      for (const entry of model.schemaEntries) {
        const modelEntry = convertToModelSchemaEntry(entry, model.file, model.sourceMap);
        if (modelEntry) {
          this._schemaRegistry.add(modelEntry);
        }
      }

      // Merge links
      this.mergeLinks(model);
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

    // Merge references
    for (const [id, refs] of model.linkIndex.references) {
      const existing = this._linkIndex.references.get(id) ?? [];
      existing.push(...refs);
      this._linkIndex.references.set(id, existing);
    }
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

function convertTypeExpression(expr: TypeExpression): ModelTypeExpression {
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
          { kind: "array" | "union" }
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
  }
}

function formatTimestamp(ts: Timestamp): string {
  const date = `${ts.date.year}-${ts.date.month.toString().padStart(2, "0")}-${ts.date.day.toString().padStart(2, "0")}`;
  const time = `${ts.time.hour.toString().padStart(2, "0")}:${ts.time.minute.toString().padStart(2, "0")}`;
  const tz = formatTimezone(ts.timezone);
  return `${date}T${time}${tz}`;
}

function formatTimezone(
  tz: TimezonePart | import("../ast/types.js").SyntaxErrorNode<"missing_timezone">,
): string {
  if (isSyntaxError(tz)) {
    return "";
  }
  // Return the value directly - it's already formatted ("Z", "+05:30", "-08:00")
  return tz.value;
}
