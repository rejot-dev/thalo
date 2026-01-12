import { describe, it, expect } from "vitest";
import { createWorkspace } from "../parser.native.js";
import { Workspace } from "./workspace.js";
import type { Query, QueryCondition } from "./types.js";
import type { InstanceEntry, SynthesisEntry, ActualizeEntry } from "../ast/types.js";
import { formatTimestamp } from "../formatters.js";

/**
 * Get synthesis sources from a synthesis entry (extracts queries from sources metadata)
 */
function getSynthesisSources(synthesis: SynthesisEntry): Query[] {
  const sourcesMeta = synthesis.metadata.find((m) => m.key.value === "sources");
  if (!sourcesMeta) {
    return [];
  }

  // Sources can be a query_value or value_array
  const content = sourcesMeta.value.content;
  if (content.type === "query_value") {
    return [astQueryToModelQuery(content.query)];
  }
  if (content.type === "value_array") {
    return content.elements
      .filter((e): e is import("../ast/types.js").Query => e.type === "query")
      .map(astQueryToModelQuery);
  }
  return [];
}

/**
 * Convert AST Query to Model Query
 */
function astQueryToModelQuery(astQuery: import("../ast/types.js").Query): Query {
  return {
    entity: astQuery.entity,
    conditions: astQuery.conditions.map((c): QueryCondition => {
      switch (c.type) {
        case "field_condition":
          return { kind: "field", field: c.field, value: c.value };
        case "tag_condition":
          return { kind: "tag", tag: c.tag };
        case "link_condition":
          return { kind: "link", link: c.linkId };
      }
    }),
  };
}

/**
 * Helper to find matching entries for a synthesis query
 */
function queryEntriesForSynthesis(
  workspace: Workspace,
  synthesis: SynthesisEntry,
  afterTimestamp?: string,
): InstanceEntry[] {
  const results: InstanceEntry[] = [];
  const seen = new Set<string>();

  const sources = getSynthesisSources(synthesis);

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (entry.type !== "instance_entry") {
        continue;
      }

      const ts = formatTimestamp(entry.header.timestamp);
      const key = `${model.file}:${ts}`;
      if (seen.has(key)) {
        continue;
      }

      if (afterTimestamp && ts <= afterTimestamp) {
        continue;
      }

      for (const query of sources) {
        if (entryMatchesQuery(entry, query)) {
          results.push(entry);
          seen.add(key);
          break;
        }
      }
    }
  }

  return results.sort((a, b) =>
    formatTimestamp(a.header.timestamp).localeCompare(formatTimestamp(b.header.timestamp)),
  );
}

