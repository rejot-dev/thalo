import { describe, it, expect, beforeEach } from "vitest";
import type { SyntaxNode } from "tree-sitter";
import { createWorkspace } from "../parser.native.js";
import { Workspace } from "../model/workspace.js";
import { check, checkModel, checkDocument, checkIncremental } from "./check.js";
import type {
  SourceFile,
  InstanceEntry,
  InstanceHeader,
  Timestamp,
  Title,
  Location,
  SyntaxErrorNode,
} from "../ast/ast-types.js";

// ===================
// Test Helpers
// ===================

const mockLocation = (start = 0, end = 10): Location => ({
  startIndex: start,
  endIndex: end,
  startPosition: { row: 0, column: start },
  endPosition: { row: 0, column: end },
});

// Safe: mock object with required SyntaxNode properties for testing
const mockSyntaxNode = () =>
  ({
    type: "mock",
    text: "mock",
    startIndex: 0,
    endIndex: 10,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 10 },
  }) as unknown as SyntaxNode;

/**
 * Create an AST with a syntax error (missing timezone).
 * This simulates what the AST builder would produce for invalid input.
 */
function createAstWithSyntaxError(): SourceFile {
  const syntaxError: SyntaxErrorNode<"missing_timezone"> = {
    type: "syntax_error",
    code: "missing_timezone",
    message: "Timestamp requires timezone (e.g., Z or +05:30)",
    text: "2026-01-05T18:00",
    location: mockLocation(16, 16),
    syntaxNode: mockSyntaxNode(),
  };

  const timestamp: Timestamp = {
    type: "timestamp",
    value: "2026-01-05T18:00",
    date: {
      type: "date_part",
      year: 2026,
      month: 1,
      day: 5,
      value: "2026-01-05",
      location: mockLocation(0, 10),
      syntaxNode: mockSyntaxNode(),
    },
    time: {
      type: "time_part",
      hour: 18,
      minute: 0,
      value: "18:00",
      location: mockLocation(11, 16),
      syntaxNode: mockSyntaxNode(),
    },
    timezone: syntaxError,
    location: mockLocation(0, 16),
    syntaxNode: mockSyntaxNode(),
  };

  const title: Title = {
    type: "title",
    value: "Entry with error",
    location: mockLocation(17, 33),
    syntaxNode: mockSyntaxNode(),
  };

  const header: InstanceHeader = {
    type: "instance_header",
    timestamp,
    directive: "create",
    entity: "lore",
    title,
    link: null,
    tags: [],
    location: mockLocation(0, 33),
    syntaxNode: mockSyntaxNode(),
  };

  const entry: InstanceEntry = {
    type: "instance_entry",
    header,
    metadata: [],
    content: null,
    location: mockLocation(0, 33),
    syntaxNode: mockSyntaxNode(),
  };

  return {
    type: "source_file",
    entries: [entry],
    syntaxErrors: [],
    location: mockLocation(0, 33),
    syntaxNode: mockSyntaxNode(),
  };
}

// ===================
// Integration Tests
// ===================

