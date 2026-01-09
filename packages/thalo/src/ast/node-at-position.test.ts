import { describe, it, expect } from "vitest";
import { parseDocument } from "../parser.js";
import { findNodeAtPosition } from "./node-at-position.js";

describe("findNodeAtPosition", () => {
  describe("title nodes", () => {
    it("should return title context for valid title in complete entry", () => {
      const source = `2026-01-05T18:00Z create lore "Test Entry" #test
  type: "fact"
`;
      const parsed = parseDocument(source, { fileType: "thalo" });

      // Position on the title "Test Entry" (character 30 is inside the title)
      const result = findNodeAtPosition(parsed, { line: 0, column: 30 });

      expect(result.kind).toBe("title");
      if (result.kind === "title") {
        expect(result.title).toBe("Test Entry");
      }
    });

    it("should return title context for unclosed title that recovers at newline", () => {
      // Grammar now accepts unclosed quotes, recovering at newline
      const source = `2026-01-05T18:00Z create lore "Test Entry
  type: "fact"
`;
      const parsed = parseDocument(source, { fileType: "thalo" });

      // Position on the title "Test Entry (character 30 is inside the title)
      const result = findNodeAtPosition(parsed, { line: 0, column: 30 });

      // Title should still be recognized (grammar accepts it, no ERROR node)
      expect(result.kind).toBe("title");
      if (result.kind === "title") {
        expect(result.title).toBe("Test Entry");
      }
    });
  });

  describe("error context handling", () => {
    it("should return unknown for title-like quoted value inside ERROR context", () => {
      // When there's no valid entry header, the parser enters error recovery
      // and may incorrectly identify quoted values as titles
      const source = `  type: "fact"`;
      const parsed = parseDocument(source, { fileType: "thalo" });

      // Position on "fact" (character 10 is inside the quoted value)
      const result = findNodeAtPosition(parsed, { line: 0, column: 10 });

      // Should return unknown because the "title" node is inside an ERROR context
      expect(result.kind).toBe("unknown");
    });

    it("should return unknown for title inside ERROR when entry header is invalid", () => {
      // Missing timestamp causes ERROR context
      const source = `create lore "Title"
  type: "fact"
`;
      const parsed = parseDocument(source, { fileType: "thalo" });

      // Position on "Title" (character 13 is inside the quoted value)
      const result = findNodeAtPosition(parsed, { line: 0, column: 13 });

      // Should return unknown because we're in an ERROR context
      expect(result.kind).toBe("unknown");
    });

    it("should still return link context for links inside ERROR context", () => {
      // Links are still valid to identify even in error contexts
      const source = `  related: ^ts-lore`;
      const parsed = parseDocument(source, { fileType: "thalo" });

      // Position on ^ts-lore (character 12 is inside the link)
      const result = findNodeAtPosition(parsed, { line: 0, column: 12 });

      // Links should still work even in error contexts
      expect(result.kind).toBe("link");
      if (result.kind === "link") {
        expect(result.linkId).toBe("ts-lore");
      }
    });

    it("should still return tag context for tags inside ERROR context", () => {
      // Tags are still valid to identify even in error contexts
      const source = `  tags: #programming #typescript`;
      const parsed = parseDocument(source, { fileType: "thalo" });

      // Position on #programming (character 10 is inside the tag)
      const result = findNodeAtPosition(parsed, { line: 0, column: 10 });

      // Tags should still work even in error contexts
      expect(result.kind).toBe("tag");
      if (result.kind === "tag") {
        expect(result.tagName).toBe("programming");
      }
    });
  });

  describe("basic node types", () => {
    it("should return link context for link", () => {
      const source = `2026-01-05T18:00Z create lore "Entry" ^my-link #test
  type: "fact"
`;
      const parsed = parseDocument(source, { fileType: "thalo" });

      // Position on ^my-link (character 38 is on the ^)
      const result = findNodeAtPosition(parsed, { line: 0, column: 39 });

      expect(result.kind).toBe("link");
      if (result.kind === "link") {
        expect(result.linkId).toBe("my-link");
      }
    });

    it("should return tag context for tag", () => {
      const source = `2026-01-05T18:00Z create lore "Entry" #test
  type: "fact"
`;
      const parsed = parseDocument(source, { fileType: "thalo" });

      // Position on #test (character 39 is inside the tag)
      const result = findNodeAtPosition(parsed, { line: 0, column: 39 });

      expect(result.kind).toBe("tag");
      if (result.kind === "tag") {
        expect(result.tagName).toBe("test");
      }
    });

    it("should return timestamp context for timestamp", () => {
      const source = `2026-01-05T18:00Z create lore "Entry" #test
  type: "fact"
`;
      const parsed = parseDocument(source, { fileType: "thalo" });

      // Position on timestamp (character 5 is inside the timestamp)
      const result = findNodeAtPosition(parsed, { line: 0, column: 5 });

      expect(result.kind).toBe("timestamp");
      if (result.kind === "timestamp") {
        expect(result.value).toBe("2026-01-05T18:00Z");
      }
    });

    it("should return metadata_key context for metadata key", () => {
      const source = `2026-01-05T18:00Z create lore "Entry" #test
  type: "fact"
`;
      const parsed = parseDocument(source, { fileType: "thalo" });

      // Position on "type" key (character 2 is on the 't' of type)
      const result = findNodeAtPosition(parsed, { line: 1, column: 3 });

      expect(result.kind).toBe("metadata_key");
      if (result.kind === "metadata_key") {
        expect(result.key).toBe("type");
      }
    });
  });
});
