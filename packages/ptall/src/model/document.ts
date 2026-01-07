import { parseDocument, type ParsedDocument, type ParsedBlock, type FileType } from "../parser.js";
import { extractSourceFile } from "../ast/extract.js";
import type {
  SourceFile,
  InstanceEntry,
  SchemaEntry,
  TypeExpression,
  Content,
} from "../ast/types.js";
import type {
  ModelEntry,
  ModelInstanceEntry,
  ModelSchemaEntry,
  ModelFieldDefinition,
  ModelSectionDefinition,
  ModelTypeExpression,
  ModelPrimitiveType,
  ModelLiteralType,
  ModelUnionType,
  LinkDefinition,
  LinkReference,
  LinkIndex,
} from "./types.js";

/**
 * Options for parsing a document
 */
export interface DocumentParseOptions {
  /** The file type. If not provided, uses heuristics based on filename or content. */
  fileType?: FileType;
  /** Optional filename (used for heuristics and stored on the document) */
  filename?: string;
}

/**
 * Represents a parsed ptall document (single file)
 */
export class Document {
  /** The file path */
  readonly file: string;
  /** The original source text */
  readonly source: string;
  /** Parsed blocks (may be multiple for markdown files) */
  readonly blocks: ParsedBlock[];
  /** All entries in the document */
  readonly entries: ModelEntry[];
  /** Link index for this document */
  readonly linkIndex: LinkIndex;

  private constructor(
    file: string,
    source: string,
    blocks: ParsedBlock[],
    entries: ModelEntry[],
    linkIndex: LinkIndex,
  ) {
    this.file = file;
    this.source = source;
    this.blocks = blocks;
    this.entries = entries;
    this.linkIndex = linkIndex;
  }

  /**
   * Parse a document from source text
   */
  static parse(source: string, options: DocumentParseOptions = {}): Document {
    const { filename = "<anonymous>", fileType } = options;
    const parsed = parseDocument(source, { filename, fileType });
    return Document.fromParsed(parsed, filename, source);
  }

  /**
   * Create a Document from a ParsedDocument
   */
  static fromParsed(parsed: ParsedDocument, file: string, source: string): Document {
    const entries: ModelEntry[] = [];
    const linkIndex: LinkIndex = {
      definitions: new Map(),
      references: new Map(),
    };

    for (const block of parsed.blocks) {
      const ast = extractSourceFile(block.tree.rootNode);
      const blockEntries = extractEntries(ast, file, block.offset);

      for (const entry of blockEntries) {
        entries.push(entry);
        indexEntry(entry, linkIndex);
      }
    }

    return new Document(file, source, parsed.blocks, entries, linkIndex);
  }

  /**
   * Get all instance entries
   */
  get instanceEntries(): ModelInstanceEntry[] {
    return this.entries.filter((e): e is ModelInstanceEntry => e.kind === "instance");
  }

  /**
   * Get all schema entries
   */
  get schemaEntries(): ModelSchemaEntry[] {
    return this.entries.filter((e): e is ModelSchemaEntry => e.kind === "schema");
  }

  /**
   * Find an entry by timestamp or link ID
   */
  findEntry(id: string): ModelEntry | undefined {
    return this.entries.find((e) => e.timestamp === id || e.linkId === id);
  }
}

/**
 * Extract model entries from an AST
 */
function extractEntries(ast: SourceFile, file: string, blockOffset: number): ModelEntry[] {
  const entries: ModelEntry[] = [];

  for (const entry of ast.entries) {
    if (entry.type === "instance_entry") {
      entries.push(extractInstanceEntry(entry, file, blockOffset));
    } else if (entry.type === "schema_entry") {
      entries.push(extractSchemaEntry(entry, file, blockOffset));
    }
  }

  return entries;
}

/**
 * Extract a model instance entry from AST
 */
function extractInstanceEntry(
  ast: InstanceEntry,
  file: string,
  blockOffset: number,
): ModelInstanceEntry {
  const metadata = new Map<
    string,
    { raw: string; linkId: string | null; location: typeof ast.location }
  >();

  for (const m of ast.metadata) {
    metadata.set(m.key.value, {
      raw: m.value.raw,
      linkId: m.value.link?.id ?? null,
      location: m.value.location,
    });
  }

  const sections = extractSectionsFromContent(ast.content);

  return {
    kind: "instance",
    timestamp: ast.header.timestamp.value,
    directive: ast.header.directive,
    entity: ast.header.entity,
    title: ast.header.title.value,
    linkId: ast.header.link?.id ?? null,
    tags: ast.header.tags.map((t) => t.name),
    metadata,
    sections,
    location: ast.location,
    file,
    blockOffset,
  };
}

/**
 * Extract section names from content (looking for markdown headers)
 */
