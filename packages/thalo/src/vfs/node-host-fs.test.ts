import nodeFs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeHostFileSystem } from "./node-host-fs.js";

describe("NodeHostFileSystem", () => {
  it("supports logical VFS paths rooted at the mounted directory", async () => {
    const tempDir = await nodeFs.mkdtemp(path.join(os.tmpdir(), "thalo-node-fs-logical-"));

    try {
      const schemaFile = path.join(tempDir, "schema.thalo");
      await nodeFs.writeFile(
        schemaFile,
        '2026-01-01T00:00Z define-entity lore "Lore"\n  # Sections\n  Summary\n',
        "utf8",
      );

      const fs = createNodeHostFileSystem(tempDir);

      await expect(fs.readFile("/schema.thalo", "utf8")).resolves.toContain("define-entity lore");
      await expect(fs.exists("/schema.thalo")).resolves.toBe(true);
      await expect(fs.readdir("/")).resolves.toEqual(["schema.thalo"]);
    } finally {
      await nodeFs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("can address files across multiple mounted roots", async () => {
    const firstDir = await nodeFs.mkdtemp(path.join(os.tmpdir(), "thalo-node-fs-a-"));
    const secondDir = await nodeFs.mkdtemp(path.join(os.tmpdir(), "thalo-node-fs-b-"));

    try {
      const firstFile = path.join(firstDir, "schema.thalo");
      const secondFile = path.join(secondDir, "entries.thalo");

      await nodeFs.writeFile(
        firstFile,
        '2026-01-01T00:00Z define-entity lore "Lore"\n  # Sections\n  Summary\n',
        "utf8",
      );
      await nodeFs.writeFile(
        secondFile,
        '2026-01-02T00:00Z create lore "Across roots" ^cross-root\n  # Summary\n  Works.\n',
        "utf8",
      );

      const fs = createNodeHostFileSystem([firstDir, secondDir]);

      await expect(fs.readFile(firstFile, "utf8")).resolves.toContain("define-entity lore");
      await expect(fs.readFile(secondFile, "utf8")).resolves.toContain("create lore");
      expect(fs.getAllPaths()).toEqual(expect.arrayContaining([firstFile, secondFile]));
    } finally {
      await nodeFs.rm(firstDir, { recursive: true, force: true });
      await nodeFs.rm(secondDir, { recursive: true, force: true });
    }
  });
});
