import { describe, it, expect, beforeEach } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Workspace } from "@wilco/ptall";
import { CompletionItemKind, type CompletionParams, type Position } from "vscode-languageserver";
import { handleCompletion, handleCompletionResolve, detectContext } from "./index.js";
import type { CompletionContext, CompletionContextKind } from "./context.js";
import {
  timestampProvider,
  directiveProvider,
  entityProvider,
  metadataKeyProvider,
  metadataValueProvider,
  linkProvider,
  tagProvider,
  sectionProvider,
  schemaBlockProvider,
  typeExprProvider,
} from "./providers/index.js";

// ===================
// Test Helpers
// ===================

/**
 * Create a TextDocument for testing.
 */
function createDocument(content: string, uri = "file:///test.ptall"): TextDocument {
  return TextDocument.create(uri, "ptall", 1, content);
}

/**
 * Create a document and position from content with a cursor marker (|).
 * The cursor marker is removed from the content and the position is set to that location.
 */
function createDocumentWithCursor(contentWithCursor: string): {
  document: TextDocument;
  position: Position;
} {
  const lines = contentWithCursor.split("\n");
  let cursorLine = 0;
  let cursorChar = 0;
  let found = false;

  const cleanedLines = lines.map((line, lineIdx) => {
    const cursorIdx = line.indexOf("|");
    if (cursorIdx !== -1 && !found) {
      cursorLine = lineIdx;
      cursorChar = cursorIdx;
      found = true;
      return line.slice(0, cursorIdx) + line.slice(cursorIdx + 1);
    }
    return line;
  });

  const content = cleanedLines.join("\n");
  return {
    document: createDocument(content),
    position: { line: cursorLine, character: cursorChar },
  };
}

/**
 * Create CompletionParams at a given position.
 */
function createParams(position: Position): CompletionParams {
  return {
    textDocument: { uri: "file:///test.ptall" },
    position,
  };
}

/**
 * Shorthand for detecting context from content with cursor marker.
 */
function detectContextFromMarker(contentWithCursor: string): CompletionContext {
  const { document, position } = createDocumentWithCursor(contentWithCursor);
  return detectContext(document, position);
}

/**
 * Get completions from content with cursor marker.
 */
function completeFromMarker(
  workspace: Workspace,
  contentWithCursor: string,
): ReturnType<typeof handleCompletion> {
  const { document, position } = createDocumentWithCursor(contentWithCursor);
  return handleCompletion(workspace, document, createParams(position));
}

/**
 * Create a minimal context for testing providers directly.
 */
function createTestContext(
  kind: CompletionContextKind,
  partial: string = "",
  entry: CompletionContext["entry"] = {},
  metadataKey?: string,
): CompletionContext {
  return {
    kind,
    textBefore: "",
    lineText: "",
    lineNumber: 0,
    entry,
    partial,
    metadataKey,
  };
}

// ===================
// Context Detection Tests
// ===================

