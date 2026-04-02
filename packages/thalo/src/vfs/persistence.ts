import type { IFileSystem } from "./interface.js";
import { hashContent } from "./hash.js";

export interface FileRevision {
  token: string;
  size?: number;
  mtimeMs?: number;
}

export class FileRevisionConflictError extends Error {
  readonly path: string;
  readonly expectedRevision: FileRevision;
  readonly actualRevision: FileRevision;

  constructor(path: string, expectedRevision: FileRevision, actualRevision: FileRevision) {
    super(`File revision conflict for ${path}`);
    this.name = "FileRevisionConflictError";
    this.path = path;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export async function readFileRevision(fs: IFileSystem, path: string): Promise<FileRevision> {
  const resolvedPath = fs.resolvePath("/", path);
  const [content, stats] = await Promise.all([
    fs.readFileBuffer(resolvedPath),
    fs.stat(resolvedPath),
  ]);

  return {
    token: await hashContent(content),
    size: stats.size,
    mtimeMs: stats.mtime.getTime(),
  };
}

export async function writeWorkspaceDocument(
  fs: IFileSystem,
  file: string,
  content: string,
  expectedRevision?: FileRevision,
): Promise<void> {
  const resolvedPath = fs.resolvePath("/", file);

  if (expectedRevision) {
    const actualRevision = await readFileRevision(fs, file);
    if (actualRevision.token !== expectedRevision.token) {
      throw new FileRevisionConflictError(resolvedPath, expectedRevision, actualRevision);
    }
  }

  await fs.writeFile(resolvedPath, content, "utf8");
}
