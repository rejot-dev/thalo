import { describe, it, expect } from "vitest";
import { Workspace } from "./workspace.js";
import type { ModelInstanceEntry, ModelSynthesisEntry, Query } from "./types.js";

/**
 * Helper to find matching entries for a synthesis query
 */
function queryEntriesForSynthesis(
  workspace: Workspace,
  synthesis: ModelSynthesisEntry,
  afterTimestamp?: string,
): ModelInstanceEntry[] {
  const results: ModelInstanceEntry[] = [];
  const seen = new Set<string>();

  for (const doc of workspace.allDocuments()) {
    for (const entry of doc.instanceEntries) {
      const key = `${entry.file}:${entry.timestamp}`;
      if (seen.has(key)) {
        continue;
      }

      if (afterTimestamp && entry.timestamp <= afterTimestamp) {
        continue;
      }

      for (const query of synthesis.sources) {
        if (entryMatchesQuery(entry, query)) {
          results.push(entry);
          seen.add(key);
          break;
        }
      }
    }
  }

  return results.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function entryMatchesQuery(entry: ModelInstanceEntry, query: Query): boolean {
  if (entry.entity !== query.entity) {
    return false;
  }

  for (const condition of query.conditions) {
    if (condition.kind === "field") {
      const value = entry.metadata.get(condition.field)?.raw;
      if (value !== condition.value) {
        return false;
      }
    } else if (condition.kind === "tag") {
      if (!entry.tags.includes(condition.tag)) {
        return false;
      }
    } else if (condition.kind === "link") {
      if (entry.linkId !== condition.link) {
        let hasLink = false;
        for (const meta of entry.metadata.values()) {
          if (meta.linkId === condition.link) {
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

describe("Synthesis integration", () => {
  describe("query matching", () => {
    it("matches entries by entity type", () => {
      const workspace = new Workspace();
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
        { filename: "entries.ptall" },
      );

      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.
`,
        { filename: "profile.ptall" },
      );

      const profileDoc = workspace.getDocument("profile.ptall");
      const synthesis = profileDoc?.synthesisEntries[0];
      expect(synthesis).toBeDefined();

      const matches = queryEntriesForSynthesis(workspace, synthesis!);
      expect(matches).toHaveLength(1);
      expect(matches[0]?.entity).toBe("lore");
    });

    it("matches entries by tag", () => {
      const workspace = new Workspace();
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
        { filename: "entries.ptall" },
      );

      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Career Summary" ^career-summary
  sources: lore where #career

  # Prompt
  Summarize career.
`,
        { filename: "career.ptall" },
      );

      const careerDoc = workspace.getDocument("career.ptall");
      const synthesis = careerDoc?.synthesisEntries[0];
      expect(synthesis).toBeDefined();

      const matches = queryEntriesForSynthesis(workspace, synthesis!);
      expect(matches).toHaveLength(1);
      expect(matches[0]?.title).toBe("Career fact");
    });

    it("matches entries by multiple conditions (AND)", () => {
      const workspace = new Workspace();
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
        { filename: "entries.ptall" },
      );

      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "My Career" ^my-career
  sources: lore where subject = ^self and #career

  # Prompt
  My career only.
`,
        { filename: "my-career.ptall" },
      );

      const myCareerDoc = workspace.getDocument("my-career.ptall");
      const synthesis = myCareerDoc?.synthesisEntries[0];
      expect(synthesis).toBeDefined();

      const matches = queryEntriesForSynthesis(workspace, synthesis!);
      expect(matches).toHaveLength(1);
      expect(matches[0]?.title).toBe("Self career");
    });

    it("matches entries from multiple source queries (OR)", () => {
      const workspace = new Workspace();
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
        { filename: "entries.ptall" },
      );

      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "All Career" ^all-career
  sources: lore where #career, journal where #career

  # Prompt
  All career entries.
`,
        { filename: "all-career.ptall" },
      );

      const allCareerDoc = workspace.getDocument("all-career.ptall");
      const synthesis = allCareerDoc?.synthesisEntries[0];
      expect(synthesis).toBeDefined();

      const matches = queryEntriesForSynthesis(workspace, synthesis!);
      expect(matches).toHaveLength(2);
      expect(matches.map((m) => m.entity).sort()).toEqual(["journal", "lore"]);
    });
  });

  describe("timestamp filtering", () => {
    it("filters entries after a timestamp", () => {
      const workspace = new Workspace();
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
        { filename: "entries.ptall" },
      );

      workspace.addDocument(
        `2026-01-07T09:00Z define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.
`,
        { filename: "profile.ptall" },
      );

      const profileDoc = workspace.getDocument("profile.ptall");
      const synthesis = profileDoc?.synthesisEntries[0];
      expect(synthesis).toBeDefined();

      // No filter - get all
      let matches = queryEntriesForSynthesis(workspace, synthesis!);
      expect(matches).toHaveLength(3);

      // Filter after 10:00 - get 2
      matches = queryEntriesForSynthesis(workspace, synthesis!, "2026-01-07T10:00Z");
      expect(matches).toHaveLength(2);

      // Filter after 12:00 - get 1
      matches = queryEntriesForSynthesis(workspace, synthesis!, "2026-01-07T12:00Z");
      expect(matches).toHaveLength(1);
      expect(matches[0]?.title).toBe("Newest fact");

      // Filter after 14:00 - get 0
      matches = queryEntriesForSynthesis(workspace, synthesis!, "2026-01-07T14:00Z");
      expect(matches).toHaveLength(0);
    });
  });

  describe("actualize entries", () => {
    it("finds latest actualize for a synthesis", () => {
      const workspace = new Workspace();
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
        { filename: "profile.ptall" },
      );

      const profileDoc = workspace.getDocument("profile.ptall");
      expect(profileDoc).toBeDefined();

      const actualizes = profileDoc!.actualizeEntries;
      expect(actualizes).toHaveLength(3);

      // Find latest by timestamp
      const latest = actualizes.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
      expect(latest.timestamp).toBe("2026-01-07T12:00Z");
      expect(latest.metadata.get("updated")?.raw).toBe("2026-01-07T12:00Z");
    });

    it("uses actualize timestamp to filter new entries", () => {
      const workspace = new Workspace();
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
        { filename: "entries.ptall" },
      );

      workspace.addDocument(
        `2026-01-07T09:00Z define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T12:00Z actualize-synthesis ^profile
  updated: 2026-01-07T12:00Z
`,
        { filename: "profile.ptall" },
      );

      const profileDoc = workspace.getDocument("profile.ptall");
      expect(profileDoc).toBeDefined();

      const synthesis = profileDoc!.synthesisEntries[0];
      const actualize = profileDoc!.actualizeEntries[0];

      expect(synthesis).toBeDefined();
      expect(actualize).toBeDefined();

      const lastUpdated = actualize!.metadata.get("updated")?.raw;
      expect(lastUpdated).toBe("2026-01-07T12:00Z");

      const newEntries = queryEntriesForSynthesis(workspace, synthesis!, lastUpdated);
      expect(newEntries).toHaveLength(1);
      expect(newEntries[0]?.title).toBe("New fact");
    });
  });

  describe("cross-file synthesis", () => {
    it("finds entries across multiple files", () => {
      const workspace = new Workspace();

      workspace.addDocument(
        `2026-01-07T10:00Z create lore "Fact in file 1"
  type: "fact"
  subject: ^self

  # Content
  Content 1.
`,
        { filename: "lore1.ptall" },
      );

      workspace.addDocument(
        `2026-01-07T11:00Z create lore "Fact in file 2"
  type: "fact"
  subject: ^self

  # Content
  Content 2.
`,
        { filename: "lore2.ptall" },
      );

      workspace.addDocument(
        `2026-01-07T09:00Z define-synthesis "All Lore" ^all-lore
  sources: lore where subject = ^self

  # Prompt
  Combine all lore.
`,
        { filename: "profile.ptall" },
      );

      // Find synthesis entry from any document
      let synthesis: ModelSynthesisEntry | undefined;
      for (const doc of workspace.allDocuments()) {
        if (doc.synthesisEntries.length > 0) {
          synthesis = doc.synthesisEntries[0];
          break;
        }
      }
      expect(synthesis).toBeDefined();

      const matches = queryEntriesForSynthesis(workspace, synthesis!);

      expect(matches).toHaveLength(2);
      expect(matches.map((m) => m.file).sort()).toEqual(["lore1.ptall", "lore2.ptall"]);
    });
  });
});

describe("Synthesis link resolution", () => {
  it("synthesis linkId is resolvable in workspace", () => {
    const workspace = new Workspace();
    workspace.addDocument(
      `2026-01-07T10:00Z define-synthesis "Profile" ^my-profile
  sources: lore where subject = ^self

  # Prompt
  Generate.
`,
      { filename: "profile.ptall" },
    );

    const def = workspace.getLinkDefinition("my-profile");
    expect(def).toBeDefined();
    expect(def?.entry.kind).toBe("synthesis");
  });

  it("actualize target is tracked as reference", () => {
    const workspace = new Workspace();
    workspace.addDocument(
      `2026-01-07T10:00Z define-synthesis "Profile" ^my-profile
  sources: lore where subject = ^self

  # Prompt
  Generate.

2026-01-07T12:00Z actualize-synthesis ^my-profile
  updated: 2026-01-07T12:00Z
`,
      { filename: "profile.ptall" },
    );

    const refs = workspace.getLinkReferences("my-profile");
    expect(refs).toHaveLength(1);
    expect(refs[0]?.entry.kind).toBe("actualize");
  });
});
