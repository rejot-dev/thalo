import { describe, it, expect, beforeEach } from "vitest";
import { createWorkspace } from "./parser.native.js";
import type { ThaloInstanceEntry, ThaloWorkspaceInterface, EntryVisitor } from "./api.js";

// Import the internal class for testing
import { wrapWorkspace } from "./api.js";

/**
 * Create a test workspace from source strings.
 */
function createTestWorkspace(files: Record<string, string>): ThaloWorkspaceInterface {
  const internal = createWorkspace();

  for (const [filename, source] of Object.entries(files)) {
    internal.addDocument(source, { filename });
  }

  return wrapWorkspace(internal);
}

describe("Thalo Scripting API", () => {
  describe("entries()", () => {
    it("returns all entries across all files", () => {
      const workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Metadata
  confidence: "high" | "medium" | "low"
  # Sections
  Claim
`,
        "entries.thalo": `2026-01-05T10:00Z create opinion "Plain text wins" ^plain-text #pkm
  confidence: "high"

  # Claim
  Plain text is the best format for notes.

2026-01-05T11:00Z create opinion "Tabs are better" ^tabs #coding
  confidence: "medium"

  # Claim
  Tabs are superior to spaces.
`,
      });

      const entries = workspace.entries();

      expect(entries).toHaveLength(3);
    });

    it("wraps entries with correct types", () => {
      const workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity lore "Lore entries"
  # Sections
  Summary
`,
        "entries.thalo": `2026-01-05T10:00Z create lore "A fact" ^fact
  # Summary
  This is a fact.
`,
      });

      const entries = workspace.entries();

      expect(entries[0].type).toBe("schema");
      expect(entries[1].type).toBe("instance");
    });
  });

  describe("entriesInFile()", () => {
    it("returns entries for a specific file", () => {
      const workspace = createTestWorkspace({
        "file1.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion entries"
  # Sections
  Claim
`,
        "file2.thalo": `2026-01-05T10:00Z create opinion "Entry 1" ^e1
  # Claim
  First entry.

2026-01-05T11:00Z create opinion "Entry 2" ^e2
  # Claim
  Second entry.
`,
      });

      const entries = workspace.entriesInFile("file2.thalo");

      expect(entries).toHaveLength(2);
      expect(entries[0].title).toBe("Entry 1");
      expect(entries[1].title).toBe("Entry 2");
    });

    it("returns empty array for non-existent file", () => {
      const workspace = createTestWorkspace({});
      const entries = workspace.entriesInFile("nonexistent.thalo");

      expect(entries).toHaveLength(0);
    });
  });

  describe("instanceEntries()", () => {
    it("returns only instance entries", () => {
      const workspace = createTestWorkspace({
        "test.thalo": `2026-01-01T00:00Z define-entity lore "Lore"
  # Sections
  Summary

2026-01-05T10:00Z create lore "Entry 1" ^e1
  # Summary
  First.

2026-01-05T11:00Z update lore "Entry 1" ^e1
  # Summary
  Updated.
`,
      });

      const entries = workspace.instanceEntries();

      expect(entries).toHaveLength(2);
      expect(entries[0].directive).toBe("create");
      expect(entries[1].directive).toBe("update");
    });

    it("includes entity and directive fields", () => {
      const workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion"
  # Sections
  Claim
`,
        "entries.thalo": `2026-01-05T10:00Z create opinion "Test" ^test
  # Claim
  A claim.
`,
      });

      const entries = workspace.instanceEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].entity).toBe("opinion");
      expect(entries[0].directive).toBe("create");
      expect(entries[0].type).toBe("instance");
    });
  });

  describe("schemaEntries()", () => {
    it("returns only schema entries", () => {
      const workspace = createTestWorkspace({
        "test.thalo": `2026-01-01T00:00Z define-entity lore "Lore"
  # Sections
  Summary

2026-01-02T00:00Z alter-entity lore "Updated Lore"
  # Metadata
  topic: string

2026-01-05T10:00Z create lore "Entry" ^e
  # Summary
  Content.
`,
      });

      const entries = workspace.schemaEntries();

      expect(entries).toHaveLength(2);
      expect(entries[0].directive).toBe("define-entity");
      expect(entries[1].directive).toBe("alter-entity");
    });

    it("includes entityName field", () => {
      const workspace = createTestWorkspace({
        "test.thalo": `2026-01-01T00:00Z define-entity custom-type "Custom Type"
  # Sections
  Content
`,
      });

      const entries = workspace.schemaEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].entityName).toBe("custom-type");
    });
  });

  describe("synthesisEntries()", () => {
    it("returns only synthesis entries", () => {
      const workspace = createTestWorkspace({
        "test.thalo": `2026-01-01T00:00Z define-entity lore "Lore"
  # Sections
  Summary

2026-01-05T10:00Z define-synthesis "Weekly Summary" ^weekly-summary
  sources: lore
  prompt: "Summarize the week"
`,
      });

      const entries = workspace.synthesisEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe("synthesis");
      expect(entries[0].linkId).toBe("weekly-summary");
    });
  });

  describe("actualizeEntries()", () => {
    it("returns only actualize entries", () => {
      const workspace = createTestWorkspace({
        "test.thalo": `2026-01-01T00:00Z define-entity lore "Lore"
  # Sections
  Summary

2026-01-05T10:00Z define-synthesis "Summary" ^summary
  sources: lore
  prompt: "Summarize"

2026-01-06T10:00Z actualize-synthesis ^summary
  updated: [^entry1]
`,
      });

      const entries = workspace.actualizeEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe("actualize");
      expect(entries[0].target).toBe("summary");
    });
  });

  describe("files()", () => {
    it("returns all file paths", () => {
      const workspace = createTestWorkspace({
        "file1.thalo": `2026-01-01T00:00Z define-entity a "A"
  # Sections
  Content
`,
        "file2.thalo": `2026-01-01T00:00Z define-entity b "B"
  # Sections
  Content
`,
      });

      const files = workspace.files();

      expect(files).toHaveLength(2);
      expect(files).toContain("file1.thalo");
      expect(files).toContain("file2.thalo");
    });
  });

  describe("findDefinition()", () => {
    it("finds definition by link ID with ^ prefix", () => {
      const workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion"
  # Sections
  Claim
`,
        "entries.thalo": `2026-01-05T10:00Z create opinion "My Opinion" ^my-opinion
  # Claim
  This is my opinion.
`,
      });

      const def = workspace.findDefinition("^my-opinion");

      expect(def).toBeDefined();
      expect(def!.linkId).toBe("my-opinion");
      expect(def!.file).toBe("entries.thalo");
      expect(def!.entry.title).toBe("My Opinion");
    });

    it("returns undefined for non-existent link", () => {
      const workspace = createTestWorkspace({});
      const def = workspace.findDefinition("^nonexistent");

      expect(def).toBeUndefined();
    });

    it("throws error for tag identifier", () => {
      const workspace = createTestWorkspace({});
      expect(() => workspace.findDefinition("#coding")).toThrow(/Cannot find definition for tag/);
    });

    it("throws error for identifier without prefix", () => {
      const workspace = createTestWorkspace({});
      expect(() => workspace.findDefinition("my-opinion")).toThrow(
        /Must start with "\^" for links or "#" for tags/,
      );
    });
  });

  describe("findReferences()", () => {
    describe("link references (^)", () => {
      it("finds all references to a link", () => {
        const workspace = createTestWorkspace({
          "schema.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion"
  # Metadata
  related?: link
  # Sections
  Claim
`,
          "entries.thalo": `2026-01-05T10:00Z create opinion "First" ^first
  # Claim
  First opinion.

2026-01-05T11:00Z create opinion "Second" ^second
  related: ^first

  # Claim
  This references the first opinion.
`,
        });

        const refs = workspace.findReferences("^first");

        // Should include definition + reference
        expect(refs.length).toBeGreaterThanOrEqual(2);
        expect(refs.every((r) => r.kind === "link")).toBe(true);
        expect(refs.some((r) => r.kind === "link" && r.isDefinition)).toBe(true);
        expect(refs.some((r) => r.kind === "link" && !r.isDefinition)).toBe(true);
      });

      it("can exclude definition from results", () => {
        const workspace = createTestWorkspace({
          "schema.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion"
  # Metadata
  related?: link
  # Sections
  Claim
`,
          "entries.thalo": `2026-01-05T10:00Z create opinion "First" ^first
  # Claim
  First.

2026-01-05T11:00Z create opinion "Second" ^second
  related: ^first

  # Claim
  Second.
`,
        });

        const refs = workspace.findReferences("^first", false);

        // Should not include definition
        expect(refs.every((r) => r.kind === "link" && !r.isDefinition)).toBe(true);
      });
    });

    describe("tag references (#)", () => {
      it("finds all entries with a tag", () => {
        const workspace = createTestWorkspace({
          "schema.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion"
  # Sections
  Claim
`,
          "entries.thalo": `2026-01-05T10:00Z create opinion "First" ^first #coding #typescript
  # Claim
  First opinion about coding.

2026-01-05T11:00Z create opinion "Second" ^second #coding
  # Claim
  Second coding opinion.

2026-01-05T12:00Z create opinion "Third" ^third #life
  # Claim
  Not about coding.
`,
        });

        const refs = workspace.findReferences("#coding");

        expect(refs.length).toBe(2);
        expect(refs.every((r) => r.kind === "tag")).toBe(true);

        const titles = refs.map((r) => (r.kind === "tag" ? r.entry.title : ""));
        expect(titles).toContain("First");
        expect(titles).toContain("Second");
        expect(titles).not.toContain("Third");
      });

      it("returns empty array for non-existent tag", () => {
        const workspace = createTestWorkspace({
          "schema.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion"
  # Sections
  Claim
`,
          "entries.thalo": `2026-01-05T10:00Z create opinion "Test" ^test
  # Claim
  Test.
`,
        });

        const refs = workspace.findReferences("#nonexistent");
        expect(refs).toEqual([]);
      });

      it("includes location of the tag", () => {
        const workspace = createTestWorkspace({
          "schema.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion"
  # Sections
  Claim
`,
          "entries.thalo": `2026-01-05T10:00Z create opinion "Test" ^test #mytag
  # Claim
  Test.
`,
        });

        const refs = workspace.findReferences("#mytag");

        expect(refs.length).toBe(1);
        expect(refs[0].kind).toBe("tag");
        expect(refs[0].location).toBeDefined();
        expect(refs[0].location.startPosition.row).toBeGreaterThanOrEqual(0);
      });
    });

    it("throws error for identifier without prefix", () => {
      const workspace = createTestWorkspace({});
      expect(() => workspace.findReferences("my-thing")).toThrow(
        /Must start with "\^" for links or "#" for tags/,
      );
    });
  });

  describe("query()", () => {
    let workspace: ThaloWorkspaceInterface;

    beforeEach(() => {
      workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion"
  # Metadata
  confidence: "high" | "medium" | "low"
  # Sections
  Claim

2026-01-01T00:01Z define-entity lore "Lore"
  # Metadata
  topic: string
  # Sections
  Summary
`,
        "entries.thalo": `2026-01-05T10:00Z create opinion "Opinion 1" ^op1 #coding #hot-take
  confidence: "high"

  # Claim
  First opinion.

2026-01-05T11:00Z create opinion "Opinion 2" ^op2 #coding
  confidence: "low"

  # Claim
  Second opinion.

2026-01-05T12:00Z create lore "Lore 1" ^lore1 #coding
  topic: "programming"

  # Summary
  Some lore.
`,
      });
    });

    it("queries by entity type", () => {
      const results = workspace.query("opinion");

      expect(results).toHaveLength(2);
      expect(results.every((e) => (e as ThaloInstanceEntry).entity === "opinion")).toBe(true);
    });

    it("queries with tag condition", () => {
      const results = workspace.query("opinion where #hot-take");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Opinion 1");
    });

    it("queries with field condition", () => {
      const results = workspace.query('opinion where confidence = "low"');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Opinion 2");
    });

    it("queries with multiple conditions (AND)", () => {
      const results = workspace.query('opinion where #coding and confidence = "high"');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Opinion 1");
    });

    it("queries multiple entity types (OR)", () => {
      const results = workspace.query("opinion, lore");

      expect(results).toHaveLength(3);
    });

    it("throws on invalid query syntax", () => {
      expect(() => workspace.query("")).toThrow(/Invalid query syntax/);
    });

    it("throws on unknown entity type", () => {
      expect(() => workspace.query("nonexistent")).toThrow(/Unknown entity type/);
    });
  });

  describe("check()", () => {
    it("returns diagnostics for errors", () => {
      const workspace = createTestWorkspace({
        "test.thalo": `2026-01-05T10:00Z create undefined-entity "Test"
  # Content
  Some content.
`,
      });

      const diagnostics = workspace.check();

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some((d) => d.code === "unknown-entity")).toBe(true);
    });

    it("returns empty array for valid workspace", () => {
      const workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity note "Note"
  # Sections
  Content
`,
        "entries.thalo": `2026-01-05T10:00Z create note "Valid note" ^valid
  # Content
  This is valid.
`,
      });

      const diagnostics = workspace.check();

      // May have some warnings but no errors
      const errors = diagnostics.filter((d) => d.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("respects rule configuration", () => {
      const workspace = createTestWorkspace({
        "test.thalo": `2026-01-05T10:00Z create undefined-entity "Test"
  # Content
  Content.
`,
      });

      const diagnostics = workspace.check({
        rules: { "unknown-entity": "off" },
      });

      expect(diagnostics.filter((d) => d.code === "unknown-entity")).toHaveLength(0);
    });
  });

  describe("visit()", () => {
    it("calls visitor methods for each entry type", () => {
      const workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity lore "Lore"
  # Sections
  Summary

2026-01-02T00:00Z define-synthesis "Summary" ^summary
  sources: lore
  prompt: "Summarize"
`,
        "entries.thalo": `2026-01-05T10:00Z create lore "Entry" ^entry
  # Summary
  Content.

2026-01-06T00:00Z actualize-synthesis ^summary
  updated: [^entry]
`,
      });

      const visited = {
        instance: 0,
        schema: 0,
        synthesis: 0,
        actualize: 0,
      };

      const visitor: EntryVisitor = {
        visitInstanceEntry: () => {
          visited.instance++;
        },
        visitSchemaEntry: () => {
          visited.schema++;
        },
        visitSynthesisEntry: () => {
          visited.synthesis++;
        },
        visitActualizeEntry: () => {
          visited.actualize++;
        },
      };

      workspace.visit(visitor);

      expect(visited.instance).toBe(1);
      expect(visited.schema).toBe(1);
      expect(visited.synthesis).toBe(1);
      expect(visited.actualize).toBe(1);
    });

    it("provides context with file and workspace", () => {
      const workspace = createTestWorkspace({
        "test.thalo": `2026-01-01T00:00Z define-entity note "Note"
  # Sections
  Content
`,
      });

      let receivedFile: string | undefined;
      let receivedWorkspace: ThaloWorkspaceInterface | undefined;

      workspace.visit({
        visitSchemaEntry: (_entry, context) => {
          receivedFile = context.file;
          receivedWorkspace = context.workspace;
        },
      });

      expect(receivedFile).toBe("test.thalo");
      expect(receivedWorkspace).toBe(workspace);
    });

    it("can collect data across entries", () => {
      const workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity opinion "Opinion"
  # Sections
  Claim
`,
        "entries.thalo": `2026-01-05T10:00Z create opinion "Opinion A" ^a #coding
  # Claim
  A.

2026-01-05T11:00Z create opinion "Opinion B" ^b #coding #hot-take
  # Claim
  B.

2026-01-05T12:00Z create opinion "Opinion C" ^c #personal
  # Claim
  C.
`,
      });

      const tagCounts = new Map<string, number>();

      workspace.visit({
        visitInstanceEntry: (entry) => {
          for (const tag of entry.tags) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
          }
        },
      });

      expect(tagCounts.get("coding")).toBe(2);
      expect(tagCounts.get("hot-take")).toBe(1);
      expect(tagCounts.get("personal")).toBe(1);
    });
  });

  describe("ThaloEntry fields", () => {
    it("extracts timestamp correctly", () => {
      const workspace = createTestWorkspace({
        "test.thalo": `2026-01-05T14:30Z define-entity note "Note"
  # Sections
  Content
`,
      });

      const entries = workspace.entries();

      expect(entries[0].timestamp).toBe("2026-01-05T14:30Z");
    });

    it("extracts tags without # prefix", () => {
      const workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity note "Note"
  # Sections
  Content
`,
        "test.thalo": `2026-01-05T10:00Z create note "Test" ^test #tag1 #tag2 #tag3
  # Content
  Content.
`,
      });

      const entries = workspace.instanceEntries();

      expect(entries[0].tags).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("extracts linkId without ^ prefix", () => {
      const workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity note "Note"
  # Sections
  Content
`,
        "test.thalo": `2026-01-05T10:00Z create note "Test" ^my-link-id
  # Content
  Content.
`,
      });

      const entries = workspace.instanceEntries();

      expect(entries[0].linkId).toBe("my-link-id");
    });

    it("provides location information", () => {
      const workspace = createTestWorkspace({
        "test.thalo": `2026-01-01T00:00Z define-entity note "Note"
  # Sections
  Content
`,
      });

      const entries = workspace.entries();

      expect(entries[0].location).toBeDefined();
      expect(entries[0].location.startPosition.row).toBe(0);
    });

    it("provides access to raw AST entry", () => {
      const workspace = createTestWorkspace({
        "schema.thalo": `2026-01-01T00:00Z define-entity note "Note"
  # Sections
  Content
`,
        "test.thalo": `2026-01-05T10:00Z create note "Test" ^test
  # Content
  Some content here.
`,
      });

      const entries = workspace.instanceEntries();

      expect(entries[0].raw).toBeDefined();
      expect(entries[0].raw.type).toBe("instance_entry");
      expect(entries[0].raw.content).toBeDefined();
    });
  });

  describe("wrapWorkspace()", () => {
    it("creates an empty workspace", () => {
      const internal = createWorkspace();
      const workspace = wrapWorkspace(internal);

      expect(workspace.entries()).toHaveLength(0);
      expect(workspace.files()).toHaveLength(0);
    });

    it("can be populated via _internal", () => {
      const internal = createWorkspace();
      const workspace = wrapWorkspace(internal);

      workspace._internal.addDocument(
        `2026-01-01T00:00Z define-entity note "Note"
  # Sections
  Content
`,
        { filename: "test.thalo" },
      );

      expect(workspace.entries()).toHaveLength(1);
    });
  });
});
