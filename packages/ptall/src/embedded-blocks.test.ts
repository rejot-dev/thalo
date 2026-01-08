import { describe, it, expect, beforeEach } from "vitest";
import { parseDocument } from "./parser.js";
import { Workspace } from "./model/workspace.js";
import { check } from "./checker/check.js";
import { extractSemanticTokens } from "./services/semantic-tokens.js";
import { findDefinition } from "./services/definition.js";
import { findReferences } from "./services/references.js";
import { isIdentityMap } from "./source-map.js";

describe("Embedded blocks in markdown", () => {
  describe("Parser", () => {
    it("standalone ptall file has identity sourceMap", () => {
      const source = `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
`;
      const result = parseDocument(source, { fileType: "ptall" });

      expect(result.blocks).toHaveLength(1);
      expect(isIdentityMap(result.blocks[0].sourceMap)).toBe(true);
    });

    it("markdown with one block has correct sourceMap", () => {
      const source = `# Header

Some intro text.

\`\`\`ptall
2026-01-05T18:00 create lore "Test" #test
  type: "fact"
\`\`\`
`;
      // Lines: 0=Header, 1=empty, 2=text, 3=empty, 4=```ptall, 5=content start
      const result = parseDocument(source, { fileType: "markdown" });

      expect(result.blocks).toHaveLength(1);
      const sourceMap = result.blocks[0].sourceMap;
      expect(isIdentityMap(sourceMap)).toBe(false);
      // The block content starts after ```ptall\n at line 5 (0-indexed: 5)
      expect(sourceMap.lineOffset).toBe(5);
      expect(sourceMap.columnOffset).toBe(0);
    });

    it("markdown with multiple blocks has correct sourceMaps for each", () => {
      const source = `# Header

\`\`\`ptall
2026-01-05T18:00 create lore "First" #test
  type: "fact"
\`\`\`

More text.

\`\`\`ptall
2026-01-05T19:00 create lore "Second" #test
  type: "insight"
\`\`\`
`;
      // Lines: 0=Header, 1=empty, 2=```ptall, 3=first content, 4=type, 5=```,
      // 6=empty, 7=More text, 8=empty, 9=```ptall, 10=second content
      const result = parseDocument(source, { fileType: "markdown" });

      expect(result.blocks).toHaveLength(2);

      // First block content starts at line 3 (after ```ptall\n)
      const firstMap = result.blocks[0].sourceMap;
      expect(firstMap.lineOffset).toBe(3);

      // Second block content starts at line 10
      const secondMap = result.blocks[1].sourceMap;
      expect(secondMap.lineOffset).toBe(10);

      // Second block has higher line offset
      expect(secondMap.lineOffset).toBeGreaterThan(firstMap.lineOffset);
    });

    it("first line of first block maps to correct file line", () => {
      const source = `# Title

\`\`\`ptall
2026-01-05T18:00 create lore "Test" #test
\`\`\`
`;
      // Lines: 0=Title, 1=empty, 2=```ptall, 3=content
      const result = parseDocument(source, { fileType: "markdown" });
      const sourceMap = result.blocks[0].sourceMap;

      // Block content starts at line 3
      expect(sourceMap.lineOffset).toBe(3);
    });
  });

  describe("Semantic Tokens", () => {
    // Token type index for "number" (used for timestamps and datetime values)
    const TIMESTAMP_TOKEN_TYPE = 9; // "number" in tokenTypes array

    it("tokens in standalone file have correct positions", () => {
      const source = `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
`;
      const parsed = parseDocument(source, { fileType: "ptall" });
      const tokens = extractSemanticTokens(parsed);

      // Timestamp is at line 0
      const timestampToken = tokens.find((t) => t.tokenType === TIMESTAMP_TOKEN_TYPE);
      expect(timestampToken).toBeDefined();
      expect(timestampToken!.line).toBe(0);
    });

    it("tokens in markdown block have file-absolute positions", () => {
      const source = `# Header

\`\`\`ptall
2026-01-05T18:00 create lore "Test" #test
  type: "fact"
\`\`\`
`;
      // Lines: 0=Header, 1=empty, 2=```ptall, 3=content
      const parsed = parseDocument(source, { fileType: "markdown" });
      const tokens = extractSemanticTokens(parsed);

      // Timestamp should be at line 3 (content starts at line 3)
      const timestampToken = tokens.find((t) => t.tokenType === TIMESTAMP_TOKEN_TYPE);
      expect(timestampToken).toBeDefined();
      expect(timestampToken!.line).toBe(3);
    });

    it("tokens in second markdown block have correct line numbers", () => {
      const source = `# Header

\`\`\`ptall
2026-01-05T18:00 create lore "First" #test
  type: "fact"
\`\`\`

\`\`\`ptall
2026-01-05T19:00 create lore "Second" #test
  type: "insight"
\`\`\`
`;
      // Lines: 0=Header, 1=empty, 2=```ptall, 3=first content, 4=type, 5=```, 6=empty, 7=```ptall, 8=second content
      const parsed = parseDocument(source, { fileType: "markdown" });
      const tokens = extractSemanticTokens(parsed);

      // Find timestamps (there should be two)
      const timestampTokens = tokens.filter((t) => t.tokenType === TIMESTAMP_TOKEN_TYPE);
      expect(timestampTokens).toHaveLength(2);

      // First timestamp at line 3
      expect(timestampTokens[0].line).toBe(3);

      // Second timestamp at line 8
      expect(timestampTokens[1].line).toBe(8);
    });
  });

  describe("Diagnostics", () => {
    let workspace: Workspace;

    beforeEach(() => {
      workspace = new Workspace();
      workspace.addDocument(
        `2026-01-01T00:00 define-entity lore "Lore"
  # Metadata
  type: "fact" | "insight"
  subject: string
  # Sections
  Summary
`,
        { filename: "schema.ptall" },
      );
    });

    it("diagnostic in standalone file has correct location", () => {
      const source = `2026-01-05T18:00 create lore "Test" #test
  type: "fact"
`;
      workspace.addDocument(source, { filename: "test.ptall" });
      const diagnostics = check(workspace);

      // Should have "missing required field: subject" at line 0
      const missingField = diagnostics.find((d) => d.code === "missing-required-field");
      expect(missingField).toBeDefined();
      expect(missingField!.location.startPosition.row).toBe(0);
    });

    it("diagnostic in markdown block has file-absolute location", () => {
      const source = `# My Document

Some introduction.

\`\`\`ptall
2026-01-05T18:00 create lore "Test" #test
  type: "fact"
\`\`\`
`;
      // Lines: 0=My Document, 1=empty, 2=intro, 3=empty, 4=```ptall, 5=content
      workspace.addDocument(source, { filename: "test.md" });
      const diagnostics = check(workspace);

      // Should have "missing required field: subject" at line 5 (the entry header)
      const missingField = diagnostics.find((d) => d.code === "missing-required-field");
      expect(missingField).toBeDefined();
      expect(missingField!.location.startPosition.row).toBe(5);
    });

    it("diagnostic line numbers match actual file lines", () => {
      const source = `Line 0
Line 1
\`\`\`ptall
2026-01-05T18:00 create lore "Test" #test
  type: "fact"
  unknown-field: "value"
\`\`\`
`;
      // Lines: 0=Line 0, 1=Line 1, 2=```ptall, 3=entry header, 4=type, 5=unknown-field
      workspace.addDocument(source, { filename: "test.md" });
      const diagnostics = check(workspace);

      // Should have "unknown-field" diagnostic (unknown field for lore entity)
      const unknownField = diagnostics.find((d) => d.code === "unknown-field");
      expect(unknownField).toBeDefined();
      // The unknown field is at line 5 (0-indexed)
      expect(unknownField!.location.startPosition.row).toBe(5);
    });
  });

  describe("Definition", () => {
    it("definition location is file-absolute for markdown", () => {
      const workspace = new Workspace();

      // Define entry in markdown
      const source = `# References

\`\`\`ptall
2026-01-05T18:00 create lore "My Entry" ^my-entry #test
  type: "fact"
  subject: ^self
\`\`\`
`;
      workspace.addDocument(source, { filename: "entries.md" });

      // Find definition
      const result = findDefinition(workspace, "my-entry");
      expect(result).toBeDefined();

      // Location should be file-absolute (line 4, 0-indexed: 3)
      expect(result!.location.startPosition.row).toBe(3);
    });
  });

  describe("References", () => {
    it("reference locations are file-absolute for markdown", () => {
      const workspace = new Workspace();

      // Define and reference in markdown
      const source = `# Notes

\`\`\`ptall
2026-01-05T18:00 create lore "Original" ^original #test
  type: "fact"
  subject: ^self
\`\`\`

\`\`\`ptall
2026-01-05T19:00 update lore "Updated" #test
  type: "fact"
  subject: ^self
  supersedes: ^original
\`\`\`
`;
      workspace.addDocument(source, { filename: "entries.md" });

      // Find references to "original"
      const result = findReferences(workspace, "original", true);
      expect(result).toBeDefined();

      // Should have 1 definition and 1 reference
      expect(result.locations).toHaveLength(2);

      // Definition at line 4 (0-indexed: 3)
      const defLocation = result.locations.find((l) => l.isDefinition);
      expect(defLocation).toBeDefined();
      expect(defLocation!.location.startPosition.row).toBe(3);

      // Reference at later line in second block
      const refLocation = result.locations.find((l) => !l.isDefinition);
      expect(refLocation).toBeDefined();
      expect(refLocation!.location.startPosition.row).toBeGreaterThan(
        defLocation!.location.startPosition.row,
      );
    });

    it("cross-file references work between .ptall and .md files", () => {
      const workspace = new Workspace();

      // Define in .ptall file
      workspace.addDocument(
        `2026-01-05T18:00 create lore "Defined" ^defined-in-ptall #test
  type: "fact"
  subject: ^self
`,
        { filename: "definitions.ptall" },
      );

      // Reference in .md file
      workspace.addDocument(
        `# Refs

\`\`\`ptall
2026-01-05T19:00 create lore "Referencing" #test
  type: "fact"
  subject: ^self
  related: ^defined-in-ptall
\`\`\`
`,
        { filename: "references.md" },
      );

      // Find references
      const result = findReferences(workspace, "defined-in-ptall", true);
      expect(result).toBeDefined();
      expect(result.locations).toHaveLength(2);

      // Definition in .ptall at line 0
      const defLocation = result.locations.find((l) => l.isDefinition);
      expect(defLocation).toBeDefined();
      expect(defLocation!.file).toContain("definitions.ptall");
      expect(defLocation!.location.startPosition.row).toBe(0);

      // Reference in .md at file-absolute position
      const refLocation = result.locations.find((l) => !l.isDefinition);
      expect(refLocation).toBeDefined();
      expect(refLocation!.file).toContain("references.md");
      // Reference should be at line 4 or later (inside the markdown block)
      expect(refLocation!.location.startPosition.row).toBeGreaterThanOrEqual(3);
    });
  });
});
