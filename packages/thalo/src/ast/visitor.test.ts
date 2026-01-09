import { describe, it, expect } from "vitest";
import type { SyntaxNode } from "tree-sitter";
import {
  BaseVisitor,
  walkAst,
  forEachNode,
  collectNodes,
  collectSyntaxErrors,
  getChildren,
} from "./visitor.js";
import type {
  AstNode,
  Location,
  SourceFile,
  InstanceEntry,
  InstanceHeader,
  Timestamp,
  Title,
  Tag,
  Metadata,
  Key,
  Value,
  QuotedValue,
  SyntaxErrorNode,
  Link,
} from "./types.js";

// ===================
// Test Helpers
// ===================

const mockLocation = (start = 0, end = 10): Location => ({
  startIndex: start,
  endIndex: end,
  startPosition: { row: 0, column: start },
  endPosition: { row: 0, column: end },
});

const mockSyntaxNode = () =>
  ({
    type: "mock",
    text: "mock",
    startIndex: 0,
    endIndex: 10,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 10 },
  }) as unknown as SyntaxNode;

// Create a mock timestamp with all required fields
function createMockTimestamp(value: string, loc: Location): Timestamp {
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

// Create a minimal AST for testing
function createTestAst(): SourceFile {
  const timestamp = createMockTimestamp("2026-01-05T18:00Z", mockLocation(0, 17));

  const title: Title = {
    type: "title",
    value: "Test Entry",
    location: mockLocation(18, 28),
    syntaxNode: mockSyntaxNode(),
  };

  const tag1: Tag = {
    type: "tag",
    name: "test",
    location: mockLocation(29, 34),
    syntaxNode: mockSyntaxNode(),
  };

  const tag2: Tag = {
    type: "tag",
    name: "example",
    location: mockLocation(35, 43),
    syntaxNode: mockSyntaxNode(),
  };

  const key: Key = {
    type: "key",
    value: "subject",
    location: mockLocation(44, 51),
    syntaxNode: mockSyntaxNode(),
  };

  const quotedValue: QuotedValue = {
    type: "quoted_value",
    value: "test subject",
    location: mockLocation(53, 67),
    syntaxNode: mockSyntaxNode(),
  };

  const value: Value = {
    type: "value",
    raw: '"test subject"',
    content: quotedValue,
    location: mockLocation(52, 68),
    syntaxNode: mockSyntaxNode(),
  };

  const metadata: Metadata = {
    type: "metadata",
    key,
    value,
    location: mockLocation(44, 68),
    syntaxNode: mockSyntaxNode(),
  };

  const header: InstanceHeader = {
    type: "instance_header",
    timestamp,
    directive: "create",
    entity: "lore",
    title,
    link: null,
    tags: [tag1, tag2],
    location: mockLocation(0, 43),
    syntaxNode: mockSyntaxNode(),
  };

  const entry: InstanceEntry = {
    type: "instance_entry",
    header,
    metadata: [metadata],
    content: null,
    location: mockLocation(0, 68),
    syntaxNode: mockSyntaxNode(),
  };

  return {
    type: "source_file",
    entries: [entry],
    syntaxErrors: [],
    location: mockLocation(0, 68),
    syntaxNode: mockSyntaxNode(),
  };
}

// Create an AST with a syntax error
function createAstWithError(): SourceFile {
  const syntaxError: SyntaxErrorNode<"missing_timezone"> = {
    type: "syntax_error",
    code: "missing_timezone",
    message: "Timestamp requires timezone",
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
// Tests
// ===================

describe("getChildren", () => {
  it("should return entries for source_file", () => {
    const ast = createTestAst();
    const children = getChildren(ast);
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("instance_entry");
  });

  it("should return header, metadata, and content for instance_entry", () => {
    const ast = createTestAst();
    const entry = ast.entries[0] as InstanceEntry;
    const children = getChildren(entry);
    expect(children).toHaveLength(2); // header + 1 metadata
    expect(children[0].type).toBe("instance_header");
    expect(children[1].type).toBe("metadata");
  });

  it("should return timestamp, title, and tags for instance_header", () => {
    const ast = createTestAst();
    const entry = ast.entries[0] as InstanceEntry;
    const children = getChildren(entry.header);
    expect(children).toHaveLength(4); // timestamp + title + 2 tags
    expect(children[0].type).toBe("timestamp");
    expect(children[1].type).toBe("title");
    expect(children[2].type).toBe("tag");
    expect(children[3].type).toBe("tag");
  });

  it("should return key and value for metadata", () => {
    const ast = createTestAst();
    const entry = ast.entries[0] as InstanceEntry;
    const metadata = entry.metadata[0];
    const children = getChildren(metadata);
    expect(children).toHaveLength(2);
    expect(children[0].type).toBe("key");
    expect(children[1].type).toBe("value");
  });

  it("should return empty array for terminal nodes", () => {
    const ast = createTestAst();
    const entry = ast.entries[0] as InstanceEntry;
    // Tags are terminal nodes (no children)
    const tag = entry.header.tags[0];
    const children = getChildren(tag);
    expect(children).toHaveLength(0);
  });

  it("should return decomposed parts for timestamp with parts", () => {
    const astWithError = createAstWithError();
    const entry = astWithError.entries[0] as InstanceEntry;
    const timestamp = entry.header.timestamp;
    const children = getChildren(timestamp);
    expect(children).toHaveLength(3); // date, time, timezone (error)
    expect(children[0].type).toBe("date_part");
    expect(children[1].type).toBe("time_part");
    expect(children[2].type).toBe("syntax_error");
  });
});

describe("BaseVisitor", () => {
  it("should visit all nodes by default", () => {
    const ast = createTestAst();
    const visited: string[] = [];

    class RecordingVisitor extends BaseVisitor<void> {
      protected visitDefault(node: AstNode): void {
        visited.push(node.type);
        super.visitDefault(node);
      }
    }

    walkAst(ast, new RecordingVisitor());

    expect(visited).toContain("source_file");
    expect(visited).toContain("instance_entry");
    expect(visited).toContain("instance_header");
    expect(visited).toContain("timestamp");
    expect(visited).toContain("title");
    expect(visited).toContain("tag");
    expect(visited).toContain("metadata");
    expect(visited).toContain("key");
    expect(visited).toContain("value");
    expect(visited).toContain("quoted_value");
  });

  it("should call specific visit methods", () => {
    const ast = createTestAst();
    const timestamps: Timestamp[] = [];
    const tags: Tag[] = [];

    class SpecificVisitor extends BaseVisitor<void> {
      visitTimestamp(node: Timestamp): void {
        timestamps.push(node);
        // Don't call super - stop traversal here
      }

      visitTag(node: Tag): void {
        tags.push(node);
      }
    }

    walkAst(ast, new SpecificVisitor());

    expect(timestamps).toHaveLength(1);
    expect(timestamps[0].value).toBe("2026-01-05T18:00Z");
    expect(tags).toHaveLength(2);
    expect(tags[0].name).toBe("test");
    expect(tags[1].name).toBe("example");
  });

  it("should support returning values from visitors", () => {
    const ast = createTestAst();

    class CountVisitor extends BaseVisitor<number> {
      protected visitDefault(node: AstNode): number {
        const children = getChildren(node);
        let count = 1;
        for (const child of children) {
          count += this.visit(child);
        }
        return count;
      }
    }

    const count = walkAst(ast, new CountVisitor());
    expect(count).toBeGreaterThan(0);
  });

  it("should visit syntax error nodes", () => {
    const ast = createAstWithError();
    const errors: SyntaxErrorNode[] = [];

    class ErrorCollector extends BaseVisitor<void> {
      visitSyntaxError(node: SyntaxErrorNode): void {
        errors.push(node);
      }
    }

    walkAst(ast, new ErrorCollector());

    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("missing_timezone");
    expect(errors[0].message).toBe("Timestamp requires timezone");
  });
});

describe("forEachNode", () => {
  it("should call callback for each node", () => {
    const ast = createTestAst();
    const nodes: string[] = [];

    forEachNode(ast, (node) => {
      nodes.push(node.type);
    });

    expect(nodes).toContain("source_file");
    expect(nodes).toContain("instance_entry");
    expect(nodes).toContain("timestamp");
    expect(nodes.length).toBeGreaterThan(5);
  });

  it("should traverse in depth-first order", () => {
    const ast = createTestAst();
    const nodes: string[] = [];

    forEachNode(ast, (node) => {
      nodes.push(node.type);
    });

    // source_file should come first
    expect(nodes[0]).toBe("source_file");
    // instance_entry should come before its children
    const entryIndex = nodes.indexOf("instance_entry");
    const headerIndex = nodes.indexOf("instance_header");
    expect(entryIndex).toBeLessThan(headerIndex);
  });
});

describe("collectNodes", () => {
  it("should collect all nodes of a specific type", () => {
    const ast = createTestAst();
    const tags = collectNodes<Tag>(ast, "tag");

    expect(tags).toHaveLength(2);
    expect(tags[0].name).toBe("test");
    expect(tags[1].name).toBe("example");
  });

  it("should return empty array if no matches", () => {
    const ast = createTestAst();
    const links = collectNodes<Link>(ast, "link");

    expect(links).toHaveLength(0);
  });

  it("should collect syntax errors", () => {
    const ast = createAstWithError();
    const errors = collectNodes<SyntaxErrorNode>(ast, "syntax_error");

    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("missing_timezone");
  });
});

describe("collectSyntaxErrors", () => {
  it("should collect all syntax errors", () => {
    const ast = createAstWithError();
    const errors = collectSyntaxErrors(ast);

    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("missing_timezone");
    expect(errors[0].text).toBe("2026-01-05T18:00");
  });

  it("should return empty array for AST without errors", () => {
    const ast = createTestAst();
    const errors = collectSyntaxErrors(ast);

    expect(errors).toHaveLength(0);
  });
});
