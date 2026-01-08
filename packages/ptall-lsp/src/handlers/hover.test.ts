import { describe, it, expect, beforeEach } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Workspace } from "@rejot-dev/ptall";
import type { Position } from "vscode-languageserver";
import { handleHover } from "./hover.js";

/**
 * Create a TextDocument for testing
 */
function createDocument(content: string, uri = "file:///test.ptall"): TextDocument {
  return TextDocument.create(uri, "ptall", 1, content);
}

describe("handleHover", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace();

    // Add documents with various entry types
    const source = `2026-01-05T18:00 create lore "Test entry about TypeScript" ^ts-lore #typescript #testing
  type: "fact"
  subject: ^self
  confidence: "high"

  Some content here.

2026-01-05T19:00 create opinion "TypeScript enums are bad" ^enum-opinion #typescript #best-practices
  confidence: "high"
  related: ^ts-lore

  # Claim
  Enums should be avoided.

2026-01-06T10:00 create journal "Working on tests" #testing #development
  type: "reflection"
  subject: ^self

  Reflecting on test coverage.
`;
    workspace.addDocument(source, { filename: "/test.ptall" });

    // Add a schema definition
    const schemaSource = `2026-01-01T00:00 define-entity lore "Lore entries" ^entity-lore #schema
  # Metadata
  type: "fact" | "insight"
  subject: string
`;
    workspace.addDocument(schemaSource, { filename: "/schema.ptall" });
  });

  describe("link hover", () => {
    it("should show hover info for explicit link ID", () => {
      const doc = createDocument(`  related: ^ts-lore`);

      // Position cursor on ^ts-lore
      const position: Position = { line: 0, character: 15 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      expect(result!.contents).toHaveProperty("kind", "markdown");

      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Test entry about TypeScript");
      expect(content).toContain("create");
      expect(content).toContain("lore");
      expect(content).toContain("2026-01-05T18:00");
    });

    it("should show unresolved link warning for timestamp link (timestamps are not link IDs)", () => {
      // Timestamps are not link IDs - only explicit ^link-id creates links
      const doc = createDocument(`  related: ^2026-01-05T18:00`);

      const position: Position = { line: 0, character: 20 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      // Should show unresolved link warning
      expect(content).toContain("Unknown link");
    });

    it("should show warning for unresolved link", () => {
      const doc = createDocument(`  related: ^nonexistent-link`);

      const position: Position = { line: 0, character: 18 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Unknown link");
      expect(content).toContain("nonexistent-link");
    });

    it("should include tags in hover info", () => {
      const doc = createDocument(`  related: ^ts-lore`);

      const position: Position = { line: 0, character: 15 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("#typescript");
      expect(content).toContain("#testing");
    });

    it("should include explicit link ID in hover info", () => {
      const doc = createDocument(`  related: ^ts-lore`);

      const position: Position = { line: 0, character: 15 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      // Should show explicit link ID only (timestamps are not link IDs)
      expect(content).toContain("^ts-lore");
    });

    it("should include relevant metadata in hover info", () => {
      const doc = createDocument(`  related: ^ts-lore`);

      const position: Position = { line: 0, character: 15 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      // Should show key metadata like type, subject, confidence
      expect(content).toContain("type");
      expect(content).toContain("fact");
    });

    it("should include file location in hover info", () => {
      const doc = createDocument(`  related: ^ts-lore`);

      const position: Position = { line: 0, character: 15 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("/test.ptall");
    });
  });

  describe("tag hover", () => {
    it("should show hover info for tag", () => {
      const doc = createDocument(`2026-01-07T10:00 create lore "New" #typescript`);

      // Position cursor on #typescript
      const position: Position = { line: 0, character: 40 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Tag:");
      expect(content).toContain("#typescript");
    });

    it("should show entry count for tag", () => {
      const doc = createDocument(`2026-01-07T10:00 create lore "New" #typescript`);

      const position: Position = { line: 0, character: 40 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("2"); // Used in 2 entries
      expect(content).toContain("entries");
    });

    it("should list entries using the tag", () => {
      const doc = createDocument(`2026-01-07T10:00 create lore "New" #typescript`);

      const position: Position = { line: 0, character: 40 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Test entry about TypeScript");
      expect(content).toContain("TypeScript enums are bad");
    });

    it("should return null for unused tag", () => {
      const doc = createDocument(`2026-01-07T10:00 create lore "New" #never-used-tag`);

      // Position cursor on the unused tag
      const position: Position = { line: 0, character: 42 };

      const result = handleHover(workspace, doc, position);

      // No entries have this tag, so nothing to show
      expect(result).toBeNull();
    });
  });

  describe("schema entry hover", () => {
    it("should show hover info for schema definition link", () => {
      const doc = createDocument(`  entity: ^entity-lore`);

      const position: Position = { line: 0, character: 15 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Lore entries");
      expect(content).toContain("define-entity");
      expect(content).toContain("lore");
    });
  });

  describe("directive hover", () => {
    it("should show documentation for create directive", () => {
      const doc = createDocument(`2026-01-07T10:00 create lore "New entry"`);

      // Position cursor on "create"
      const position: Position = { line: 0, character: 20 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("`create` directive");
      expect(content).toContain("Creates a new instance entry");
    });

    it("should show documentation for define-entity directive", () => {
      const doc = createDocument(`2026-01-07T10:00 define-entity custom "Custom entity"`);

      // Position cursor on "define-entity"
      const position: Position = { line: 0, character: 22 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("`define-entity` directive");
      expect(content).toContain("Defines a new entity schema");
    });

    it("should show documentation for define-synthesis directive", () => {
      const doc = createDocument(
        `2026-01-07T10:00 define-synthesis "Career Summary" ^career-summary`,
      );

      // Position cursor on "define-synthesis"
      const position: Position = { line: 0, character: 22 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("`define-synthesis` directive");
      expect(content).toContain("queries entries and generates content via LLM");
    });

    it("should show documentation for actualize-synthesis directive", () => {
      const doc = createDocument(`2026-01-07T10:00 actualize-synthesis ^career-summary`);

      // Position cursor on "actualize-synthesis"
      const position: Position = { line: 0, character: 22 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("`actualize-synthesis` directive");
      expect(content).toContain("Triggers a synthesis to regenerate");
    });
  });

  describe("entity hover", () => {
    it("should show entity schema for known entity", () => {
      const doc = createDocument(`2026-01-07T10:00 create lore "New entry"`);

      // Position cursor on "lore"
      const position: Position = { line: 0, character: 28 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Entity: `lore`");
      expect(content).toContain("Lore entries");
      expect(content).toContain("Metadata Fields");
    });

    it("should show warning for unknown entity", () => {
      const doc = createDocument(`2026-01-07T10:00 create unknown-entity "New entry"`);

      // Position cursor on "unknown-entity"
      const position: Position = { line: 0, character: 30 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Unknown entity");
      expect(content).toContain("define-entity");
    });
  });

  describe("metadata key hover", () => {
    it("should show field info for known field", () => {
      const doc = createDocument(`2026-01-07T10:00 create lore "New entry"\n  type: "fact"`);

      // Position cursor on "type" key
      const position: Position = { line: 1, character: 4 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Field: `type`");
      expect(content).toContain("From entity `lore`");
    });

    it("should show message for unknown field", () => {
      const doc = createDocument(
        `2026-01-07T10:00 create lore "New entry"\n  unknown-field: value`,
      );

      // Position cursor on "unknown-field"
      const position: Position = { line: 1, character: 8 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Field:");
      expect(content).toContain("unknown-field");
      expect(content).toContain("Not defined in entity schema");
    });
  });

  describe("timestamp hover", () => {
    it("should show entry info for timestamp in header", () => {
      const doc = createDocument(`2026-01-05T18:00 create lore "Test"`);

      // Position cursor on timestamp
      const position: Position = { line: 0, character: 8 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Timestamp:");
      expect(content).toContain("2026-01-05T18:00");
      // This timestamp exists in workspace, so should show entry
      expect(content).toContain("Test entry about TypeScript");
    });

    it("should show hint to add explicit link-id for new timestamp", () => {
      const doc = createDocument(`2026-01-07T12:00 create lore "New"`);

      // Position cursor on timestamp
      const position: Position = { line: 0, character: 8 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Timestamp:");
      // Timestamps are not link IDs - should show hint to add explicit link-id
      expect(content).toContain("explicit");
      expect(content).toContain("link-id");
    });
  });

  describe("synthesis entry hover", () => {
    let synthesisWorkspace: Workspace;

    beforeEach(() => {
      synthesisWorkspace = new Workspace();

      // Add a synthesis definition
      const synthesisSource = `2026-01-05T10:00 define-synthesis "Career Summary" ^career-summary #career #summary
  sources: lore where subject = ^self and #career

  # Prompt
  Write a professional career summary.
`;
      synthesisWorkspace.addDocument(synthesisSource, { filename: "/synthesis.ptall" });

      // Add an actualize entry
      const actualizeSource = `2026-01-06T15:00 actualize-synthesis ^career-summary
  updated: 2026-01-06T15:00
`;
      synthesisWorkspace.addDocument(actualizeSource, { filename: "/actualize.ptall" });
    });

    it("should show hover info for synthesis link reference", () => {
      const doc = createDocument(`  related: ^career-summary`);

      const position: Position = { line: 0, character: 15 };

      const result = handleHover(synthesisWorkspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Career Summary");
      expect(content).toContain("define-synthesis");
    });

    it("should show hover info for actualize-synthesis target link", () => {
      const doc = createDocument(`2026-01-06T15:00 actualize-synthesis ^career-summary`);

      // Position cursor on ^career-summary
      const position: Position = { line: 0, character: 45 };

      const result = handleHover(synthesisWorkspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("Career Summary");
    });

    it("should show tags for synthesis entry hover", () => {
      const doc = createDocument(`  related: ^career-summary`);

      const position: Position = { line: 0, character: 15 };

      const result = handleHover(synthesisWorkspace, doc, position);

      expect(result).not.toBeNull();
      const content = (result!.contents as { value: string }).value;
      expect(content).toContain("#career");
      expect(content).toContain("#summary");
    });
  });

  describe("edge cases", () => {
    it("should return null when cursor is not on a link or tag", () => {
      const doc = createDocument(`  type: "fact"`);

      const position: Position = { line: 0, character: 8 };

      const result = handleHover(workspace, doc, position);

      expect(result).toBeNull();
    });

    it("should return null for empty document", () => {
      const doc = createDocument(``);

      const position: Position = { line: 0, character: 0 };

      const result = handleHover(workspace, doc, position);

      expect(result).toBeNull();
    });

    it("should return null for cursor at line start", () => {
      const doc = createDocument(`  related: ^ts-lore`);

      const position: Position = { line: 0, character: 0 };

      const result = handleHover(workspace, doc, position);

      expect(result).toBeNull();
    });

    it("should handle hover at start of link", () => {
      const doc = createDocument(`  related: ^ts-lore`);

      // Position inside the link text (^ts-lore starts at 11)
      // The hover handler uses getWordAtPosition which expands from cursor
      const position: Position = { line: 0, character: 14 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
    });

    it("should handle hover at end of link", () => {
      const doc = createDocument(`  related: ^ts-lore`);

      // Position at end of "ts-lore"
      const position: Position = { line: 0, character: 19 };

      const result = handleHover(workspace, doc, position);

      expect(result).not.toBeNull();
    });
  });
});