describe("detectContext", () => {
  describe("line_start", () => {
    // In these tests, the | sign indicates the cursor position
    it("returns line_start at beginning of empty line", () => {
      const ctx = detectContextFromMarker("|");
      expect(ctx.kind).toBe("line_start");
    });

    it("returns line_start at empty line after entry", () => {
      const ctx = detectContextFromMarker(`2026-01-05T18:00 create lore "Test"
  type: "fact"

|`);
      expect(ctx.kind).toBe("line_start");
    });
  });

  describe("after_timestamp", () => {
    it("returns after_timestamp after valid timestamp with space", () => {
      const ctx = detectContextFromMarker("2026-01-06T14:30 |");
      expect(ctx.kind).toBe("after_timestamp");
    });

    it("returns after_timestamp when typing directive", () => {
      const ctx = detectContextFromMarker("2026-01-06T14:30 cre|");
      expect(ctx.kind).toBe("after_timestamp");
      expect(ctx.partial).toBe("cre");
    });
  });

  describe("after_directive", () => {
    it("returns after_directive after create", () => {
      const ctx = detectContextFromMarker("2026-01-06T14:30 create |");
      expect(ctx.kind).toBe("after_directive");
      expect(ctx.entry.directive).toBe("create");
    });

    it("returns after_directive after update", () => {
      const ctx = detectContextFromMarker("2026-01-06T14:30 update |");
      expect(ctx.kind).toBe("after_directive");
      expect(ctx.entry.directive).toBe("update");
    });

    it("returns after_directive after define-entity", () => {
      const ctx = detectContextFromMarker("2026-01-06T14:30 define-entity |");
      expect(ctx.kind).toBe("after_directive");
      expect(ctx.entry.directive).toBe("define-entity");
      expect(ctx.entry.isSchemaEntry).toBe(true);
    });

    it("returns after_directive after alter-entity", () => {
      const ctx = detectContextFromMarker("2026-01-06T14:30 alter-entity |");
      expect(ctx.kind).toBe("after_directive");
      expect(ctx.entry.directive).toBe("alter-entity");
      expect(ctx.entry.isSchemaEntry).toBe(true);
    });

    it("returns after_directive after define-synthesis", () => {
      const ctx = detectContextFromMarker("2026-01-06T14:30 define-synthesis |");
      expect(ctx.kind).toBe("after_directive");
      expect(ctx.entry.directive).toBe("define-synthesis");
      expect(ctx.entry.isSynthesisEntry).toBe(true);
    });

    it("returns after_directive after actualize-synthesis", () => {
      const ctx = detectContextFromMarker("2026-01-06T14:30 actualize-synthesis |");
      expect(ctx.kind).toBe("after_directive");
      expect(ctx.entry.directive).toBe("actualize-synthesis");
      expect(ctx.entry.isSynthesisEntry).toBe(true);
    });

    it("returns after_directive when typing entity", () => {
      const ctx = detectContextFromMarker("2026-01-06T14:30 create lo|");
      expect(ctx.kind).toBe("after_directive");
      expect(ctx.partial).toBe("lo");
    });
  });

  describe("header_suffix", () => {
    it("returns header_suffix after title", () => {
      const ctx = detectContextFromMarker('2026-01-06T14:30 create lore "Title" |');
      expect(ctx.kind).toBe("header_suffix");
    });

    it("returns header_suffix after title with space for tags/links", () => {
      const ctx = detectContextFromMarker('2026-01-06T14:30 create lore "Title" #test |');
      expect(ctx.kind).toBe("header_suffix");
    });
  });

  describe("metadata_key", () => {
    it("returns metadata_key on indented line after header", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 create lore "Title"
  |`);
      expect(ctx.kind).toBe("metadata_key");
      expect(ctx.entry.entity).toBe("lore");
    });

    it("returns metadata_key when typing key", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 create lore "Title"
  typ|`);
      expect(ctx.kind).toBe("metadata_key");
      expect(ctx.partial).toBe("typ");
    });

    it("includes existing metadata keys", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 create lore "Title"
  type: "fact"
  |`);
      expect(ctx.kind).toBe("metadata_key");
      expect(ctx.entry.existingMetadataKeys).toContain("type");
    });

    it("returns metadata_key for synthesis entries", () => {
      const ctx =
        detectContextFromMarker(`2026-01-06T14:30 define-synthesis "Career Summary" ^career-summary
  |`);
      expect(ctx.kind).toBe("metadata_key");
      expect(ctx.entry.isSynthesisEntry).toBe(true);
      expect(ctx.entry.entity).toBe("synthesis");
    });

    it("returns metadata_key for actualize entries", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 actualize-synthesis ^career-summary
  |`);
      expect(ctx.kind).toBe("metadata_key");
      expect(ctx.entry.isSynthesisEntry).toBe(true);
    });
  });

  describe("metadata_value", () => {
    it("returns metadata_value after colon", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 create lore "Title"
  type: |`);
      expect(ctx.kind).toBe("metadata_value");
      expect(ctx.metadataKey).toBe("type");
    });

    it("returns metadata_value when typing value", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 create lore "Title"
  type: fac|`);
      expect(ctx.kind).toBe("metadata_value");
      expect(ctx.metadataKey).toBe("type");
      expect(ctx.partial).toBe("fac");
    });
  });

  describe("link", () => {
    it("returns link after ^ character", () => {
      const ctx = detectContextFromMarker("  related: ^|");
      expect(ctx.kind).toBe("link");
    });

    it("returns link when typing link ID", () => {
      const ctx = detectContextFromMarker("  related: ^my-lin|");
      expect(ctx.kind).toBe("link");
      expect(ctx.partial).toBe("my-lin");
    });

    it("returns link in header position", () => {
      const ctx = detectContextFromMarker('2026-01-06T14:30 create lore "Title" ^|');
      expect(ctx.kind).toBe("link");
    });
  });

  describe("tag", () => {
    it("returns tag after # in header (not markdown)", () => {
      const ctx = detectContextFromMarker('2026-01-06T14:30 create lore "Title" #|');
      expect(ctx.kind).toBe("tag");
    });

    it("returns tag when typing tag name", () => {
      const ctx = detectContextFromMarker('2026-01-06T14:30 create lore "Title" #type|');
      expect(ctx.kind).toBe("tag");
      expect(ctx.partial).toBe("type");
    });

    it("does not return tag for markdown headers at line start", () => {
      const ctx = detectContextFromMarker("  # |");
      // This is in content area after blank line, should be section_header or unknown
      expect(ctx.kind).not.toBe("tag");
    });
  });

  describe("section_header", () => {
    it("returns section_header for # in content area", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 create opinion "Title"
  confidence: "high"

  #|`);
      expect(ctx.kind).toBe("section_header");
    });

    it("returns section_header at # position", () => {
      // Note: After typing more than just "# ", the context becomes harder to detect
      // because we can't easily distinguish section headers from regular markdown content.
      // The completion triggers best right after typing "#"
      const ctx = detectContextFromMarker(`2026-01-06T14:30 create opinion "Title"
  confidence: "high"

  #|`);
      expect(ctx.kind).toBe("section_header");
    });
  });

  describe("schema_block_header", () => {
    it("returns schema_block_header in define-entity", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 define-entity myentity "Desc"
  #|`);
      expect(ctx.kind).toBe("schema_block_header");
      expect(ctx.entry.isSchemaEntry).toBe(true);
    });

    it("returns schema_block_header when typing header", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 define-entity myentity "Desc"
  # Meta|`);
      expect(ctx.kind).toBe("schema_block_header");
    });
  });

  describe("field_type", () => {
    it("returns field_type after field name in schema", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 define-entity myentity "Desc"
  # Metadata
  myfield: |`);
      expect(ctx.kind).toBe("field_type");
    });

    it("returns field_type with optional marker", () => {
      const ctx = detectContextFromMarker(`2026-01-06T14:30 define-entity myentity "Desc"
  # Metadata
  myfield?: |`);
      expect(ctx.kind).toBe("field_type");
    });
  });
});

// ===================
// Provider Unit Tests
// ===================

describe("TimestampProvider", () => {
  it("provides current timestamp at line start", () => {
    const ctx = createTestContext("line_start");
    const workspace = new Workspace();
    const items = timestampProvider.getCompletions(ctx, workspace);

    expect(items).toHaveLength(1);
    expect(items[0].insertText).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2} $/);
    expect(items[0].label).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("DirectiveProvider", () => {
  it("provides all directives after timestamp", () => {
    const ctx = createTestContext("after_timestamp");
    const workspace = new Workspace();
    const items = directiveProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("create");
    expect(labels).toContain("update");
    expect(labels).toContain("define-entity");
    expect(labels).toContain("alter-entity");
    expect(labels).toContain("define-synthesis");
    expect(labels).toContain("actualize-synthesis");
  });

  it("filters directives by partial text", () => {
    const ctx = createTestContext("after_timestamp", "def");
    const workspace = new Workspace();
    const items = directiveProvider.getCompletions(ctx, workspace);

    expect(items).toHaveLength(2);
    const labels = items.map((i) => i.label);
    expect(labels).toContain("define-entity");
    expect(labels).toContain("define-synthesis");
  });

  it("filters directives by partial text for actualize", () => {
    const ctx = createTestContext("after_timestamp", "act");
    const workspace = new Workspace();
    const items = directiveProvider.getCompletions(ctx, workspace);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("actualize-synthesis");
  });

  it("includes synthesis directives description", () => {
    const ctx = createTestContext("after_timestamp");
    const workspace = new Workspace();
    const items = directiveProvider.getCompletions(ctx, workspace);

    const defineSynthesis = items.find((i) => i.label === "define-synthesis");
    expect(defineSynthesis).toBeDefined();
    expect((defineSynthesis!.documentation as { value: string }).value).toContain("LLM");

    const actualizeSynthesis = items.find((i) => i.label === "actualize-synthesis");
    expect(actualizeSynthesis).toBeDefined();
    expect((actualizeSynthesis!.documentation as { value: string }).value).toContain("Trigger");
  });
});

describe("EntityProvider", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
  });

  it("provides entities from schema registry for create directive", () => {
    const schemaSource = `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: string

2026-01-01T00:01 define-entity opinion "Opinion entries"
  # Metadata
  confidence: string
`;
    workspace.addDocument(schemaSource, { filename: "schema.ptall" });

    const ctx = createTestContext("after_directive", "", { directive: "create" });
    const items = entityProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("lore");
    expect(labels).toContain("opinion");
  });

  it("returns empty when no entities defined", () => {
    const ctx = createTestContext("after_directive", "", { directive: "create" });
    const items = entityProvider.getCompletions(ctx, workspace);

    expect(items).toHaveLength(0);
  });

  it("provides schema-defined entities for alter-entity", () => {
    const schemaSource = `2026-01-01T00:00 define-entity custom-entity "Custom"
  # Metadata
  field: string
`;
    workspace.addDocument(schemaSource, { filename: "schema.ptall" });

    const ctx = createTestContext("after_directive", "", { directive: "alter-entity" });
    const items = entityProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("custom-entity");
  });

  it("filters entities by partial text", () => {
    const schemaSource = `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: string

2026-01-01T00:01 define-entity opinion "Opinion entries"
  # Metadata
  confidence: string
`;
    workspace.addDocument(schemaSource, { filename: "schema.ptall" });

    const ctx = createTestContext("after_directive", "lo", { directive: "create" });
    const items = entityProvider.getCompletions(ctx, workspace);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("lore");
  });
});

describe("MetadataKeyProvider", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    const schemaSource = `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  date?: date-range
`;
    workspace.addDocument(schemaSource, { filename: "schema.ptall" });
  });

  it("provides field names from entity schema", () => {
    const ctx = createTestContext("metadata_key", "", { entity: "lore" });
    const items = metadataKeyProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("type");
    expect(labels).toContain("subject");
    expect(labels).toContain("date");
  });

  it("filters already-used metadata keys", () => {
    const ctx = createTestContext("metadata_key", "", {
      entity: "lore",
      existingMetadataKeys: ["type"],
    });
    const items = metadataKeyProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).not.toContain("type");
    expect(labels).toContain("subject");
  });

  it("sorts required fields before optional fields", () => {
    const ctx = createTestContext("metadata_key", "", { entity: "lore" });
    const items = metadataKeyProvider.getCompletions(ctx, workspace);

    const typeItem = items.find((i) => i.label === "type");
    const dateItem = items.find((i) => i.label === "date");

    // Required fields have sortText starting with "0", optional with "1"
    expect(typeItem?.sortText?.startsWith("0")).toBe(true);
    expect(dateItem?.sortText?.startsWith("1")).toBe(true);
  });

  it("skips for schema entries", () => {
    const ctx = createTestContext("metadata_key", "", { entity: "lore", isSchemaEntry: true });
    const items = metadataKeyProvider.getCompletions(ctx, workspace);

    expect(items).toHaveLength(0);
  });
});

describe("MetadataValueProvider", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    const schemaSource = `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string | link
`;
    workspace.addDocument(schemaSource, { filename: "schema.ptall" });
  });

  it("provides literal values for union type", () => {
    const ctx = createTestContext("metadata_value", "", { entity: "lore" }, "type");
    const items = metadataValueProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("fact");
    expect(labels).toContain("insight");
  });

  it("provides ^self for subject field with link type", () => {
    const ctx = createTestContext("metadata_value", "", { entity: "lore" }, "subject");
    const items = metadataValueProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("^self");
  });

  it("filters values by partial text", () => {
    const ctx = createTestContext("metadata_value", "fac", { entity: "lore" }, "type");
    const items = metadataValueProvider.getCompletions(ctx, workspace);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("fact");
  });
});

describe("LinkProvider", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    const source = `2026-01-05T18:00 create lore "Test entry" ^my-lore #test
  type: "fact"

2026-01-05T19:00 create opinion "Another entry" ^my-opinion #test
  confidence: "high"
`;
    workspace.addDocument(source, { filename: "test.ptall" });
  });

  it("provides existing link IDs from workspace", () => {
    const ctx = createTestContext("link", "");
    const items = linkProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    // Only explicit link IDs should be suggested (timestamps are not link IDs)
    expect(labels).toContain("^my-lore");
    expect(labels).toContain("^my-opinion");
    expect(labels).not.toContain("^2026-01-05T18:00");
    expect(labels).not.toContain("^2026-01-05T19:00");
  });

  it("filters by partial text", () => {
    const ctx = createTestContext("link", "my-l");
    const items = linkProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("^my-lore");
    expect(labels).not.toContain("^my-opinion");
  });

  it("filters by title when link ID doesn't match", () => {
    const ctx = createTestContext("link", "test");
    const items = linkProvider.getCompletions(ctx, workspace);

    // Both entries have "Test" or "Another" - "test" should match "Test entry"
    expect(items.length).toBeGreaterThan(0);
  });

  it("sets insertText without ^ prefix", () => {
    const ctx = createTestContext("link", "my-lore");
    const items = linkProvider.getCompletions(ctx, workspace);

    const loreItem = items.find((i) => i.label === "^my-lore");
    expect(loreItem?.insertText).toBe("my-lore");
  });
});

describe("TagProvider", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    const source = `2026-01-05T18:00 create lore "Entry 1" #typescript #testing
  type: "fact"

2026-01-05T19:00 create lore "Entry 2" #typescript #architecture
  type: "insight"
`;
    workspace.addDocument(source, { filename: "test.ptall" });
  });

  it("provides existing tags with counts", () => {
    const ctx = createTestContext("tag", "");
    const items = tagProvider.getCompletions(ctx, workspace);

    const tsItem = items.find((i) => i.label === "#typescript");
    expect(tsItem).toBeDefined();
    expect(tsItem!.detail).toBe("2 entries");

    const testingItem = items.find((i) => i.label === "#testing");
    expect(testingItem).toBeDefined();
    expect(testingItem!.detail).toBe("1 entry");
  });

  it("filters tags by partial text", () => {
    const ctx = createTestContext("tag", "type");
    const items = tagProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("#typescript");
    expect(labels).not.toContain("#testing");
  });

  it("sets insertText without # prefix", () => {
    const ctx = createTestContext("tag", "");
    const items = tagProvider.getCompletions(ctx, workspace);

    const tsItem = items.find((i) => i.label === "#typescript");
    expect(tsItem?.insertText).toBe("typescript");
  });
});

describe("SectionProvider", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();
    const schemaSource = `2026-01-01T00:00 define-entity opinion "Opinions"
  # Metadata
  confidence: "high" | "medium" | "low"
  # Sections
  Claim
  Reasoning
  Caveats?
`;
    workspace.addDocument(schemaSource, { filename: "schema.ptall" });
  });

  it("provides section names from entity schema", () => {
    const ctx = createTestContext("section_header", "", { entity: "opinion" });
    const items = sectionProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("Claim");
    expect(labels).toContain("Reasoning");
    expect(labels).toContain("Caveats");
  });

  it("sorts required sections first", () => {
    const ctx = createTestContext("section_header", "", { entity: "opinion" });
    const items = sectionProvider.getCompletions(ctx, workspace);

    const claimItem = items.find((i) => i.label === "Claim");
    const caveatsItem = items.find((i) => i.label === "Caveats");

    // Required sections have sortText starting with "0", optional with "1"
    expect(claimItem?.sortText?.startsWith("0")).toBe(true);
    expect(caveatsItem?.sortText?.startsWith("1")).toBe(true);
  });

  it("filters by partial text", () => {
    const ctx = createTestContext("section_header", "cl", { entity: "opinion" });
    const items = sectionProvider.getCompletions(ctx, workspace);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Claim");
  });
});

describe("SchemaBlockProvider", () => {
  it("provides schema block headers for define-entity", () => {
    const ctx = createTestContext("schema_block_header", "#", { directive: "define-entity" });
    const workspace = new Workspace();
    const items = schemaBlockProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("# Metadata");
    expect(labels).toContain("# Sections");
    // Remove blocks should not appear for define-entity
    expect(labels).not.toContain("# Remove Metadata");
    expect(labels).not.toContain("# Remove Sections");
  });

  it("provides all block headers for alter-entity", () => {
    const ctx = createTestContext("schema_block_header", "#", { directive: "alter-entity" });
    const workspace = new Workspace();
    const items = schemaBlockProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("# Metadata");
    expect(labels).toContain("# Sections");
    expect(labels).toContain("# Remove Metadata");
    expect(labels).toContain("# Remove Sections");
  });

  it("filters by partial text", () => {
    const ctx = createTestContext("schema_block_header", "# Meta", { directive: "define-entity" });
    const workspace = new Workspace();
    const items = schemaBlockProvider.getCompletions(ctx, workspace);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("# Metadata");
  });
});

describe("TypeExprProvider", () => {
  it("provides primitive types", () => {
    const ctx = createTestContext("field_type", "");
    const workspace = new Workspace();
    const items = typeExprProvider.getCompletions(ctx, workspace);

    const labels = items.map((i) => i.label);
    expect(labels).toContain("string");
    expect(labels).toContain("datetime");
    expect(labels).toContain("date-range");
    expect(labels).toContain("link");
  });

  it("provides literal type suggestion", () => {
    const ctx = createTestContext("field_type", "");
    const workspace = new Workspace();
    const items = typeExprProvider.getCompletions(ctx, workspace);

    const literalItem = items.find((i) => i.label === '"..."');
    expect(literalItem).toBeDefined();
  });

  it("filters by partial text", () => {
    const ctx = createTestContext("field_type", "str");
    const workspace = new Workspace();
    const items = typeExprProvider.getCompletions(ctx, workspace);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("string");
  });
});

// ===================
// Integration Tests
// ===================

describe("handleCompletion integration", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();

    // Add schema definitions
    const schemaSource = `2026-01-01T00:00 define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string | link
  date?: date-range
  # Sections
  Summary?

2026-01-01T00:01 define-entity opinion "Opinion entries"
  # Metadata
  confidence: "high" | "medium" | "low"
  # Sections
  Claim
  Reasoning
  Caveats?
`;
    workspace.addDocument(schemaSource, { filename: "schemas.ptall" });

    // Add some content
    const contentSource = `2026-01-05T18:00 create lore "Existing lore entry" ^existing-lore #typescript #architecture
  type: "fact"
  subject: ^test-subject

  # Summary
  Test summary.
`;
    workspace.addDocument(contentSource, { filename: "content.ptall" });
  });

  it("completes full lore entry workflow", () => {
    // Step 1: Empty line -> timestamp
    let items = completeFromMarker(workspace, "|");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].insertText).toMatch(/\d{4}-\d{2}-\d{2}T/);

    // Step 2: After timestamp -> directives
    items = completeFromMarker(workspace, "2026-01-06T14:30 |");
    expect(items.map((i) => i.label)).toContain("create");
    expect(items.map((i) => i.label)).toContain("update");

    // Step 3: After create -> entities
    items = completeFromMarker(workspace, "2026-01-06T14:30 create |");
    expect(items.map((i) => i.label)).toContain("lore");
    expect(items.map((i) => i.label)).toContain("opinion");

    // Step 4: Metadata key
    items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 create lore "Title"
  |`,
    );
    expect(items.map((i) => i.label)).toContain("type");
    expect(items.map((i) => i.label)).toContain("subject");

    // Step 5: Metadata value
    items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 create lore "Title"
  type: |`,
    );
    expect(items.map((i) => i.label)).toContain("fact");
    expect(items.map((i) => i.label)).toContain("insight");

    // Step 6: Section header
    items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 create lore "Title"
  type: "fact"
  subject: ^test

  # |`,
    );
    expect(items.map((i) => i.label)).toContain("Summary");
  });

  it("handles schema entry completions", () => {
    // After define-entity -> block headers
    let items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 define-entity myentity "Desc"
  #|`,
    );
    expect(items.map((i) => i.label)).toContain("# Metadata");
    expect(items.map((i) => i.label)).toContain("# Sections");

    // Field type completion
    items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 define-entity myentity "Desc"
  # Metadata
  myfield: |`,
    );
    expect(items.map((i) => i.label)).toContain("string");
    expect(items.map((i) => i.label)).toContain("link");
    expect(items.map((i) => i.label)).toContain("datetime");
  });

  it("provides link completions", () => {
    const items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 create lore "Title"
  related: ^|`,
    );
    expect(items.map((i) => i.label)).toContain("^existing-lore");
  });

  it("provides tag completions", () => {
    const items = completeFromMarker(workspace, '2026-01-06T14:30 create lore "Title" #|');
    expect(items.map((i) => i.label)).toContain("#typescript");
    expect(items.map((i) => i.label)).toContain("#architecture");
  });
});

