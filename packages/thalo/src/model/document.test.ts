import { describe, it, expect } from "vitest";
import { Document } from "./document.js";

describe("Document", () => {
  describe("constructor", () => {
    it("should detect thalo file type from extension", () => {
      const doc = new Document("test.thalo", "2024-01-01T12:00 create fact ^id");
      expect(doc.fileType).toBe("thalo");
      expect(doc.blocks.length).toBe(1);
    });

    it("should detect markdown file type from extension", () => {
      const source = "# Title\n\n```thalo\n2024-01-01T12:00 create fact ^id\n```\n";
      const doc = new Document("test.md", source);
      expect(doc.fileType).toBe("markdown");
      expect(doc.blocks.length).toBe(1);
    });

    it("should detect markdown from content when no extension", () => {
      const source = "# Title\n\n```thalo\n2024-01-01T12:00 create fact ^id\n```\n";
      const doc = new Document("test", source);
      expect(doc.fileType).toBe("markdown");
    });

    it("should default to thalo when no markers present", () => {
      const doc = new Document("test", "2024-01-01T12:00 create fact ^id");
      expect(doc.fileType).toBe("thalo");
    });

    it("should allow explicit file type override", () => {
      const doc = new Document("test.md", "2024-01-01T12:00 create fact ^id", "thalo");
      expect(doc.fileType).toBe("thalo");
    });
  });

  describe("thalo file parsing", () => {
    it("should create single block for thalo files", () => {
      const source = `2024-01-01T12:00 create fact "Test" ^test-id
  key: "value"`;
      const doc = new Document("test.thalo", source);

      expect(doc.blocks.length).toBe(1);
      expect(doc.blocks[0].source).toBe(source);
      expect(doc.blocks[0].startOffset).toBe(0);
      expect(doc.blocks[0].endOffset).toBe(source.length);
    });

    it("should parse tree correctly", () => {
      const source = '2024-01-01T12:00 create fact "Test" ^test-id';
      const doc = new Document("test.thalo", source);

      expect(doc.blocks[0].tree.rootNode.type).toBe("source_file");
    });
  });

  describe("markdown file parsing", () => {
    it("should extract single thalo block", () => {
      const source = `# Title

\`\`\`thalo
2024-01-01T12:00 create fact ^id
\`\`\`

Some text`;
      const doc = new Document("test.md", source);

      expect(doc.blocks.length).toBe(1);
      expect(doc.blocks[0].source).toBe("2024-01-01T12:00 create fact ^id\n");
    });

    it("should extract multiple thalo blocks", () => {
      const source = `# Title

\`\`\`thalo
2024-01-01T12:00 create fact ^id1
\`\`\`

Middle text

\`\`\`thalo
2024-01-02T12:00 create fact ^id2
\`\`\``;
      const doc = new Document("test.md", source);

      expect(doc.blocks.length).toBe(2);
      expect(doc.blocks[0].source).toBe("2024-01-01T12:00 create fact ^id1\n");
      expect(doc.blocks[1].source).toBe("2024-01-02T12:00 create fact ^id2\n");
    });

    it("should return empty blocks array for markdown without thalo blocks", () => {
      const source = `# Title

Just regular markdown

\`\`\`javascript
console.log("not thalo");
\`\`\``;
      const doc = new Document("test.md", source);
      expect(doc.blocks.length).toBe(0);
    });

    it("should set correct source map offsets", () => {
      const source = `# Title

\`\`\`thalo
2024-01-01T12:00 create fact ^id
\`\`\``;
      const doc = new Document("test.md", source);

      expect(doc.blocks.length).toBe(1);
      const block = doc.blocks[0];

      // The block should have the correct line offset (line 3, 0-indexed = 2)
      expect(block.sourceMap.lineOffset).toBe(3);
    });
  });

  describe("applyEdit - thalo files", () => {
    it("should apply single character insertion", () => {
      const doc = new Document("test.thalo", "hello world");
      // Insert " there" after "hello" (at position 5)
      const result = doc.applyEdit(0, 5, 0, 5, " there");

      expect(result.fullReparse).toBe(false);
      expect(result.modifiedBlockIndices).toEqual([0]);
      expect(doc.source).toBe("hello there world");
    });

    it("should apply text replacement", () => {
      const doc = new Document("test.thalo", "hello world");
      // Replace "world" (chars 6-11) with "universe"
      const result = doc.applyEdit(0, 6, 0, 11, "universe");

      expect(result.fullReparse).toBe(false);
      expect(doc.source).toBe("hello universe");
    });

    it("should apply multiline insertion", () => {
      const doc = new Document("test.thalo", '2024-01-01T12:00 create fact "Test" ^id');
      const result = doc.applyEdit(0, 39, 0, 39, '\n  key: "value"');

      expect(result.fullReparse).toBe(false);
      expect(doc.source).toBe('2024-01-01T12:00 create fact "Test" ^id\n  key: "value"');
      expect(doc.lineIndex.lineCount).toBe(2);
    });

    it("should apply deletion", () => {
      const source = `2024-01-01T12:00 create fact "Test" ^id
  key: "value"`;
      const doc = new Document("test.thalo", source);

      // Delete the second line
      const result = doc.applyEdit(0, 39, 1, 14, "");

      expect(result.fullReparse).toBe(false);
      expect(doc.source).toBe('2024-01-01T12:00 create fact "Test" ^id');
    });

    it("should update line index after edit", () => {
      const doc = new Document("test.thalo", "line1\nline2");

      expect(doc.lineIndex.lineCount).toBe(2);

      doc.applyEdit(1, 0, 1, 5, "newline2\nline3");

      expect(doc.lineIndex.lineCount).toBe(3);
      expect(doc.source).toBe("line1\nnewline2\nline3");
    });
  });

  describe("applyEdit - markdown files", () => {
    it("should apply edit within a thalo block incrementally", () => {
      const source = `# Title

\`\`\`thalo
2024-01-01T12:00 create fact ^id
\`\`\``;
      const doc = new Document("test.md", source);

      // Edit within the thalo block (add metadata)
      const result = doc.applyEdit(3, 32, 3, 32, '\n  key: "value"');

      expect(result.blockBoundariesChanged).toBe(false);
      expect(result.modifiedBlockIndices).toEqual([0]);
      expect(doc.blocks[0].source).toContain('key: "value"');
    });

    it("should do full reparse when adding fence marker", () => {
      const source = `# Title

Some text`;
      const doc = new Document("test.md", source);

      expect(doc.blocks.length).toBe(0);

      // Add a thalo fence
      const result = doc.applyEdit(
        2,
        9,
        2,
        9,
        "\n\n```thalo\n2024-01-01T12:00 create fact ^id\n```",
      );

      expect(result.blockBoundariesChanged).toBe(true);
      expect(result.fullReparse).toBe(true);
      expect(doc.blocks.length).toBe(1);
    });

    it("should do full reparse when removing fence marker", () => {
      const source = `# Title

\`\`\`thalo
2024-01-01T12:00 create fact ^id
\`\`\``;
      const doc = new Document("test.md", source);

      expect(doc.blocks.length).toBe(1);

      // Remove the opening fence
      const result = doc.applyEdit(2, 0, 2, 8, "");

      expect(result.blockBoundariesChanged).toBe(true);
      expect(result.fullReparse).toBe(true);
    });

    it("should update block offsets when editing before block", () => {
      const source = `# Title

\`\`\`thalo
2024-01-01T12:00 create fact ^id
\`\`\``;
      const doc = new Document("test.md", source);

      const originalStartOffset = doc.blocks[0].startOffset;

      // Edit the title (before the block)
      doc.applyEdit(0, 2, 0, 7, "New Title");

      // Block offset should have increased
      expect(doc.blocks[0].startOffset).toBe(originalStartOffset + 4); // "New Title" - "Title" = +4
    });
  });

  describe("replaceContent", () => {
    it("should replace entire document content", () => {
      const doc = new Document("test.thalo", "original content");

      doc.replaceContent('2024-01-01T12:00 create fact "New" ^id');

      expect(doc.source).toBe('2024-01-01T12:00 create fact "New" ^id');
      expect(doc.blocks.length).toBe(1);
    });

    it("should re-parse blocks after replacement", () => {
      const source1 = `\`\`\`thalo
2024-01-01T12:00 create fact ^id1
\`\`\``;
      const source2 = `\`\`\`thalo
2024-01-01T12:00 create fact ^id1
\`\`\`

\`\`\`thalo
2024-01-02T12:00 create fact ^id2
\`\`\``;

      const doc = new Document("test.md", source1);
      expect(doc.blocks.length).toBe(1);

      doc.replaceContent(source2);
      expect(doc.blocks.length).toBe(2);
    });
  });

  describe("applyEditRange", () => {
    it("should accept tree-sitter format edit", () => {
      const doc = new Document("test.thalo", "hello world");

      doc.applyEditRange(
        {
          startIndex: 0,
          startPosition: { row: 0, column: 0 },
          oldEndIndex: 5,
          oldEndPosition: { row: 0, column: 5 },
          newEndIndex: 2,
          newEndPosition: { row: 0, column: 2 },
        },
        "hi",
      );

      expect(doc.source).toBe("hi world");
    });
  });
});
