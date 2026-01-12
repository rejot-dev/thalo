import { describe, it, expect } from "vitest";
import { createWorkspace } from "../parser.native.js";
import {
  formatTimestamp,
  getSynthesisSources,
  getSynthesisPrompt,
  findAllSyntheses,
  findLatestActualize,
  getActualizeUpdatedTimestamp,
  findEntryFile,
  getEntrySourceText,
} from "./synthesis.js";
import { executeQueries } from "./query.js";

describe("synthesis service", () => {
  describe("formatTimestamp", () => {
    it("formats a UTC timestamp", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T12:30Z create lore "Test"
  type: "fact"
`,
        { filename: "test.thalo" },
      );

      const entries = workspace.allInstanceEntries();
      expect(entries).toHaveLength(1);
      expect(formatTimestamp(entries[0].header.timestamp)).toBe("2026-01-07T12:30Z");
    });

    it("formats a timestamp with positive offset", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T12:30+05:30 create lore "Test"
  type: "fact"
`,
        { filename: "test.thalo" },
      );

      const entries = workspace.allInstanceEntries();
      expect(formatTimestamp(entries[0].header.timestamp)).toBe("2026-01-07T12:30+05:30");
    });

    it("formats a timestamp with negative offset", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T12:30-08:00 create lore "Test"
  type: "fact"
`,
        { filename: "test.thalo" },
      );

      const entries = workspace.allInstanceEntries();
      expect(formatTimestamp(entries[0].header.timestamp)).toBe("2026-01-07T12:30-08:00");
    });
  });

  describe("getSynthesisSources", () => {
    it("extracts single source query", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore where subject = ^self

  # Prompt
  Generate.
`,
        { filename: "profile.thalo" },
      );

      const syntheses = workspace.allSynthesisEntries();
      expect(syntheses).toHaveLength(1);

      const sources = getSynthesisSources(syntheses[0]);
      expect(sources).toHaveLength(1);
      expect(sources[0].entity).toBe("lore");
      expect(sources[0].conditions).toHaveLength(1);
      // subject = ^self is a field condition, not a link condition
      expect(sources[0].conditions[0]).toEqual({ kind: "field", field: "subject", value: "^self" });
    });

    it("extracts multiple source queries from array", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "All Career" ^all-career
  sources: lore where #career, journal where #career

  # Prompt
  All career entries.
`,
        { filename: "all-career.thalo" },
      );

      const syntheses = workspace.allSynthesisEntries();
      expect(syntheses).toHaveLength(1);

      const sources = getSynthesisSources(syntheses[0]);
      expect(sources).toHaveLength(2);
      expect(sources[0].entity).toBe("lore");
      expect(sources[1].entity).toBe("journal");
    });

    it("returns empty array when no sources metadata", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "No Sources" ^no-sources

  # Prompt
  Generate.
`,
        { filename: "no-sources.thalo" },
      );

      const syntheses = workspace.allSynthesisEntries();
      expect(syntheses).toHaveLength(1);

      const sources = getSynthesisSources(syntheses[0]);
      expect(sources).toHaveLength(0);
    });
  });

  describe("getSynthesisPrompt", () => {
    it("extracts prompt text from content", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore

  # Prompt
  Generate a profile from lore entries.
  Include relevant facts.
`,
        { filename: "profile.thalo" },
      );

      const syntheses = workspace.allSynthesisEntries();
      const prompt = getSynthesisPrompt(syntheses[0]);
      expect(prompt).toBe("Generate a profile from lore entries.\nInclude relevant facts.");
    });

    it("returns null when no content", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore
`,
        { filename: "profile.thalo" },
      );

      const syntheses = workspace.allSynthesisEntries();
      const prompt = getSynthesisPrompt(syntheses[0]);
      expect(prompt).toBeNull();
    });

    it("returns null when no prompt header", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore

  # Notes
  Some notes here.
`,
        { filename: "profile.thalo" },
      );

      const syntheses = workspace.allSynthesisEntries();
      const prompt = getSynthesisPrompt(syntheses[0]);
      expect(prompt).toBeNull();
    });
  });

  describe("findAllSyntheses", () => {
    it("finds syntheses across multiple files", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore

  # Prompt
  Generate profile.
`,
        { filename: "profile.thalo" },
      );
      workspace.addDocument(
        `2026-01-07T11:00Z define-synthesis "Career Summary" ^career
  sources: lore where #career

  # Prompt
  Summarize career.
`,
        { filename: "career.thalo" },
      );

      const syntheses = findAllSyntheses(workspace);
      expect(syntheses).toHaveLength(2);
      expect(syntheses.map((s) => s.linkId).sort()).toEqual(["career", "profile"]);
      expect(syntheses.map((s) => s.file).sort()).toEqual(["career.thalo", "profile.thalo"]);
    });

    it("includes all synthesis info fields", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "My Profile" ^my-profile
  sources: lore where subject = ^self

  # Prompt
  Generate a profile.
`,
        { filename: "profile.thalo" },
      );

      const syntheses = findAllSyntheses(workspace);
      expect(syntheses).toHaveLength(1);

      const info = syntheses[0];
      expect(info.linkId).toBe("my-profile");
      expect(info.title).toBe("My Profile");
      expect(info.file).toBe("profile.thalo");
      expect(info.sources).toHaveLength(1);
      expect(info.prompt).toBe("Generate a profile.");
      expect(info.entry.type).toBe("synthesis_entry");
    });
  });

  describe("findLatestActualize", () => {
    it("finds the latest actualize by timestamp", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore

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

      const latest = findLatestActualize(workspace, "profile");
      expect(latest).not.toBeNull();
      expect(latest!.timestamp).toBe("2026-01-07T12:00Z");
    });

    it("returns null when no actualize exists", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore

  # Prompt
  Generate.
`,
        { filename: "profile.thalo" },
      );

      const latest = findLatestActualize(workspace, "profile");
      expect(latest).toBeNull();
    });

    it("only finds actualizes for the target synthesis", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore

2026-01-07T10:01Z define-synthesis "Career" ^career
  sources: lore where #career

2026-01-07T12:00Z actualize-synthesis ^career
  updated: 2026-01-07T12:00Z
`,
        { filename: "syntheses.thalo" },
      );

      const profileActualize = findLatestActualize(workspace, "profile");
      expect(profileActualize).toBeNull();

      const careerActualize = findLatestActualize(workspace, "career");
      expect(careerActualize).not.toBeNull();
      expect(careerActualize!.target).toBe("career");
    });
  });

  describe("getActualizeUpdatedTimestamp", () => {
    it("extracts updated timestamp from actualize", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore

2026-01-07T12:00Z actualize-synthesis ^profile
  updated: 2026-01-07T11:30Z
`,
        { filename: "profile.thalo" },
      );

      const actualize = findLatestActualize(workspace, "profile");
      const updated = getActualizeUpdatedTimestamp(actualize);
      expect(updated).toBe("2026-01-07T11:30Z");
    });

    it("returns null when actualize is null", () => {
      const updated = getActualizeUpdatedTimestamp(null);
      expect(updated).toBeNull();
    });

    it("returns null when no updated metadata", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z define-synthesis "Profile" ^profile
  sources: lore

2026-01-07T12:00Z actualize-synthesis ^profile
  notes: "no updated field"
`,
        { filename: "profile.thalo" },
      );

      const actualize = findLatestActualize(workspace, "profile");
      const updated = getActualizeUpdatedTimestamp(actualize);
      expect(updated).toBeNull();
    });
  });

  describe("findEntryFile", () => {
    it("finds the file containing an entry", () => {
      const workspace = createWorkspace();
      workspace.addDocument(
        `2026-01-07T10:00Z create lore "Entry 1"
  type: "fact"
`,
        { filename: "file1.thalo" },
      );
      workspace.addDocument(
        `2026-01-07T11:00Z create lore "Entry 2"
  type: "fact"
`,
        { filename: "file2.thalo" },
      );

      // Get entries from each file via model to ensure we have the correct ones
      const model1 = workspace.getModel("file1.thalo");
      const model2 = workspace.getModel("file2.thalo");
      expect(model1).toBeDefined();
      expect(model2).toBeDefined();

      const entry1 = model1!.ast.entries.find((e) => e.type === "instance_entry");
      const entry2 = model2!.ast.entries.find((e) => e.type === "instance_entry");
      expect(entry1).toBeDefined();
      expect(entry2).toBeDefined();

      // findEntryFile should locate each entry in its correct file
      expect(findEntryFile(workspace, entry1 as import("../ast/types.js").InstanceEntry)).toBe(
        "file1.thalo",
      );
      expect(findEntryFile(workspace, entry2 as import("../ast/types.js").InstanceEntry)).toBe(
        "file2.thalo",
      );
    });
  });

  describe("getEntrySourceText", () => {
    it("extracts entry source text", () => {
      const source = `2026-01-07T10:00Z create lore "My Entry"
  type: "fact"
  subject: ^self

  # Content
  This is the content.`;

      const workspace = createWorkspace();
      workspace.addDocument(source, { filename: "test.thalo" });

      const entries = workspace.allInstanceEntries();
      expect(entries).toHaveLength(1);

      const text = getEntrySourceText(entries[0], source);
      expect(text).toContain("My Entry");
      expect(text).toContain('type: "fact"');
      expect(text).toContain("This is the content.");
    });
  });

  describe("integration: synthesis workflow", () => {
    it("finds new entries for a synthesis after last actualize", () => {
      const workspace = createWorkspace();

      // Add entries
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

      // Add synthesis with actualize
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

      // Find the synthesis
      const syntheses = findAllSyntheses(workspace);
      expect(syntheses).toHaveLength(1);

      // Find the latest actualize and its updated timestamp
      const actualize = findLatestActualize(workspace, syntheses[0].linkId);
      const lastUpdated = getActualizeUpdatedTimestamp(actualize);
      expect(lastUpdated).toBe("2026-01-07T12:00Z");

      // Query for new entries since last actualize
      const newEntries = executeQueries(workspace, syntheses[0].sources, {
        afterTimestamp: lastUpdated,
      });

      // Should only get the entry created after the actualize
      expect(newEntries).toHaveLength(1);
      expect(newEntries[0].header.title?.value).toBe("New fact");
    });

    it("returns all entries when no prior actualize exists", () => {
      const workspace = createWorkspace();

      workspace.addDocument(
        `2026-01-07T10:00Z create lore "Fact 1"
  type: "fact"
  subject: ^self

2026-01-07T11:00Z create lore "Fact 2"
  type: "fact"
  subject: ^self
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

      const syntheses = findAllSyntheses(workspace);
      const actualize = findLatestActualize(workspace, syntheses[0].linkId);
      const lastUpdated = getActualizeUpdatedTimestamp(actualize);

      expect(actualize).toBeNull();
      expect(lastUpdated).toBeNull();

      // Should get all entries when no afterTimestamp
      const entries = executeQueries(workspace, syntheses[0].sources);
      expect(entries).toHaveLength(2);
    });
  });
});
