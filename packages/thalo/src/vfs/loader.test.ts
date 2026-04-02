import nodeFs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { InMemoryFs, ReadWriteFs } from "just-bash";
import { describe, expect, it } from "vitest";
import { Workspace } from "../model/workspace.js";
import { createInitializedWorkspace } from "../parser.node.js";
import { loadWorkspaceFilesFromFileSystem } from "./loader.js";
import { createNodeHostFileSystem } from "./node-host-fs.js";
import {
  collectThaloFilesFromFileSystem,
  loadThaloFilesFromFileSystem,
  loadThaloFromFileSystem,
} from "./node.js";

describe("vfs loader", () => {
  it("loads a single .thalo file from an in-memory filesystem", async () => {
    const memoryFs = new InMemoryFs({
      "/workspace/entry.thalo":
        '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
    });

    const workspace = await loadThaloFilesFromFileSystem(memoryFs, ["workspace/entry.thalo"]);

    expect(workspace.files()).toEqual(["/workspace/entry.thalo"]);
    expect(workspace.entries()).toHaveLength(1);
    expect(workspace.entries()[0]?.type).toBe("schema");
  });

  it("recursively loads .thalo and .md files, ignores hidden paths, and normalizes paths", async () => {
    const memoryFs = new InMemoryFs({
      "/workspace/entries.thalo":
        '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
      "/workspace/notes/note.md":
        '# Note\n\n```thalo\n2026-01-02T00:00Z create note "Embedded" ^embedded\n  # Content\n  From markdown.\n```\n',
      "/workspace/.drafts/hidden.thalo": '2026-01-03T00:00Z create note "Hidden" ^hidden\n',
      "/workspace/node_modules/pkg/ignored.thalo":
        '2026-01-04T00:00Z create note "Ignored" ^ignored\n',
    });

    const workspace = await loadThaloFromFileSystem(memoryFs, "/workspace");

    expect(workspace.files()).toEqual(["/workspace/entries.thalo", "/workspace/notes/note.md"]);
    expect(workspace.entries().map((entry) => entry.file)).toEqual([
      "/workspace/entries.thalo",
      "/workspace/notes/note.md",
    ]);
  });

  it("skips symlinked files and directories during recursive discovery", async () => {
    const memoryFs = new InMemoryFs({
      "/workspace/schema.thalo":
        '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
      "/workspace/real/entry.thalo":
        '2026-01-02T00:00Z create note "Real" ^real\n  # Content\n  Real.\n',
      "/workspace/linked-file-source.thalo":
        '2026-01-03T00:00Z create note "Linked" ^linked\n  # Content\n  Linked.\n',
    });

    await memoryFs.symlink("/workspace/real", "/workspace/linked-dir");
    await memoryFs.symlink("/workspace/linked-file-source.thalo", "/workspace/linked-file.thalo");

    const files = await collectThaloFilesFromFileSystem(memoryFs, "/workspace");

    expect(files).toEqual([
      "/workspace/linked-file-source.thalo",
      "/workspace/real/entry.thalo",
      "/workspace/schema.thalo",
    ]);
  });

  it("works with just-bash ReadWriteFs on disk-backed files", async () => {
    const tempDir = await nodeFs.mkdtemp(path.join(os.tmpdir(), "thalo-vfs-"));

    try {
      const schemaFile = path.join(tempDir, "schema.thalo");
      const entryFile = path.join(tempDir, "entries.thalo");

      await nodeFs.writeFile(
        schemaFile,
        '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
        "utf8",
      );
      await nodeFs.writeFile(
        entryFile,
        '2026-01-02T00:00Z create note "Disk" ^disk\n  # Content\n  On disk.\n',
        "utf8",
      );

      const diskFs = new ReadWriteFs({ root: tempDir, allowSymlinks: true });
      const workspace = await loadThaloFromFileSystem(diskFs, "/");

      expect(workspace.files()).toEqual(["/entries.thalo", "/schema.thalo"]);
      expect(
        workspace
          .entries()
          .map((entry) => entry.file)
          .sort(),
      ).toEqual(["/entries.thalo", "/schema.thalo"]);
    } finally {
      await nodeFs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("works with createNodeHostFileSystem when loaders use logical mounted-root paths", async () => {
    const tempDir = await nodeFs.mkdtemp(path.join(os.tmpdir(), "thalo-vfs-node-host-"));

    try {
      await nodeFs.writeFile(
        path.join(tempDir, "schema.thalo"),
        '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
        "utf8",
      );
      await nodeFs.writeFile(
        path.join(tempDir, "entries.thalo"),
        '2026-01-02T00:00Z create note "Disk" ^disk\n  # Content\n  On disk.\n',
        "utf8",
      );

      const fs = createNodeHostFileSystem(tempDir);
      const workspace = await loadThaloFromFileSystem(fs, "/");
      const selectedFilesWorkspace = await loadThaloFilesFromFileSystem(fs, [
        "/schema.thalo",
        "/entries.thalo",
      ]);

      expect(workspace.files()).toEqual(["/entries.thalo", "/schema.thalo"]);
      expect(selectedFilesWorkspace.files().sort()).toEqual(["/entries.thalo", "/schema.thalo"]);
    } finally {
      await nodeFs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("requires callers to provide workspace construction when using the core loader", async () => {
    const memoryFs = new InMemoryFs({
      "/workspace/entry.thalo":
        '2026-01-01T00:00Z define-entity note "Note"\n  # Sections\n  Content\n',
    });

    await expect(
      loadWorkspaceFilesFromFileSystem(memoryFs, ["/workspace/entry.thalo"], undefined as never),
    ).rejects.toThrow(
      "Loading a workspace from a filesystem now requires an explicit workspace or createWorkspace option.",
    );

    const workspace = await loadWorkspaceFilesFromFileSystem(memoryFs, ["/workspace/entry.thalo"], {
      createWorkspace: createInitializedWorkspace,
    });

    expect(workspace.files()).toEqual(["/workspace/entry.thalo"]);
  });

  it("normalizes missing-root errors from backends that expose error.code", async () => {
    const fs = {
      resolvePath: (_base: string, file: string) => file,
      async stat() {
        const error = new Error("Missing directory");
        Object.assign(error, { code: "ENOENT" });
        throw error;
      },
    } as unknown as InMemoryFs;

    await expect(collectThaloFilesFromFileSystem(fs, "/missing")).rejects.toThrow(
      "Directory not found: /missing",
    );
  });

  it("serializes fallback lstat calls when file types are unavailable", async () => {
    let concurrentLstats = 0;
    let maxConcurrentLstats = 0;
    const fileStat = {
      isFile: true,
      isDirectory: false,
      isSymbolicLink: false,
      mode: 0o100644,
      size: 1,
      mtime: new Date(),
    };

    const fs = {
      resolvePath(base: string, file: string) {
        return path.posix.resolve(base, file);
      },
      async stat() {
        return {
          isFile: false,
          isDirectory: true,
          isSymbolicLink: false,
          mode: 0o040755,
          size: 0,
          mtime: new Date(),
        };
      },
      async readdir() {
        return ["b.thalo", "a.thalo", "ignored.txt"];
      },
      async lstat(file: string) {
        concurrentLstats += 1;
        maxConcurrentLstats = Math.max(maxConcurrentLstats, concurrentLstats);
        await new Promise((resolve) => setTimeout(resolve, 0));
        concurrentLstats -= 1;

        return {
          ...fileStat,
          isFile: file.endsWith(".thalo"),
          size: file.endsWith(".thalo") ? 10 : 5,
        };
      },
    } as unknown as InMemoryFs;

    const files = await collectThaloFilesFromFileSystem(fs, "/workspace");

    expect(maxConcurrentLstats).toBe(1);
    expect(files).toEqual(["/workspace/a.thalo", "/workspace/b.thalo"]);
  });

  it("only commits file loads after every requested file succeeds", async () => {
    const memoryFs = new InMemoryFs({
      "/workspace/first.md": "# Original first document\n",
      "/workspace/second.md": "# Original second document\n",
    });
    const parser = {
      parseDocument() {
        return { blocks: [] };
      },
      parse() {
        throw new Error("parse() should not be called for markdown files without thalo blocks");
      },
      parseIncremental() {
        throw new Error(
          "parseIncremental() should not be called for markdown files without thalo blocks",
        );
      },
    } as ConstructorParameters<typeof Workspace>[0];
    const workspace = new Workspace(parser);

    await loadWorkspaceFilesFromFileSystem(
      memoryFs,
      ["/workspace/first.md", "/workspace/second.md"],
      {
        workspace,
      },
    );

    await memoryFs.writeFile("/workspace/first.md", "# Updated first document\n", "utf8");
    await memoryFs.writeFile("/workspace/second.md", "# Updated second document\n", "utf8");

    const flakyFs = new Proxy(memoryFs, {
      get(target, property, receiver) {
        if (property === "readFile") {
          return async (file: string, options?: Parameters<InMemoryFs["readFile"]>[1]) => {
            if (file === "/workspace/second.md") {
              throw new Error("boom");
            }

            return target.readFile(file, options);
          };
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    await expect(
      loadWorkspaceFilesFromFileSystem(
        flakyFs as InMemoryFs,
        ["/workspace/first.md", "/workspace/second.md"],
        { workspace },
      ),
    ).rejects.toThrow("boom");

    expect(workspace.getModel("/workspace/first.md")?.source).toBe("# Original first document\n");
    expect(workspace.getModel("/workspace/first.md")?.source).not.toBe(
      "# Updated first document\n",
    );
  });
});
