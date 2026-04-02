import { InMemoryFs } from "just-bash";
import { describe, expect, it } from "vitest";
import {
  FileRevisionConflictError,
  readFileRevision,
  writeWorkspaceDocument,
} from "./persistence.js";

describe("vfs persistence", () => {
  it("reads a content-based file revision", async () => {
    const fs = new InMemoryFs({
      "/entry.thalo": '2026-01-01T00:00Z create note "Test" ^test\n',
    });

    const revision = await readFileRevision(fs, "/entry.thalo");

    expect(revision.token).toHaveLength(64);
    expect(revision.size).toBeGreaterThan(0);
    expect(revision.mtimeMs).toBeTypeOf("number");
  });

  it("writes when the expected revision matches", async () => {
    const fs = new InMemoryFs({
      "/entry.thalo": '2026-01-01T00:00Z create note "Before" ^test\n',
    });
    const revision = await readFileRevision(fs, "/entry.thalo");

    await writeWorkspaceDocument(
      fs,
      "/entry.thalo",
      '2026-01-01T00:00Z create note "After" ^test\n',
      revision,
    );

    expect(await fs.readFile("/entry.thalo", "utf8")).toContain('"After"');
  });

  it("does not spuriously conflict when only mtime changes", async () => {
    const fs = new InMemoryFs({
      "/entry.thalo": '2026-01-01T00:00Z create note "Same" ^test\n',
    });
    const revision = await readFileRevision(fs, "/entry.thalo");

    await fs.utimes("/entry.thalo", new Date(2_000), new Date(2_000));
    await writeWorkspaceDocument(
      fs,
      "/entry.thalo",
      await fs.readFile("/entry.thalo", "utf8"),
      revision,
    );

    expect(await fs.readFile("/entry.thalo", "utf8")).toContain('"Same"');
  });

  it("conflicts when content changes even if mtime is reset", async () => {
    const fs = new InMemoryFs({
      "/entry.thalo": '2026-01-01T00:00Z create note "Before" ^test\n',
    });
    const revision = await readFileRevision(fs, "/entry.thalo");
    const preservedMtime = new Date(revision.mtimeMs ?? 0);

    await fs.writeFile("/entry.thalo", '2026-01-01T00:00Z create note "Changed" ^test\n', "utf8");
    await fs.utimes("/entry.thalo", preservedMtime, preservedMtime);

    await expect(
      writeWorkspaceDocument(
        fs,
        "/entry.thalo",
        '2026-01-01T00:00Z create note "Final" ^test\n',
        revision,
      ),
    ).rejects.toBeInstanceOf(FileRevisionConflictError);
  });

  it("checks the expected revision against the original logical path", async () => {
    const mountedFs = new InMemoryFs({
      "/mounted/entry.thalo": '2026-01-01T00:00Z create note "Before" ^test\n',
    });

    const fs = new Proxy(mountedFs, {
      get(target, property, receiver) {
        if (property === "resolvePath") {
          return (_base: string, file: string) =>
            `/mounted${file.startsWith("/") ? file : `/${file}`}`;
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as InMemoryFs;

    const revision = await readFileRevision(fs, "/entry.thalo");

    await expect(
      writeWorkspaceDocument(
        fs,
        "/entry.thalo",
        '2026-01-01T00:00Z create note "After" ^test\n',
        revision,
      ),
    ).resolves.toBeUndefined();

    expect(await mountedFs.readFile("/mounted/entry.thalo", "utf8")).toContain('"After"');
  });
});
