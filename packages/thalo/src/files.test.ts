import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("files", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("loads a workspace with automatic WASM fallback and skips hidden paths", async () => {
    vi.doMock("tree-sitter", () => {
      throw new Error("native bindings unavailable");
    });

    const { loadWorkspaceFromDirectory } = await import("./files.js");

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thalo-files-"));

    try {
      const visibleFile = path.join(tempDir, "entries.thalo");
      const nestedDir = path.join(tempDir, "notes");
      const markdownFile = path.join(nestedDir, "note.md");
      const hiddenFile = path.join(tempDir, ".hidden.thalo");
      const nodeModulesDir = path.join(tempDir, "node_modules");
      const ignoredFile = path.join(nodeModulesDir, "ignored.thalo");

      await fs.mkdir(nestedDir, { recursive: true });
      await fs.mkdir(nodeModulesDir, { recursive: true });

      await fs.writeFile(visibleFile, '2026-01-01T00:00Z create lore "Visible entry"\n', "utf8");
      await fs.writeFile(markdownFile, "# Note\n\nPlain markdown content.\n", "utf8");
      await fs.writeFile(hiddenFile, '2026-01-02T00:00Z create lore "Hidden entry"\n', "utf8");
      await fs.writeFile(ignoredFile, '2026-01-03T00:00Z create lore "Ignored entry"\n', "utf8");

      const workspace = await loadWorkspaceFromDirectory(tempDir);

      expect(workspace.hasDocument(visibleFile)).toBe(true);
      expect(workspace.hasDocument(markdownFile)).toBe(true);
      expect(workspace.hasDocument(hiddenFile)).toBe(false);
      expect(workspace.hasDocument(ignoredFile)).toBe(false);

      const model = workspace.getModel(visibleFile);
      expect(model?.ast.entries).toHaveLength(1);
      expect(model?.ast.entries[0]?.type).toBe("instance_entry");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("loads specific files without requiring callers to initialize the parser", async () => {
    vi.doMock("tree-sitter", () => {
      throw new Error("native bindings unavailable");
    });

    const { loadWorkspaceFromFiles } = await import("./files.js");

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thalo-files-"));

    try {
      const filePath = path.join(tempDir, "entries.thalo");
      await fs.writeFile(filePath, '2026-01-04T00:00Z create lore "Loaded from file"\n', "utf8");

      const workspace = await loadWorkspaceFromFiles([filePath]);

      expect(workspace.hasDocument(filePath)).toBe(true);
      expect(workspace.getModel(filePath)?.ast.entries).toHaveLength(1);
      expect(workspace.getModel(filePath)?.ast.entries[0]?.type).toBe("instance_entry");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("loads specific files from unrelated directories", async () => {
    vi.doMock("tree-sitter", () => {
      throw new Error("native bindings unavailable");
    });

    const { loadWorkspaceFromFiles } = await import("./files.js");

    const firstDir = await fs.mkdtemp(path.join(os.tmpdir(), "thalo-files-a-"));
    const secondDir = await fs.mkdtemp(path.join(os.tmpdir(), "thalo-files-b-"));

    try {
      const firstFile = path.join(firstDir, "schema.thalo");
      const secondFile = path.join(secondDir, "entries.thalo");

      await fs.writeFile(
        firstFile,
        '2026-01-01T00:00Z define-entity lore "Lore"\n  # Sections\n  Summary\n',
        "utf8",
      );
      await fs.writeFile(
        secondFile,
        '2026-01-02T00:00Z create lore "Across roots" ^cross-root\n  # Summary\n  Works.\n',
        "utf8",
      );

      const workspace = await loadWorkspaceFromFiles([firstFile, secondFile]);

      expect(workspace.hasDocument(firstFile)).toBe(true);
      expect(workspace.hasDocument(secondFile)).toBe(true);
      expect(workspace.files().sort()).toEqual([firstFile, secondFile].sort());
    } finally {
      await fs.rm(firstDir, { recursive: true, force: true });
      await fs.rm(secondDir, { recursive: true, force: true });
    }
  });
});