function entryMatchesQuery(entry: InstanceEntry, query: Query): boolean {
  if (entry.header.entity !== query.entity) {
    return false;
  }

  for (const condition of query.conditions) {
    if (condition.kind === "field") {
      const meta = entry.metadata.find((m) => m.key.value === condition.field);
      if (meta?.value.raw !== condition.value) {
        return false;
      }
    } else if (condition.kind === "tag") {
      const tags = entry.header.tags.map((t) => t.name);
      if (!tags.includes(condition.tag)) {
        return false;
      }
    } else if (condition.kind === "link") {
      const linkId = entry.header.link?.id;
      if (linkId !== condition.link) {
        let hasLink = false;
        for (const meta of entry.metadata) {
          if (
            meta.value.content.type === "link_value" &&
            meta.value.content.link.id === condition.link
          ) {
            hasLink = true;
            break;
          }
        }
        if (!hasLink) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Helper to get synthesis entries from a specific file
 */
function getSynthesisEntries(workspace: Workspace, filename: string): SynthesisEntry[] {
  const model = workspace.getModel(filename);
  if (!model) {
    return [];
  }
  return model.ast.entries.filter((e): e is SynthesisEntry => e.type === "synthesis_entry");
}

/**
 * Helper to get actualize entries from a specific file
 */
function getActualizeEntries(workspace: Workspace, filename: string): ActualizeEntry[] {
  const model = workspace.getModel(filename);
  if (!model) {
    return [];
  }
  return model.ast.entries.filter((e): e is ActualizeEntry => e.type === "actualize_entry");
}

describe("Synthesis integration", () => {
  describe("query matching", () => {
    it("matches entries by entity type", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T12:00Z create lore "Fact 1" #career
  type: "fact"
  subject: ^self

  # Content
  Content 1.

2026-01-07T12:01Z create journal "Journal 1"
  type: "reflection"
  subject: ^self

  # Entry
  Entry 1.
`,
        { filename: "entries.thalo" },
      );

      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.
`,
        { filename: "profile.thalo" },
      );

      const syntheses = getSynthesisEntries(workspace, "profile.thalo");
      expect(syntheses).toHaveLength(1);

      const matches = queryEntriesForSynthesis(workspace, syntheses[0]);
      expect(matches).toHaveLength(1);
      expect(matches[0]?.header.entity).toBe("lore");
    });

    it("matches entries by tag", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T12:00Z create lore "Career fact" #career
  type: "fact"
  subject: ^self

  # Content
  Career content.

2026-01-07T12:01Z create lore "Education fact" #education
  type: "fact"
  subject: ^self

  # Content
  Education content.
`,
        { filename: "entries.thalo" },
      );

      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Career Summary" ^career-summary
  sources: lore where #career

  # Prompt
  Summarize career.
`,
        { filename: "career.thalo" },
      );

      const syntheses = getSynthesisEntries(workspace, "career.thalo");
      expect(syntheses).toHaveLength(1);

      const matches = queryEntriesForSynthesis(workspace, syntheses[0]);
      expect(matches).toHaveLength(1);
      expect(matches[0]?.header.title?.value).toBe("Career fact");
    });

    it("matches entries by multiple conditions (AND)", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T12:00Z create lore "Self career" #career
  type: "fact"
  subject: ^self

  # Content
  Self career content.

2026-01-07T12:01Z create lore "Other career" #career
  type: "fact"
  subject: ^other-subject

  # Content
  Other career content.

2026-01-07T12:02Z create lore "Self education" #education
  type: "fact"
  subject: ^self

  # Content
  Self education content.
`,
        { filename: "entries.thalo" },
      );

      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "My Career" ^my-career
  sources: lore where subject = ^self and #career

  # Prompt
  My career only.
`,
        { filename: "my-career.thalo" },
      );

      const syntheses = getSynthesisEntries(workspace, "my-career.thalo");
      expect(syntheses).toHaveLength(1);

      const matches = queryEntriesForSynthesis(workspace, syntheses[0]);
      expect(matches).toHaveLength(1);
      expect(matches[0]?.header.title?.value).toBe("Self career");
    });

    it("matches entries from multiple source queries (OR)", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T12:00Z create lore "Career lore" #career
  type: "fact"
  subject: ^self

  # Content
  Career.

2026-01-07T12:01Z create journal "Career journal" #career
  type: "reflection"
  subject: ^self

  # Entry
  Reflection.
`,
        { filename: "entries.thalo" },
      );

      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "All Career" ^all-career
  sources: lore where #career, journal where #career

  # Prompt
  All career entries.
`,
        { filename: "all-career.thalo" },
      );

      const syntheses = getSynthesisEntries(workspace, "all-career.thalo");
      expect(syntheses).toHaveLength(1);

      const matches = queryEntriesForSynthesis(workspace, syntheses[0]);

      expect(matches).toHaveLength(2);
      expect(matches.map((m) => m.header.entity).sort()).toEqual(["journal", "lore"]);
    });
  });

  describe("timestamp filtering", () => {
    it("filters entries after a timestamp", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z create lore "Old fact"
  type: "fact"
  subject: ^self

  # Content
  Old.

2026-01-07T12:00Z create lore "New fact"
  type: "fact"
  subject: ^self

  # Content
  New.

2026-01-07T14:00Z create lore "Newest fact"
  type: "fact"
  subject: ^self

  # Content
  Newest.
`,
        { filename: "entries.thalo" },
      );

      workspace.addDocument(
        `2026-01-07T09:00Z define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.
`,
        { filename: "profile.thalo" },
      );

      const syntheses = getSynthesisEntries(workspace, "profile.thalo");
      expect(syntheses).toHaveLength(1);

      // No filter - get all
      let matches = queryEntriesForSynthesis(workspace, syntheses[0]);
      expect(matches).toHaveLength(3);

      // Filter after 10:00 - get 2
      matches = queryEntriesForSynthesis(workspace, syntheses[0], "2026-01-07T10:00Z");
      expect(matches).toHaveLength(2);

      // Filter after 12:00 - get 1
      matches = queryEntriesForSynthesis(workspace, syntheses[0], "2026-01-07T12:00Z");
      expect(matches).toHaveLength(1);
      expect(matches[0]?.header.title?.value).toBe("Newest fact");

      // Filter after 14:00 - get 0
      matches = queryEntriesForSynthesis(workspace, syntheses[0], "2026-01-07T14:00Z");
      expect(matches).toHaveLength(0);
    });
  });

  describe("actualize entries", () => {
    it("finds latest actualize for a synthesis", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T10:01Z actualize-synthesis ^profile
  updated: 2026-01-07T10:01Z

2026-01-07T12:00Z actualize-synthesis ^profile
  updated: 2026-01-07T12:00Z

2026-01-07T11:00Z actualize-synthesis ^profile
  updated: 2026-01-07T11:00Z
`,
        { filename: "profile.thalo" },
      );

      const actualizes = getActualizeEntries(workspace, "profile.thalo");
      expect(actualizes).toHaveLength(3);

      // Find latest by timestamp
      const latest = actualizes.reduce((a, b) =>
        formatTimestamp(a.header.timestamp) > formatTimestamp(b.header.timestamp) ? a : b,
      );
      expect(formatTimestamp(latest.header.timestamp)).toBe("2026-01-07T12:00Z");

      const updatedMeta = latest.metadata.find((m) => m.key.value === "updated");
      expect(updatedMeta?.value.raw).toBe("2026-01-07T12:00Z");
    });

    it("uses actualize timestamp to filter new entries", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z create lore "Old fact"
  type: "fact"
  subject: ^self

  # Content
  Old.

2026-01-07T14:00Z create lore "New fact"
  type: "fact"
  subject: ^self

  # Content
  New.
`,
        { filename: "entries.thalo" },
      );

      workspace.addDocument(
        `2026-01-07T09:00Z define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T12:00Z actualize-synthesis ^profile
  updated: 2026-01-07T12:00Z
`,
        { filename: "profile.thalo" },
      );

      const syntheses = getSynthesisEntries(workspace, "profile.thalo");
      const actualizes = getActualizeEntries(workspace, "profile.thalo");

      expect(syntheses).toHaveLength(1);
      expect(actualizes).toHaveLength(1);

      const updatedMeta = actualizes[0].metadata.find((m) => m.key.value === "updated");
      const lastUpdated = updatedMeta?.value.raw;
      expect(lastUpdated).toBe("2026-01-07T12:00Z");

      const newEntries = queryEntriesForSynthesis(workspace, syntheses[0], lastUpdated);
      expect(newEntries).toHaveLength(1);
      expect(newEntries[0]?.header.title?.value).toBe("New fact");
    });
  });

  describe("cross-file synthesis", () => {
    it("finds entries across multiple files", () => {
      const workspace = createWorkspace();

      workspace.addDocument(
        `2026-01-07T10:00Z create lore "Fact in file 1"
  type: "fact"
  subject: ^self

  # Content
  Content 1.
`,
        { filename: "lore1.thalo" },
      );

      workspace.addDocument(
        `2026-01-07T11:00Z create lore "Fact in file 2"
  type: "fact"
  subject: ^self

  # Content
  Content 2.
`,
        { filename: "lore2.thalo" },
      );

      workspace.addDocument(
        `2026-01-07T09:00Z define-synthesis "All Lore" ^all-lore
  sources: lore where subject = ^self

  # Prompt
  Combine all lore.
`,
        { filename: "profile.thalo" },
      );

      // Find synthesis entry
      let synthesis: SynthesisEntry | undefined;
      for (const model of workspace.allModels()) {
        for (const entry of model.ast.entries) {
          if (entry.type === "synthesis_entry") {
            synthesis = entry;
            break;
          }
        }
        if (synthesis) {
          break;
        }
      }
      expect(synthesis).toBeDefined();

      const matches = queryEntriesForSynthesis(workspace, synthesis!);

      expect(matches).toHaveLength(2);
    });
  });
});

describe("Synthesis link resolution", () => {
  it("synthesis linkId is resolvable in workspace", () => {
    const workspace = createWorkspace();
    workspace.addDocument(
      `2026-01-07T10:00Z define-synthesis "Profile" ^my-profile
  sources: lore where subject = ^self

  # Prompt
  Generate.
`,
      { filename: "profile.thalo" },
    );

    const def = workspace.getLinkDefinition("my-profile");
    expect(def).toBeDefined();
    expect(def?.entry.type).toBe("synthesis_entry");
  });

  it("actualize target is tracked as reference", () => {
    const workspace = createWorkspace();
    workspace.addDocument(
      `2026-01-07T10:00Z define-synthesis "Profile" ^my-profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T12:00Z actualize-synthesis ^my-profile
  updated: 2026-01-07T12:00Z
`,
      { filename: "profile.thalo" },
    );

    const refs = workspace.getLinkReferences("my-profile");
    expect(refs).toHaveLength(1);
    expect(refs[0]?.entry.type).toBe("actualize_entry");
  });
});
