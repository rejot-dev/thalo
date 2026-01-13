import { describe, it, expect, beforeEach, vi } from "vitest";
import { createWorkspace } from "../parser.native.js";
import type { Workspace } from "../model/workspace.js";
import {
  runActualize,
  generateInstructions,
  generateTimestamp,
  parseLinkIds,
  DEFAULT_INSTRUCTIONS_TEMPLATE,
} from "./actualize.js";
import type { ChangeTracker } from "../services/change-tracker/types.js";

/**
 * Create a mock change tracker for testing.
 */
function createMockTracker(): ChangeTracker {
  return {
    type: "ts" as const,
    getCurrentMarker: vi.fn().mockResolvedValue({
      type: "ts" as const,
      value: "2026-01-10T00:00Z",
    }),
    getChangedEntries: vi.fn().mockImplementation(async (_ws, _queries, marker) => {
      // If no marker (first run), return mock entries
      // Otherwise return empty (simulating no changes)
      return {
        entries: marker ? [] : [],
        currentMarker: { type: "ts" as const, value: "2026-01-10T00:00Z" },
      };
    }),
  };
}

/**
 * Helper to create a workspace from a file structure.
 */
function workspaceFromFiles(files: Record<string, string>): Workspace {
  const ws = createWorkspace();
  for (const [filename, content] of Object.entries(files)) {
    ws.addDocument(content, { filename });
  }
  return ws;
}