function extractSectionsFromContent(content: Content | null): string[] {
  if (!content) {
    return [];
  }

  const sections: string[] = [];
  for (const child of content.children) {
    if (child.type === "markdown_header") {
      // Extract the section name from the header (remove # prefix)
      const match = child.text.match(/^#+\s*(.+)$/);
      if (match) {
        sections.push(match[1].trim());
      }
    }
  }
  return sections;
}

/**
 * Extract a model schema entry from AST
 */
function extractSchemaEntry(ast: SchemaEntry, file: string, blockOffset: number): ModelSchemaEntry {
  const fields: ModelFieldDefinition[] = [];
  const sections: ModelSectionDefinition[] = [];
  const removeFields: string[] = [];
  const removeSections: string[] = [];

  if (ast.metadataBlock) {
    for (const field of ast.metadataBlock.fields) {
      fields.push({
        name: field.name.value,
        optional: field.optional,
        type: convertTypeExpression(field.typeExpr),
        defaultValue: field.defaultValue?.raw ?? null,
        description: field.description?.value ?? null,
        location: field.location,
      });
    }
  }

  if (ast.sectionsBlock) {
    for (const section of ast.sectionsBlock.sections) {
      sections.push({
        name: section.name.value,
        optional: section.optional,
        description: section.description?.value ?? null,
        location: section.location,
      });
    }
  }

  if (ast.removeMetadataBlock) {
    for (const field of ast.removeMetadataBlock.fields) {
      removeFields.push(field.name.value);
    }
  }

  if (ast.removeSectionsBlock) {
    for (const section of ast.removeSectionsBlock.sections) {
      removeSections.push(section.name.value);
    }
  }

  return {
    kind: "schema",
    timestamp: ast.header.timestamp.value,
    directive: ast.header.directive,
    entityName: ast.header.entityName.value,
    title: ast.header.title.value,
    linkId: ast.header.link?.id ?? null,
    tags: ast.header.tags.map((t) => t.name),
    fields,
    sections,
    removeFields,
    removeSections,
    location: ast.location,
    file,
    blockOffset,
  };
}

/**
 * Convert AST type expression to model type expression
 */
function convertTypeExpression(ast: TypeExpression): ModelTypeExpression {
  switch (ast.type) {
    case "primitive_type":
      return { kind: "primitive", name: ast.name };
    case "literal_type":
      return { kind: "literal", value: ast.value };
    case "array_type":
      return {
        kind: "array",
        elementType: convertArrayElementType(ast.elementType),
      };
    case "union_type":
      return {
        kind: "union",
        members: ast.members.map((m) => {
          if (m.type === "primitive_type") {
            return { kind: "primitive" as const, name: m.name };
          } else if (m.type === "literal_type") {
            return { kind: "literal" as const, value: m.value };
          } else {
            return {
              kind: "array" as const,
              elementType: convertArrayElementType(m.elementType),
            };
          }
        }),
      };
  }
}

/**
 * Convert array element type (can be primitive, literal, or union for parenthesized unions)
 */
function convertArrayElementType(
  ast: TypeExpression & { type: "primitive_type" | "literal_type" | "union_type" },
): ModelPrimitiveType | ModelLiteralType | ModelUnionType {
  switch (ast.type) {
    case "primitive_type":
      return { kind: "primitive", name: ast.name };
    case "literal_type":
      return { kind: "literal", value: ast.value };
    case "union_type":
      return {
        kind: "union",
        members: ast.members.map((m) => {
          if (m.type === "primitive_type") {
            return { kind: "primitive" as const, name: m.name };
          } else if (m.type === "literal_type") {
            return { kind: "literal" as const, value: m.value };
          } else {
            // Nested arrays in union - recursively convert
            return {
              kind: "array" as const,
              elementType: convertArrayElementType(m.elementType),
            };
          }
        }),
      };
  }
}

/**
 * Index an entry's links (definitions and references)
 */
function indexEntry(entry: ModelEntry, index: LinkIndex): void {
  // Explicit link ID creates a definition
  if (entry.linkId) {
    const linkDef: LinkDefinition = {
      id: entry.linkId,
      file: entry.file,
      location: entry.location,
      entry,
    };
    index.definitions.set(entry.linkId, linkDef);
  }

  // Index link references from metadata
  if (entry.kind === "instance") {
    for (const [key, value] of entry.metadata) {
      if (value.linkId) {
        const ref: LinkReference = {
          id: value.linkId,
          file: entry.file,
          location: value.location,
          entry,
          metadataKey: key,
        };

        const refs = index.references.get(value.linkId) ?? [];
        refs.push(ref);
        index.references.set(value.linkId, refs);
      }
    }
  }
}