// ===================
// Edge Case Tests
// ===================

describe("edge cases", () => {
  it("handles empty workspace gracefully", () => {
    const workspace = new Workspace();
    const items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 create lore "Title"
  type: |`,
    );
    // Should not crash, may return empty
    expect(items).toBeDefined();
  });

  it("handles workspace without schema gracefully", () => {
    const workspace = new Workspace();
    const items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 create lore "Title"
  |`,
    );
    // Should not crash, returns empty without schema
    expect(items).toBeDefined();
  });

  it("handles cursor at various indentation levels", () => {
    const workspace = new Workspace();
    const schemaSource = `2026-01-01T00:00 define-entity lore "Lore"
  # Metadata
  type: string
`;
    workspace.addDocument(schemaSource, { filename: "schema.ptall" });

    // 2-space indent
    let items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 create lore "Title"
  |`,
    );
    expect(items.length).toBeGreaterThan(0);

    // 4-space indent
    items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 create lore "Title"
    |`,
    );
    expect(items.length).toBeGreaterThan(0);
  });

  it("filters completions by partial text correctly", () => {
    const workspace = new Workspace();
    const schemaSource = `2026-01-01T00:00 define-entity lore "Lore"
  # Metadata
  type: "fact" | "insight"
  subject: string
`;
    workspace.addDocument(schemaSource, { filename: "schema.ptall" });

    const items = completeFromMarker(
      workspace,
      `2026-01-06T14:30 create lore "Title"
  type: in|`,
    );

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("insight");
  });
});

describe("handleCompletionResolve", () => {
  it("returns the item unchanged (all details already provided)", () => {
    const item = {
      label: "^test-link",
      kind: CompletionItemKind.Reference,
      detail: "Test entry",
      insertText: "test-link",
    };

    const resolved = handleCompletionResolve(item);

    expect(resolved).toEqual(item);
  });
});