describe("actualize command", () => {
  describe("parseLinkIds", () => {
    it("strips ^ prefix from link IDs", () => {
      expect(parseLinkIds(["^my-synthesis", "other-synthesis"])).toEqual([
        "my-synthesis",
        "other-synthesis",
      ]);
    });

    it("handles empty array", () => {
      expect(parseLinkIds([])).toEqual([]);
    });

    it("handles IDs without ^ prefix", () => {
      expect(parseLinkIds(["synthesis-a", "synthesis-b"])).toEqual(["synthesis-a", "synthesis-b"]);
    });
  });

  describe("generateTimestamp", () => {
    it("generates ISO 8601 format with minute precision", () => {
      const date = new Date("2026-01-13T10:30:45.123Z");
      const result = generateTimestamp(date);

      expect(result).toBe("2026-01-13T10:30Z");
    });

    it("uses current date when no argument provided", () => {
      const result = generateTimestamp();

      // Should match ISO format with minute precision: YYYY-MM-DDTHH:MMZ
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
    });
  });

  describe("generateInstructions", () => {
    it("replaces all placeholders", () => {
      const result = generateInstructions(DEFAULT_INSTRUCTIONS_TEMPLATE, {
        file: "test/file.md",
        linkId: "my-synthesis",
        checkpoint: "git:abc123",
        timestamp: "2026-01-13T10:30Z",
      });

      expect(result).toContain("test/file.md");
      expect(result).toContain("my-synthesis");
      expect(result).toContain("git:abc123");
      expect(result).toContain("2026-01-13T10:30Z");
    });

    it("uses custom template", () => {
      const customTemplate = "Update {file} for {linkId} at {checkpoint} on {timestamp}";
      const result = generateInstructions(customTemplate, {
        file: "a.md",
        linkId: "b",
        checkpoint: "c",
        timestamp: "2026-01-01T00:00Z",
      });

      expect(result).toBe("Update a.md for b at c on 2026-01-01T00:00Z");
    });

    it("replaces multiple occurrences of same placeholder", () => {
      const template = "{file} and again {file}";
      const result = generateInstructions(template, {
        file: "test.md",
        linkId: "x",
        checkpoint: "y",
        timestamp: "2026-01-01T00:00Z",
      });

      expect(result).toBe("test.md and again test.md");
    });
  });

  describe("runActualize", () => {
    let workspace: Workspace;
    let mockTracker: ChangeTracker;

    beforeEach(() => {
      vi.clearAllMocks();
      mockTracker = createMockTracker();
    });

    it("returns empty syntheses when no synthesis definitions", async () => {
      workspace = workspaceFromFiles({
        "entries.thalo": `
2026-01-05T10:00Z create lore "An entry"
  type: "fact"
  subject: "test"
`,
      });

      const result = await runActualize(workspace, { tracker: mockTracker });

      expect(result.syntheses).toHaveLength(0);
      expect(result.notFoundLinkIds).toHaveLength(0);
    });

    it("finds synthesis definitions in workspace", async () => {
      workspace = workspaceFromFiles({
        "summary.md": `
# Summary

\`\`\`thalo
2026-01-10T00:00Z define-synthesis "My Summary" ^my-summary
  sources: lore where subject = "test"

  # Prompt
  Summarize the entries.
\`\`\`
`,
        "entries.thalo": `
2026-01-05T10:00Z create lore "Test Entry"
  type: "fact"
  subject: "test"
`,
      });

      const result = await runActualize(workspace, { tracker: mockTracker });

      expect(result.syntheses).toHaveLength(1);
      expect(result.syntheses[0].title).toBe("My Summary");
      expect(result.syntheses[0].linkId).toBe("my-summary");
      expect(result.syntheses[0].sources).toEqual(['lore where subject = "test"']);
      expect(result.syntheses[0].prompt).toBe("Summarize the entries.");
    });

    it("filters by target link IDs", async () => {
      workspace = workspaceFromFiles({
        "summaries.md": `
# Summaries

\`\`\`thalo
2026-01-10T00:00Z define-synthesis "Summary A" ^summary-a
  sources: lore where type = "fact"

2026-01-10T00:00Z define-synthesis "Summary B" ^summary-b
  sources: lore where type = "insight"
\`\`\`
`,
      });

      const result = await runActualize(workspace, {
        targetLinkIds: ["^summary-a"],
        tracker: mockTracker,
      });

      expect(result.syntheses).toHaveLength(1);
      expect(result.syntheses[0].linkId).toBe("summary-a");
    });

    it("reports not found link IDs", async () => {
      workspace = workspaceFromFiles({
        "summary.md": `
# Summary

\`\`\`thalo
2026-01-10T00:00Z define-synthesis "My Summary" ^existing
  sources: lore
\`\`\`
`,
      });

      const result = await runActualize(workspace, {
        targetLinkIds: ["^existing", "^nonexistent"],
        tracker: mockTracker,
      });

      expect(result.syntheses).toHaveLength(1);
      expect(result.notFoundLinkIds).toEqual(["nonexistent"]);
    });

    it("handles synthesis with no prompt section", async () => {
      workspace = workspaceFromFiles({
        "summary.md": `
\`\`\`thalo
2026-01-10T00:00Z define-synthesis "No Prompt Summary" ^no-prompt
  sources: lore where #tag1
\`\`\`
`,
      });

      const result = await runActualize(workspace, { tracker: mockTracker });

      expect(result.syntheses).toHaveLength(1);
      expect(result.syntheses[0].prompt).toBeNull();
    });

    it("includes current checkpoint in results", async () => {
      workspace = workspaceFromFiles({
        "summary.md": `
\`\`\`thalo
2026-01-10T00:00Z define-synthesis "Summary" ^my-summary
  sources: lore
\`\`\`
`,
      });

      const result = await runActualize(workspace, { tracker: mockTracker });

      expect(result.syntheses[0].currentCheckpoint).toBeDefined();
      expect(result.syntheses[0].currentCheckpoint.type).toBe("ts");
    });

    it("sets isUpToDate based on entries count", async () => {
      workspace = workspaceFromFiles({
        "summary.md": `
\`\`\`thalo
2026-01-10T00:00Z define-synthesis "Summary" ^my-summary
  sources: lore
\`\`\`
`,
      });

      const result = await runActualize(workspace, { tracker: mockTracker });

      // With mocked tracker returning empty entries, should be up to date
      expect(result.syntheses[0].isUpToDate).toBe(true);
      expect(result.syntheses[0].entries).toHaveLength(0);
    });

    it("includes tracker type in result", async () => {
      workspace = workspaceFromFiles({
        "summary.md": `
\`\`\`thalo
2026-01-10T00:00Z define-synthesis "Summary" ^my-summary
  sources: lore
\`\`\`
`,
      });

      const result = await runActualize(workspace, { tracker: mockTracker });

      expect(result.trackerType).toBe("ts");
    });

    it("uses default TimestampChangeTracker when no tracker provided", async () => {
      workspace = workspaceFromFiles({
        "summary.md": `
\`\`\`thalo
2026-01-10T00:00Z define-synthesis "Summary" ^my-summary
  sources: lore
\`\`\`
`,
      });

      // Call without providing a tracker
      const result = await runActualize(workspace);

      // Should use timestamp tracker by default
      expect(result.trackerType).toBe("ts");
    });
  });
});
