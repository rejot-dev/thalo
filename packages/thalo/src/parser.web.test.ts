import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createParser, type ThaloParser } from "./parser.web.js";
import type { Tree } from "web-tree-sitter";
import { isIdentityMap } from "./source-map.js";

const require = createRequire(import.meta.url);

// Resolve WASM file paths
// web-tree-sitter doesn't export the WASM file, so we resolve the package and append the filename
const treeSitterWasmPath = join(
  dirname(require.resolve("web-tree-sitter")),
  "web-tree-sitter.wasm",
);
const languageWasmPath = require.resolve("@rejot-dev/tree-sitter-thalo/tree-sitter-thalo.wasm");

// Load WASM files once for all tests
let treeSitterWasm: Uint8Array;
let languageWasm: Uint8Array;

describe("Web Parser", () => {
  let parser: ThaloParser<Tree>;

  beforeAll(async () => {
    // Load both WASM files
    [treeSitterWasm, languageWasm] = await Promise.all([
      readFile(treeSitterWasmPath).then((b) => new Uint8Array(b)),
      readFile(languageWasmPath).then((b) => new Uint8Array(b)),
    ]);

    parser = await createParser({ treeSitterWasm, languageWasm });
  });

  it("creates a parser instance", () => {
    expect(parser).toBeDefined();
    expect(parser.parse).toBeInstanceOf(Function);
    expect(parser.parseIncremental).toBeInstanceOf(Function);
    expect(parser.parseDocument).toBeInstanceOf(Function);
  });

  it("parses a simple thalo entry", () => {
    const source = `2026-01-05T18:00Z create lore "Test entry" #test
  type: "fact"
  subject: ^self
`;
    const tree = parser.parse(source);

    expect(tree.rootNode.type).toBe("source_file");
    expect(tree.rootNode.hasError).toBe(false);
  });

  it("parses a schema definition", () => {
    const source = `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Metadata
  type: "fact" | "insight"
  subject: string
  date?: date-range
  # Sections
  Summary?
`;
    const tree = parser.parse(source);

    expect(tree.rootNode.type).toBe("source_file");
    expect(tree.rootNode.hasError).toBe(false);

    // Find the entry
    const entry = tree.rootNode.namedChildren.find((c) => c.type === "entry");
    expect(entry).toBeDefined();

    const schemaEntry = entry?.namedChildren.find((c) => c.type === "schema_entry");
    expect(schemaEntry).toBeDefined();
  });

  it("parses using parseDocument", () => {
    const source = `2026-01-05T18:00Z create lore "Test entry" #test
  type: "fact"
  subject: ^self
`;
    const result = parser.parseDocument(source, { fileType: "thalo" });

    expect(result.blocks).toHaveLength(1);
    expect(isIdentityMap(result.blocks[0].sourceMap)).toBe(true);
    expect(result.blocks[0].tree.rootNode.type).toBe("source_file");
  });

  it("extracts thalo blocks from markdown", () => {
    const source = `# My Document

Some text.

\`\`\`thalo
2026-01-05T18:00Z create lore "Test entry" #test
  type: "fact"
\`\`\`

More text.

\`\`\`thalo
2026-01-05T19:00Z create lore "Another entry" #test
  type: "insight"
\`\`\`
`;
    const result = parser.parseDocument(source, { fileType: "markdown" });

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].source).toContain("Test entry");
    expect(result.blocks[1].source).toContain("Another entry");
  });

  it("uses filename heuristic for .thalo files", () => {
    const source = `2026-01-05T18:00Z create lore "Test entry" #test
  type: "fact"
`;
    const result = parser.parseDocument(source, { filename: "test.thalo" });

    expect(result.blocks).toHaveLength(1);
  });

  it("uses filename heuristic for .md files", () => {
    const source = `# My Document

\`\`\`thalo
2026-01-05T18:00Z create lore "Test entry" #test
  type: "fact"
\`\`\`
`;
    const result = parser.parseDocument(source, { filename: "test.md" });

    expect(result.blocks).toHaveLength(1);
  });

  it("detects parse errors", () => {
    // Use clearly malformed input that can't be parsed
    const source = `this is not valid thalo syntax at all {{{{`;
    const tree = parser.parse(source);

    expect(tree.rootNode.hasError).toBe(true);
  });

  it("handles incremental parsing", () => {
    const source1 = `2026-01-05T18:00Z create lore "Test" #test
  type: "fact"
`;
    const tree1 = parser.parse(source1);
    expect(tree1.rootNode.hasError).toBe(false);

    // Simulate an edit (in real usage, you'd call tree1.edit() first)
    const source2 = `2026-01-05T18:00Z create lore "Test Updated" #test
  type: "fact"
`;
    const tree2 = parser.parseIncremental(source2);
    expect(tree2.rootNode.hasError).toBe(false);
  });

  it("can create multiple independent parser instances", async () => {
    const parser2 = await createParser({ treeSitterWasm, languageWasm });

    // Both parsers work independently
    const tree1 = parser.parse(`2026-01-05T18:00Z create lore "Parser 1" #test`);
    const tree2 = parser2.parse(`2026-01-05T18:00Z create lore "Parser 2" #test`);

    expect(tree1.rootNode.hasError).toBe(false);
    expect(tree2.rootNode.hasError).toBe(false);
  });
});