describe("check", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  describe("syntax error collection", () => {
    it("should report no syntax errors for valid documents", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact"
`,
        { filename: "schema.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Test entry" #test
  type: "fact"
`,
        { filename: "test.thalo" },
      );

      const diagnostics = check(workspace);
      const syntaxErrors = diagnostics.filter((d) => d.code.startsWith("syntax-"));

      expect(syntaxErrors).toHaveLength(0);
    });

    it("should collect syntax errors from AST and convert to diagnostics", () => {
      // Add a schema first
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact"
`,
        { filename: "schema.thalo" },
      );

      // Get a model and manually inject an AST with syntax errors
      // This tests the infrastructure without relying on grammar allowing invalid input
      const model = workspace.getModel("schema.thalo")!;

      // Replace AST with one containing a syntax error
      const originalAst = model.ast;
      Object.assign(model, { ast: createAstWithSyntaxError() });

      const diagnostics = check(workspace);
      const syntaxErrors = diagnostics.filter((d) => d.code.startsWith("syntax-"));

      expect(syntaxErrors).toHaveLength(1);
      expect(syntaxErrors[0].code).toBe("syntax-missing_timezone");
      expect(syntaxErrors[0].severity).toBe("error");
      expect(syntaxErrors[0].message).toContain("Timestamp requires timezone");
      expect(syntaxErrors[0].file).toBe("schema.thalo");

      // Restore original AST
      Object.assign(model, { ast: originalAst });
    });
  });

  describe("root-level syntax errors", () => {
    it("should report syntax errors for entries with invalid timestamp (missing timezone)", () => {
      // This entry has an invalid timestamp missing the timezone (e.g., Z or +05:30)
      // The parser will create an ERROR node at the root level for this
      workspace.addDocument(
        `2026-01-09T16:07 create lore "Invalid entry" #test
`,
        { filename: "test.thalo" },
      );

      const diagnostics = check(workspace);
      const syntaxErrors = diagnostics.filter((d) => d.code.startsWith("syntax-"));

      expect(syntaxErrors.length).toBeGreaterThanOrEqual(1);
      expect(syntaxErrors[0].severity).toBe("error");
    });

    it("should report syntax errors for malformed entries mixed with valid ones", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact"

  # Sections
  Description

2026-01-05T18:00Z create lore "Valid entry" #test
  type: "fact"

  # Description
  Valid content here.

2026-01-09T16:07 create lore "Invalid entry" #invalid
`,
        { filename: "test.thalo" },
      );

      const diagnostics = check(workspace);
      const syntaxErrors = diagnostics.filter((d) => d.code.startsWith("syntax-"));

      expect(syntaxErrors.length).toBeGreaterThanOrEqual(1);
      // Should report the syntax error
      expect(syntaxErrors[0].severity).toBe("error");
    });
  });

  describe("semantic errors", () => {
    it("should still report semantic errors alongside syntax errors", () => {
      // Add schema
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact"
`,
        { filename: "schema.thalo" },
      );

      // Inject syntax error
      const model = workspace.getModel("schema.thalo")!;
      const originalAst = model.ast;
      Object.assign(model, { ast: createAstWithSyntaxError() });

      // Add a document with a semantic error (unknown entity)
      workspace.addDocument(
        `2026-01-05T18:00Z create journal "Test" #test
  type: "fact"
`,
        { filename: "test.thalo" },
      );

      const diagnostics = check(workspace);

      const syntaxErrors = diagnostics.filter((d) => d.code.startsWith("syntax-"));
      const semanticErrors = diagnostics.filter((d) => d.code === "unknown-entity");

      expect(syntaxErrors.length).toBeGreaterThanOrEqual(1);
      expect(semanticErrors.length).toBeGreaterThanOrEqual(1);

      // Restore original AST
      Object.assign(model, { ast: originalAst });
    });
  });
});

describe("checkModel", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  it("should collect syntax errors from the model", () => {
    // Add a normal document
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
`,
      { filename: "test.thalo" },
    );

    const model = workspace.getModel("test.thalo")!;
    const originalAst = model.ast;

    // Replace AST with one containing a syntax error
    Object.assign(model, { ast: createAstWithSyntaxError() });

    const diagnostics = checkModel(model, workspace);
    const syntaxErrors = diagnostics.filter((d) => d.code.startsWith("syntax-"));

    expect(syntaxErrors).toHaveLength(1);
    expect(syntaxErrors[0].code).toBe("syntax-missing_timezone");
    expect(syntaxErrors[0].file).toBe("test.thalo");

    // Restore original AST
    Object.assign(model, { ast: originalAst });
  });

  it("should only return diagnostics for the model's file", () => {
    // Add schema
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact"
`,
      { filename: "schema.thalo" },
    );

    // Add document
    workspace.addDocument(
      `2026-01-05T18:00Z create journal "Test" #test
  type: "fact"
`,
      { filename: "test.thalo" },
    );

    const testModel = workspace.getModel("test.thalo")!;
    const diagnostics = checkModel(testModel, workspace);

    // All diagnostics should be for test.thalo
    for (const d of diagnostics) {
      expect(d.file).toBe("test.thalo");
    }
  });
});

describe("checkDocument", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  it("should return empty array for non-existent file", () => {
    const diagnostics = checkDocument("nonexistent.thalo", workspace);
    expect(diagnostics).toHaveLength(0);
  });

  it("should check a document by filename", () => {
    workspace.addDocument(
      `2026-01-05T18:00Z create journal "Test" #test
  type: "fact"
`,
      { filename: "test.thalo" },
    );

    const diagnostics = checkDocument("test.thalo", workspace);

    // Should report unknown-entity since journal isn't defined
    const unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
    expect(unknownEntity).toBeDefined();
  });
});

describe("checkIncremental", () => {
  let workspace: Workspace;

  // Helper to create InvalidationResult
  const createInvalidation = (
    overrides: Partial<{
      schemasChanged: boolean;
      linksChanged: boolean;
      affectedFiles: string[];
      changedEntityNames: string[];
      changedLinkIds: string[];
    }> = {},
  ) => ({
    affectedFiles: [],
    schemasChanged: false,
    linksChanged: false,
    changedEntityNames: [],
    changedLinkIds: [],
    ...overrides,
  });

  beforeEach(() => {
    workspace = createWorkspace();
  });

  it("should return empty array for non-existent file", () => {
    const diagnostics = checkIncremental(workspace, "nonexistent.thalo", [], createInvalidation());
    expect(diagnostics).toHaveLength(0);
  });

  it("should check changed entries when schemas unchanged", () => {
    // Add schema
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact"
`,
      { filename: "schema.thalo" },
    );

    // Add document with valid entry
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test entry"
  type: "fact"
`,
      { filename: "test.thalo" },
    );

    const model = workspace.getModel("test.thalo")!;
    const changedEntries = model.ast.entries;

    const diagnostics = checkIncremental(
      workspace,
      "test.thalo",
      changedEntries,
      createInvalidation(),
    );

    // Should not have unknown-entity error since lore is defined
    const unknownEntity = diagnostics.find((d) => d.code === "unknown-entity");
    expect(unknownEntity).toBeUndefined();
  });

  it("should only return diagnostics for the changed file", () => {
    // Add schema
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact"
`,
      { filename: "schema.thalo" },
    );

    // Add document with unknown entity
    workspace.addDocument(
      `2026-01-05T18:00Z create journal "Test" #test
  type: "fact"
`,
      { filename: "test.thalo" },
    );

    const model = workspace.getModel("test.thalo")!;
    const changedEntries = model.ast.entries;

    const diagnostics = checkIncremental(
      workspace,
      "test.thalo",
      changedEntries,
      createInvalidation(),
    );

    // All diagnostics should be for test.thalo only
    for (const d of diagnostics) {
      expect(d.file).toBe("test.thalo");
    }
  });

  it("should run workspace-scoped rules when schemas changed", () => {
    // Add two define-entity entries for the same entity (duplicate)
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entity"
  # Metadata
  type: "fact"

2026-01-01T00:01Z define-entity lore "Duplicate lore"
  # Metadata
  other: string
`,
      { filename: "schema.thalo" },
    );

    const model = workspace.getModel("schema.thalo")!;
    const changedEntries = model.ast.entries;

    const diagnostics = checkIncremental(
      workspace,
      "schema.thalo",
      changedEntries,
      createInvalidation({ schemasChanged: true }),
    );

    // Should detect duplicate entity definition
    const duplicateEntity = diagnostics.find((d) => d.code === "duplicate-entity-definition");
    expect(duplicateEntity).toBeDefined();
  });

  it("should run link-scoped rules when links changed", () => {
    // Add schema
    workspace.addDocument(
      `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact"
  related?: link
`,
      { filename: "schema.thalo" },
    );

    // Add entry with unresolved link
    workspace.addDocument(
      `2026-01-05T18:00Z create lore "Test entry"
  type: "fact"
  related: ^nonexistent
`,
      { filename: "test.thalo" },
    );

    const model = workspace.getModel("test.thalo")!;
    const changedEntries = model.ast.entries;

    const diagnostics = checkIncremental(
      workspace,
      "test.thalo",
      changedEntries,
      createInvalidation({ linksChanged: true }),
    );

    // Should detect unresolved link
    const unresolvedLink = diagnostics.find((d) => d.code === "unresolved-link");
    expect(unresolvedLink).toBeDefined();
  });
});
