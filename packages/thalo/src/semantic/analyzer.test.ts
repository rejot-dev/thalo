import { describe, it, expect } from "vitest";
import type { SyntaxNode, Point } from "tree-sitter";
import type {
  SourceFile,
  Entry,
  InstanceEntry,
  SchemaEntry,
  SynthesisEntry,
  ActualizeEntry,
  Location,
  InstanceHeader,
  SchemaHeader,
  SynthesisHeader,
  ActualizeHeader,
  Timestamp,
  Title,
  Link,
  Tag,
  Key,
  Value,
  Metadata,
  Identifier,
} from "../ast/ast-types.js";
import { analyze, updateSemanticModel } from "./analyzer.js";
import type { LinkIndex, SemanticModel } from "./analyzer.js";
import type { SourceMap } from "../source-map.js";

/**
 * Helper to get link index through the analyze function.
 */
function getLinkIndex(ast: SourceFile, file: string): LinkIndex {
  return analyze(ast, {
    file,
    source: "",
    sourceMap: mockSourceMap(),
    blocks: [],
  }).linkIndex;
}

// ===================
// Test Helpers
// ===================

/**
 * Create a mock SyntaxNode for testing.
 */
function mockSyntaxNode(): SyntaxNode {
  return {} as unknown as SyntaxNode;
}

/**
 * Create a mock Location for testing.
 */
function mockLocation(startIndex: number, endIndex: number): Location {
  return {
    startIndex,
    endIndex,
    startPosition: { row: 0, column: startIndex } as Point,
    endPosition: { row: 0, column: endIndex } as Point,
  };
}

/**
 * Create a mock SourceMap for testing.
 */
function mockSourceMap(): SourceMap {
  return {
    charOffset: 0,
    lineOffset: 0,
    columnOffset: 0,
    lineCount: 10,
  };
}

/**
 * Create a mock Timestamp for testing.
 */
