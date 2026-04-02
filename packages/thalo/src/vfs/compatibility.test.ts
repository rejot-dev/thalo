import nodeFs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { InMemoryFs, ReadWriteFs } from "just-bash";
import { describe, expect, it } from "vitest";
import { createInitializedWorkspace } from "../parser.node.js";
import { loadWorkspaceFromFileSystem } from "./loader.js";

describe("vfs compatibility with just-bash", () => {
  it("accepts an InMemoryFs implementation at runtime", async () => {
    const fs = new InMemoryFs({
      "/workspace/schema.thalo":
        '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
    });

    const workspace = await loadWorkspaceFromFileSystem(fs, "/workspace", {
      createWorkspace: createInitializedWorkspace,
    });

    expect(workspace.files()).toEqual(["/workspace/schema.thalo"]);
  });

  it("accepts a ReadWriteFs implementation at runtime", async () => {
    const tempDir = await nodeFs.mkdtemp(path.join(os.tmpdir(), "thalo-compat-"));

    try {
      const schemaFile = path.join(tempDir, "schema.thalo");
      await nodeFs.writeFile(
        schemaFile,
        '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
        "utf8",
      );

      const fs = new ReadWriteFs({ root: tempDir, allowSymlinks: true });
      const workspace = await loadWorkspaceFromFileSystem(fs, "/", {
        createWorkspace: createInitializedWorkspace,
      });

      expect(workspace.files()).toEqual(["/schema.thalo"]);
    } finally {
      await nodeFs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
