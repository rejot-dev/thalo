import { describe, it, expect, beforeEach, vi } from "vitest";
import { createWorkspace } from "../parser.native.js";
import { Workspace } from "../model/workspace.js";
import { buildWorkspaceIndex } from "./workspace-index.js";
import {
  runVisitors,
  runVisitorsOnModel,
  runVisitorsOnEntries,
  dispatchToVisitor,
  type RuleVisitor,
  type EntryContext,
} from "./visitor.js";
import type { InstanceEntry, SchemaEntry, SynthesisEntry } from "../ast/types.js";

describe("Visitor", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  describe("runVisitors", () => {
    it("should call beforeCheck and afterCheck", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore"
  # Metadata
  type: "fact"
`,
        { filename: "test.thalo" },
      );

      const beforeCheck = vi.fn();
      const afterCheck = vi.fn();

      const visitor: RuleVisitor = { beforeCheck, afterCheck };
      const index = buildWorkspaceIndex(workspace);

      runVisitors([visitor], workspace, index, () => {});

      expect(beforeCheck).toHaveBeenCalledTimes(1);
      expect(afterCheck).toHaveBeenCalledTimes(1);
    });

    it("should dispatch to visitInstanceEntry for instance entries", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore"
  # Metadata
  type: "fact"
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Test entry"
  type: "fact"
`,
        { filename: "entries.thalo" },
      );

      const visitInstanceEntry = vi.fn();
      const visitor: RuleVisitor = { visitInstanceEntry };
      const index = buildWorkspaceIndex(workspace);

      runVisitors([visitor], workspace, index, () => {});

      expect(visitInstanceEntry).toHaveBeenCalledTimes(1);
      const [entry, ctx] = visitInstanceEntry.mock.calls[0];
      expect(entry.type).toBe("instance_entry");
      expect(ctx.file).toBe("entries.thalo");
    });

    it("should dispatch to visitSchemaEntry for schema entries", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore"
  # Metadata
  type: "fact"

2026-01-02T00:00Z alter-entity lore "Add field"
  # Metadata
  extra: string
`,
        { filename: "entities.thalo" },
      );

      const visitSchemaEntry = vi.fn();
      const visitor: RuleVisitor = { visitSchemaEntry };
      const index = buildWorkspaceIndex(workspace);

      runVisitors([visitor], workspace, index, () => {});

      expect(visitSchemaEntry).toHaveBeenCalledTimes(2);
    });

    it("should dispatch to visitSynthesisEntry for synthesis entries", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore"
  # Metadata
  type: "fact"
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z define-synthesis ^bio "Personal Bio"
  sources: lore where type = "fact"

# Prompt
Summarize.
`,
        { filename: "syntheses.thalo" },
      );

      const visitSynthesisEntry = vi.fn();
      const visitor: RuleVisitor = { visitSynthesisEntry };
      const index = buildWorkspaceIndex(workspace);

      runVisitors([visitor], workspace, index, () => {});

      expect(visitSynthesisEntry).toHaveBeenCalledTimes(1);
      const [entry] = visitSynthesisEntry.mock.calls[0];
      expect(entry.type).toBe("synthesis_entry");
    });

    it("should dispatch to visitActualizeEntry for actualize entries", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore"
  # Metadata
  type: "fact"
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z define-synthesis ^bio "Personal Bio"
  sources: lore where type = "fact"

# Prompt
Summarize.
`,
        { filename: "syntheses.thalo" },
      );

      workspace.addDocument(
        `2026-01-10T12:00Z actualize-synthesis ^bio "Updated bio"
  updated: 2026-01-10T12:00Z
`,
        { filename: "actualizations.thalo" },
      );

      const visitActualizeEntry = vi.fn();
      const visitor: RuleVisitor = { visitActualizeEntry };
      const index = buildWorkspaceIndex(workspace);

      runVisitors([visitor], workspace, index, () => {});

      expect(visitActualizeEntry).toHaveBeenCalledTimes(1);
      const [entry] = visitActualizeEntry.mock.calls[0];
      expect(entry.type).toBe("actualize_entry");
    });

    it("should run multiple visitors in a single pass", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore"
  # Metadata
  type: "fact"
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Entry 1"
  type: "fact"

2026-01-06T18:00Z create lore "Entry 2"
  type: "fact"
`,
        { filename: "entries.thalo" },
      );

      const visitor1 = { visitInstanceEntry: vi.fn() };
      const visitor2 = { visitInstanceEntry: vi.fn() };
      const index = buildWorkspaceIndex(workspace);

      runVisitors([visitor1, visitor2], workspace, index, () => {});

      // Both visitors should be called for each instance entry
      expect(visitor1.visitInstanceEntry).toHaveBeenCalledTimes(2);
      expect(visitor2.visitInstanceEntry).toHaveBeenCalledTimes(2);
    });
  });

  describe("runVisitorsOnModel", () => {
    it("should only visit entries in the specified model", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore"
  # Metadata
  type: "fact"
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
`,
        { filename: "entries.thalo" },
      );

      const visitInstanceEntry = vi.fn();
      const visitSchemaEntry = vi.fn();
      const visitor: RuleVisitor = { visitInstanceEntry, visitSchemaEntry };
      const index = buildWorkspaceIndex(workspace);

      // Only run on entries.thalo
      const entriesModel = workspace.getModel("entries.thalo")!;
      runVisitorsOnModel([visitor], entriesModel, workspace, index, () => {});

      // Should only visit the instance entry in entries.thalo
      expect(visitInstanceEntry).toHaveBeenCalledTimes(1);
      expect(visitSchemaEntry).toHaveBeenCalledTimes(0);
    });

    it("should still call beforeCheck and afterCheck", () => {
      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
`,
        { filename: "entries.thalo" },
      );

      const beforeCheck = vi.fn();
      const afterCheck = vi.fn();
      const visitor: RuleVisitor = { beforeCheck, afterCheck };
      const index = buildWorkspaceIndex(workspace);

      const model = workspace.getModel("entries.thalo")!;
      runVisitorsOnModel([visitor], model, workspace, index, () => {});

      expect(beforeCheck).toHaveBeenCalledTimes(1);
      expect(afterCheck).toHaveBeenCalledTimes(1);
    });
  });

  describe("runVisitorsOnEntries", () => {
    it("should only visit specified entries", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore"
  # Metadata
  type: "fact"
`,
        { filename: "entities.thalo" },
      );

      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Entry 1" ^first
  type: "fact"

2026-01-06T18:00Z create lore "Entry 2" ^second
  type: "fact"

2026-01-07T18:00Z create lore "Entry 3" ^third
  type: "fact"
`,
        { filename: "entries.thalo" },
      );

      const visitInstanceEntry = vi.fn();
      const visitor: RuleVisitor = { visitInstanceEntry };
      const index = buildWorkspaceIndex(workspace);

      const model = workspace.getModel("entries.thalo")!;
      // Only run on first two entries
      const entriesToCheck = model.ast.entries.slice(0, 2);

      runVisitorsOnEntries([visitor], entriesToCheck, model, workspace, index, () => {});

      expect(visitInstanceEntry).toHaveBeenCalledTimes(2);
    });

    it("should NOT call beforeCheck/afterCheck for incremental checks", () => {
      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
`,
        { filename: "entries.thalo" },
      );

      const beforeCheck = vi.fn();
      const afterCheck = vi.fn();
      const visitInstanceEntry = vi.fn();
      const visitor: RuleVisitor = { beforeCheck, afterCheck, visitInstanceEntry };
      const index = buildWorkspaceIndex(workspace);

      const model = workspace.getModel("entries.thalo")!;
      runVisitorsOnEntries([visitor], model.ast.entries, model, workspace, index, () => {});

      // beforeCheck/afterCheck should NOT be called for incremental
      expect(beforeCheck).not.toHaveBeenCalled();
      expect(afterCheck).not.toHaveBeenCalled();
      expect(visitInstanceEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe("dispatchToVisitor", () => {
    it("should dispatch instance_entry to visitInstanceEntry", () => {
      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
`,
        { filename: "test.thalo" },
      );

      const model = workspace.getModel("test.thalo")!;
      const entry = model.ast.entries[0] as InstanceEntry;
      const index = buildWorkspaceIndex(workspace);

      const visitInstanceEntry = vi.fn();
      const visitor: RuleVisitor = { visitInstanceEntry };

      const ctx: EntryContext = {
        workspace,
        index,
        model,
        file: model.file,
        sourceMap: model.sourceMap,
        report: () => {},
      };

      dispatchToVisitor(visitor, entry, ctx);

      expect(visitInstanceEntry).toHaveBeenCalledWith(entry, ctx);
    });

    it("should dispatch schema_entry to visitSchemaEntry", () => {
      workspace.addDocument(
        `2026-01-01T00:00Z define-entity lore "Lore"
  # Metadata
  type: "fact"
`,
        { filename: "test.thalo" },
      );

      const model = workspace.getModel("test.thalo")!;
      const entry = model.ast.entries[0] as SchemaEntry;
      const index = buildWorkspaceIndex(workspace);

      const visitSchemaEntry = vi.fn();
      const visitor: RuleVisitor = { visitSchemaEntry };

      const ctx: EntryContext = {
        workspace,
        index,
        model,
        file: model.file,
        sourceMap: model.sourceMap,
        report: () => {},
      };

      dispatchToVisitor(visitor, entry, ctx);

      expect(visitSchemaEntry).toHaveBeenCalledWith(entry, ctx);
    });

    it("should dispatch synthesis_entry to visitSynthesisEntry", () => {
      workspace.addDocument(
        `2026-01-05T18:00Z define-synthesis ^bio "Bio"
  sources: lore where type = "fact"

# Prompt
Test.
`,
        { filename: "test.thalo" },
      );

      const model = workspace.getModel("test.thalo")!;
      const entry = model.ast.entries[0] as SynthesisEntry;
      const index = buildWorkspaceIndex(workspace);

      const visitSynthesisEntry = vi.fn();
      const visitor: RuleVisitor = { visitSynthesisEntry };

      const ctx: EntryContext = {
        workspace,
        index,
        model,
        file: model.file,
        sourceMap: model.sourceMap,
        report: () => {},
      };

      dispatchToVisitor(visitor, entry, ctx);

      expect(visitSynthesisEntry).toHaveBeenCalledWith(entry, ctx);
    });

    it("should not call methods that are not defined", () => {
      workspace.addDocument(
        `2026-01-05T18:00Z create lore "Entry"
  type: "fact"
`,
        { filename: "test.thalo" },
      );

      const model = workspace.getModel("test.thalo")!;
      const entry = model.ast.entries[0];
      const index = buildWorkspaceIndex(workspace);

      // Empty visitor - no methods defined
      const visitor: RuleVisitor = {};

      const ctx: EntryContext = {
        workspace,
        index,
        model,
        file: model.file,
        sourceMap: model.sourceMap,
        report: () => {},
      };

      // Should not throw
      expect(() => dispatchToVisitor(visitor, entry, ctx)).not.toThrow();
    });
  });
});