function mockTimestamp(value: string): Timestamp {
  const loc = mockLocation(0, value.length);
  return {
    type: "timestamp",
    value,
    date: {
      type: "date_part",
      value: "2026-01-05",
      year: 2026,
      month: 1,
      day: 5,
      location: loc,
      syntaxNode: mockSyntaxNode(),
    },
    time: {
      type: "time_part",
      value: "18:00",
      hour: 18,
      minute: 0,
      location: loc,
      syntaxNode: mockSyntaxNode(),
    },
    timezone: {
      type: "timezone_part",
      value: "Z",
      offsetMinutes: 0,
      location: loc,
      syntaxNode: mockSyntaxNode(),
    },
    location: loc,
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock Title for testing.
 */
function mockTitle(value: string): Title {
  return {
    type: "title",
    value,
    location: mockLocation(0, value.length),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock Link for testing.
 */
function mockLink(id: string, location?: Location): Link {
  return {
    type: "link",
    id,
    location: location ?? mockLocation(0, id.length + 1), // +1 for ^
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock Tag for testing.
 */
function mockTag(name: string): Tag {
  return {
    type: "tag",
    name,
    location: mockLocation(0, name.length + 1), // +1 for #
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock Key for testing.
 */
function mockKey(value: string): Key {
  return {
    type: "key",
    value,
    location: mockLocation(0, value.length),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock Value with a quoted string.
 */
function mockQuotedValue(value: string): Value {
  return {
    type: "value",
    raw: `"${value}"`,
    content: {
      type: "quoted_value",
      value,
      location: mockLocation(0, value.length + 2),
      syntaxNode: mockSyntaxNode(),
    },
    location: mockLocation(0, value.length + 2),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock Value with a link.
 */
function mockLinkValue(id: string, location?: Location): Value {
  const linkLoc = location ?? mockLocation(0, id.length + 1);
  return {
    type: "value",
    raw: `^${id}`,
    content: {
      type: "link_value",
      link: mockLink(id, linkLoc),
      location: linkLoc,
      syntaxNode: mockSyntaxNode(),
    },
    location: linkLoc,
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock Value with an array of links.
 */
function mockLinkArrayValue(ids: string[]): Value {
  return {
    type: "value",
    raw: ids.map((id) => `^${id}`).join(", "),
    content: {
      type: "value_array",
      elements: ids.map((id) => mockLink(id)),
      location: mockLocation(0, 10),
      syntaxNode: mockSyntaxNode(),
    },
    location: mockLocation(0, 10),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock Metadata entry.
 */
function mockMetadata(key: string, value: Value): Metadata {
  return {
    type: "metadata",
    key: mockKey(key),
    value,
    location: mockLocation(0, 20),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock Identifier for testing.
 */
function mockIdentifier(value: string): Identifier {
  return {
    type: "identifier",
    value,
    location: mockLocation(0, value.length),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock InstanceEntry for testing.
 */
function mockInstanceEntry(options: {
  timestamp: string;
  directive: "create" | "update";
  entity: "lore" | "opinion" | "reference" | "journal";
  title: string;
  link?: string;
  tags?: string[];
  metadata?: Metadata[];
  startIndex?: number;
}): InstanceEntry {
  const startIndex = options.startIndex ?? 0;
  const header: InstanceHeader = {
    type: "instance_header",
    timestamp: mockTimestamp(options.timestamp),
    directive: options.directive,
    entity: options.entity,
    title: mockTitle(options.title),
    link: options.link
      ? mockLink(
          options.link,
          mockLocation(startIndex + 50, startIndex + 50 + options.link.length + 1),
        )
      : null,
    tags: (options.tags ?? []).map(mockTag),
    location: mockLocation(startIndex, startIndex + 100),
    syntaxNode: mockSyntaxNode(),
  };

  return {
    type: "instance_entry",
    header,
    metadata: options.metadata ?? [],
    content: null,
    location: mockLocation(startIndex, startIndex + 200),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock SchemaEntry for testing.
 */
function mockSchemaEntry(options: {
  timestamp: string;
  directive: "define-entity" | "alter-entity";
  entityName: string;
  title: string;
  link?: string;
  tags?: string[];
}): SchemaEntry {
  const header: SchemaHeader = {
    type: "schema_header",
    timestamp: mockTimestamp(options.timestamp),
    directive: options.directive,
    entityName: mockIdentifier(options.entityName),
    title: mockTitle(options.title),
    link: options.link
      ? mockLink(options.link, mockLocation(50, 50 + options.link.length + 1))
      : null,
    tags: (options.tags ?? []).map(mockTag),
    location: mockLocation(0, 100),
    syntaxNode: mockSyntaxNode(),
  };

  return {
    type: "schema_entry",
    header,
    metadataBlock: null,
    sectionsBlock: null,
    removeMetadataBlock: null,
    removeSectionsBlock: null,
    location: mockLocation(0, 200),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock SynthesisEntry for testing.
 */
function mockSynthesisEntry(options: {
  timestamp: string;
  title: string;
  linkId: string;
  tags?: string[];
  metadata?: Metadata[];
}): SynthesisEntry {
  const header: SynthesisHeader = {
    type: "synthesis_header",
    timestamp: mockTimestamp(options.timestamp),
    title: mockTitle(options.title),
    linkId: mockLink(options.linkId, mockLocation(50, 50 + options.linkId.length + 1)),
    tags: (options.tags ?? []).map(mockTag),
    location: mockLocation(0, 100),
    syntaxNode: mockSyntaxNode(),
  };

  return {
    type: "synthesis_entry",
    header,
    metadata: options.metadata ?? [],
    content: null,
    location: mockLocation(0, 200),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock ActualizeEntry for testing.
 */
function mockActualizeEntry(options: {
  timestamp: string;
  target: string;
  metadata?: Metadata[];
}): ActualizeEntry {
  const header: ActualizeHeader = {
    type: "actualize_header",
    timestamp: mockTimestamp(options.timestamp),
    target: mockLink(options.target, mockLocation(50, 50 + options.target.length + 1)),
    location: mockLocation(0, 100),
    syntaxNode: mockSyntaxNode(),
  };

  return {
    type: "actualize_entry",
    header,
    metadata: options.metadata ?? [],
    location: mockLocation(0, 200),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Create a mock SourceFile for testing.
 */
function mockSourceFile(entries: Entry[]): SourceFile {
  return {
    type: "source_file",
    entries,
    syntaxErrors: [],
    location: mockLocation(0, 1000),
    syntaxNode: mockSyntaxNode(),
  };
}

// ===================
// Tests
// ===================

describe("analyze", () => {
  it("should return a SemanticModel with basic properties", () => {
    const ast = mockSourceFile([]);
    const model = analyze(ast, {
      file: "test.thalo",
      source: "",
      sourceMap: mockSourceMap(),
      blocks: [],
    });

    expect(model.ast).toBe(ast);
    expect(model.file).toBe("test.thalo");
    expect(model.source).toBe("");
    expect(model.linkIndex.definitions.size).toBe(0);
    expect(model.linkIndex.references.size).toBe(0);
    expect(model.schemaEntries).toHaveLength(0);
  });

  it("should collect schema entries", () => {
    const schemaEntry = mockSchemaEntry({
      timestamp: "2026-01-05T10:00Z",
      directive: "define-entity",
      entityName: "person",
      title: "Person entity",
    });
    const instanceEntry = mockInstanceEntry({
      timestamp: "2026-01-05T11:00Z",
      directive: "create",
      entity: "lore",
      title: "Some lore",
    });

    const ast = mockSourceFile([schemaEntry, instanceEntry]);
    const model = analyze(ast, {
      file: "test.thalo",
      source: "",
      sourceMap: mockSourceMap(),
      blocks: [],
    });

    expect(model.schemaEntries).toHaveLength(1);
    expect(model.schemaEntries[0]).toBe(schemaEntry);
  });

  it("should collect multiple schema entries", () => {
    const defineEntry = mockSchemaEntry({
      timestamp: "2026-01-05T10:00Z",
      directive: "define-entity",
      entityName: "person",
      title: "Person entity",
    });
    const alterEntry = mockSchemaEntry({
      timestamp: "2026-01-05T11:00Z",
      directive: "alter-entity",
      entityName: "person",
      title: "Add field to person",
    });

    const ast = mockSourceFile([defineEntry, alterEntry]);
    const model = analyze(ast, {
      file: "test.thalo",
      source: "",
      sourceMap: mockSourceMap(),
      blocks: [],
    });

    expect(model.schemaEntries).toHaveLength(2);
    expect(model.schemaEntries[0]).toBe(defineEntry);
    expect(model.schemaEntries[1]).toBe(alterEntry);
  });
});

describe("link indexing", () => {
  describe("link definitions", () => {
    it("should index instance entry link definitions", () => {
      const entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "My lore",
        link: "my-lore",
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.definitions.size).toBe(1);
      expect(index.definitions.has("my-lore")).toBe(true);

      const def = index.definitions.get("my-lore")!;
      expect(def.id).toBe("my-lore");
      expect(def.file).toBe("test.thalo");
      expect(def.entry).toBe(entry);
    });

    it("should index schema entry link definitions", () => {
      const entry = mockSchemaEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "define-entity",
        entityName: "person",
        title: "Person entity",
        link: "person-schema",
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.definitions.size).toBe(1);
      expect(index.definitions.has("person-schema")).toBe(true);
    });

    it("should index synthesis entry link definitions", () => {
      const entry = mockSynthesisEntry({
        timestamp: "2026-01-05T10:00Z",
        title: "My synthesis",
        linkId: "my-synthesis",
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.definitions.size).toBe(1);
      expect(index.definitions.has("my-synthesis")).toBe(true);

      const def = index.definitions.get("my-synthesis")!;
      expect(def.entry).toBe(entry);
    });

    it("should not create definitions for actualize entries", () => {
      const entry = mockActualizeEntry({
        timestamp: "2026-01-05T10:00Z",
        target: "my-synthesis",
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.definitions.size).toBe(0);
    });

    it("should handle entries without link definitions", () => {
      const entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "My lore",
        // No link
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.definitions.size).toBe(0);
    });
  });

  describe("link references", () => {
    it("should index metadata link references in instance entries", () => {
      const refLocation = mockLocation(100, 110);
      const entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "My lore",
        metadata: [mockMetadata("subject", mockLinkValue("self", refLocation))],
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.references.size).toBe(1);
      expect(index.references.has("self")).toBe(true);

      const refs = index.references.get("self")!;
      expect(refs).toHaveLength(1);
      expect(refs[0].id).toBe("self");
      expect(refs[0].file).toBe("test.thalo");
      expect(refs[0].context).toBe("subject");
      expect(refs[0].entry).toBe(entry);
    });

    it("should index metadata link references in synthesis entries", () => {
      const entry = mockSynthesisEntry({
        timestamp: "2026-01-05T10:00Z",
        title: "My synthesis",
        linkId: "my-synthesis",
        metadata: [mockMetadata("related", mockLinkValue("other-entry"))],
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.references.has("other-entry")).toBe(true);
      const refs = index.references.get("other-entry")!;
      expect(refs[0].context).toBe("related");
    });

    it("should index actualize target as a reference", () => {
      const entry = mockActualizeEntry({
        timestamp: "2026-01-05T10:00Z",
        target: "target-synthesis",
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.references.size).toBe(1);
      expect(index.references.has("target-synthesis")).toBe(true);

      const refs = index.references.get("target-synthesis")!;
      expect(refs).toHaveLength(1);
      expect(refs[0].context).toBe("target");
      expect(refs[0].entry).toBe(entry);
    });

    it("should index links in value arrays", () => {
      const entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "My lore",
        metadata: [mockMetadata("related", mockLinkArrayValue(["ref1", "ref2", "ref3"]))],
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.references.size).toBe(3);
      expect(index.references.has("ref1")).toBe(true);
      expect(index.references.has("ref2")).toBe(true);
      expect(index.references.has("ref3")).toBe(true);

      // All should reference the same entry
      for (const id of ["ref1", "ref2", "ref3"]) {
        const refs = index.references.get(id)!;
        expect(refs).toHaveLength(1);
        expect(refs[0].context).toBe("related");
      }
    });

    it("should accumulate multiple references to the same link", () => {
      const entry1 = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "First entry",
        metadata: [mockMetadata("subject", mockLinkValue("shared-target"))],
      });
      const entry2 = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Second entry",
        metadata: [mockMetadata("related", mockLinkValue("shared-target"))],
      });

      const ast = mockSourceFile([entry1, entry2]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.references.has("shared-target")).toBe(true);
      const refs = index.references.get("shared-target")!;
      expect(refs).toHaveLength(2);
      expect(refs[0].entry).toBe(entry1);
      expect(refs[1].entry).toBe(entry2);
    });

    it("should not index non-link metadata values as references", () => {
      const entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "My lore",
        metadata: [mockMetadata("description", mockQuotedValue("Just a string"))],
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      expect(index.references.size).toBe(0);
    });
  });

  describe("mixed definitions and references", () => {
    it("should correctly separate definitions from references", () => {
      const entry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "My lore",
        link: "my-lore",
        metadata: [mockMetadata("subject", mockLinkValue("self"))],
      });

      const ast = mockSourceFile([entry]);
      const index = getLinkIndex(ast, "test.thalo");

      // "my-lore" is a definition
      expect(index.definitions.has("my-lore")).toBe(true);
      expect(index.references.has("my-lore")).toBe(false);

      // "self" is a reference
      expect(index.references.has("self")).toBe(true);
      expect(index.definitions.has("self")).toBe(false);
    });

    it("should handle complex document with multiple entry types", () => {
      const schemaEntry = mockSchemaEntry({
        timestamp: "2026-01-01T10:00Z",
        directive: "define-entity",
        entityName: "person",
        title: "Person entity",
        link: "person-def",
      });
      const instanceEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "About me",
        link: "about-me",
        metadata: [mockMetadata("subject", mockLinkValue("self"))],
      });
      const synthesisEntry = mockSynthesisEntry({
        timestamp: "2026-01-06T10:00Z",
        title: "Career summary",
        linkId: "career-summary",
        metadata: [mockMetadata("sources", mockLinkArrayValue(["about-me", "job-history"]))],
      });
      const actualizeEntry = mockActualizeEntry({
        timestamp: "2026-01-07T10:00Z",
        target: "career-summary",
      });

      const ast = mockSourceFile([schemaEntry, instanceEntry, synthesisEntry, actualizeEntry]);
      const index = getLinkIndex(ast, "test.thalo");

      // Definitions: person-def, about-me, career-summary
      expect(index.definitions.size).toBe(3);
      expect(index.definitions.has("person-def")).toBe(true);
      expect(index.definitions.has("about-me")).toBe(true);
      expect(index.definitions.has("career-summary")).toBe(true);

      // References: self, about-me (in sources), job-history (in sources), career-summary (actualize target)
      expect(index.references.has("self")).toBe(true);
      expect(index.references.has("about-me")).toBe(true);
      expect(index.references.has("job-history")).toBe(true);
      expect(index.references.has("career-summary")).toBe(true);

      // career-summary is both defined and referenced
      expect(index.definitions.has("career-summary")).toBe(true);
      expect(index.references.has("career-summary")).toBe(true);
    });
  });
});

describe("updateSemanticModel", () => {
  /**
   * Helper to create a basic SemanticModel for testing.
   */
  function createModel(entries: Entry[], file: string = "test.thalo"): SemanticModel {
    const ast = mockSourceFile(entries);
    return analyze(ast, {
      file,
      source: "",
      sourceMap: mockSourceMap(),
      blocks: [],
    });
  }

  describe("link definition changes", () => {
    it("should detect added link definitions", () => {
      const oldEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry without link",
        startIndex: 0,
      });

      const model = createModel([oldEntry]);

      const newEntry = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry with link",
        link: "new-link",
        startIndex: 300, // Different location
      });

      const newAst = mockSourceFile([oldEntry, newEntry]);
      const result = updateSemanticModel(model, newAst, "", mockSourceMap(), []);

      expect(result.addedLinkDefinitions).toContain("new-link");
      expect(model.linkIndex.definitions.has("new-link")).toBe(true);
    });

    it("should detect removed link definitions", () => {
      const entry1 = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry 1",
        link: "link-1",
        startIndex: 0,
      });
      const entry2 = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry 2",
        link: "link-2",
        startIndex: 300, // Different location
      });

      const model = createModel([entry1, entry2]);
      expect(model.linkIndex.definitions.has("link-1")).toBe(true);
      expect(model.linkIndex.definitions.has("link-2")).toBe(true);

      // Remove entry2
      const newAst = mockSourceFile([entry1]);
      const result = updateSemanticModel(model, newAst, "", mockSourceMap(), []);

      expect(result.removedLinkDefinitions).toContain("link-2");
      expect(model.linkIndex.definitions.has("link-2")).toBe(false);
      expect(model.linkIndex.definitions.has("link-1")).toBe(true);
    });
  });

  describe("link reference changes", () => {
    it("should detect added link references", () => {
      const oldEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry without refs",
        startIndex: 0,
      });

      const model = createModel([oldEntry]);

      const newEntry = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry with refs",
        metadata: [mockMetadata("subject", mockLinkValue("new-ref"))],
        startIndex: 300, // Different location
      });

      const newAst = mockSourceFile([oldEntry, newEntry]);
      const result = updateSemanticModel(model, newAst, "", mockSourceMap(), []);

      expect(result.changedLinkReferences).toContain("new-ref");
      expect(model.linkIndex.references.has("new-ref")).toBe(true);
    });

    it("should detect removed link references", () => {
      const entry1 = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "Entry with ref",
        metadata: [mockMetadata("subject", mockLinkValue("my-ref"))],
        startIndex: 0,
      });

      const model = createModel([entry1]);
      expect(model.linkIndex.references.has("my-ref")).toBe(true);

      // Remove the entry
      const newAst = mockSourceFile([]);
      const result = updateSemanticModel(model, newAst, "", mockSourceMap(), []);

      expect(result.changedLinkReferences).toContain("my-ref");
      expect(model.linkIndex.references.has("my-ref")).toBe(false);
    });
  });

  describe("schema entry changes", () => {
    it("should detect added schema entries", () => {
      const model = createModel([]);

      const newSchemaEntry = mockSchemaEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "define-entity",
        entityName: "person",
        title: "Person entity",
      });

      const newAst = mockSourceFile([newSchemaEntry]);
      const result = updateSemanticModel(model, newAst, "", mockSourceMap(), []);

      expect(result.schemaEntriesChanged).toBe(true);
      expect(result.changedEntityNames).toContain("person");
      expect(model.schemaEntries).toHaveLength(1);
    });

    it("should detect removed schema entries", () => {
      const schemaEntry = mockSchemaEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "define-entity",
        entityName: "person",
        title: "Person entity",
      });

      const model = createModel([schemaEntry]);
      expect(model.schemaEntries).toHaveLength(1);

      const newAst = mockSourceFile([]);
      const result = updateSemanticModel(model, newAst, "", mockSourceMap(), []);

      expect(result.schemaEntriesChanged).toBe(true);
      expect(result.changedEntityNames).toContain("person");
      expect(model.schemaEntries).toHaveLength(0);
    });

    it("should not mark unchanged schema entries as changed", () => {
      const schemaEntry = mockSchemaEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "define-entity",
        entityName: "person",
        title: "Person entity",
      });
      const instanceEntry = mockInstanceEntry({
        timestamp: "2026-01-05T11:00Z",
        directive: "create",
        entity: "lore",
        title: "Some lore",
      });

      const model = createModel([schemaEntry, instanceEntry]);

      // Add another instance entry, but keep schema the same
      const newInstanceEntry = mockInstanceEntry({
        timestamp: "2026-01-05T12:00Z",
        directive: "create",
        entity: "lore",
        title: "More lore",
        link: "more-lore",
      });

      const newAst = mockSourceFile([schemaEntry, instanceEntry, newInstanceEntry]);
      const result = updateSemanticModel(model, newAst, "", mockSourceMap(), []);

      expect(result.schemaEntriesChanged).toBe(false);
      expect(result.changedEntityNames).toHaveLength(0);
    });
  });

  describe("model update", () => {
    it("should update the model's AST", () => {
      const model = createModel([]);
      const newEntry = mockInstanceEntry({
        timestamp: "2026-01-05T10:00Z",
        directive: "create",
        entity: "lore",
        title: "New entry",
      });
      const newAst = mockSourceFile([newEntry]);

      updateSemanticModel(model, newAst, "new source", mockSourceMap(), []);

      expect(model.ast).toBe(newAst);
      expect(model.source).toBe("new source");
    });

    it("should clear dirty flags after update", () => {
      const model = createModel([]);
      const newAst = mockSourceFile([]);

      updateSemanticModel(model, newAst, "", mockSourceMap(), []);

      expect(model.dirty?.linkIndex).toBe(false);
      expect(model.dirty?.schemaEntries).toBe(false);
    });
  });
});
