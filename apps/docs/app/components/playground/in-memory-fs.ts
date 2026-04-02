import type {
  BufferEncoding,
  CpOptions,
  DirentEntry,
  FileContent,
  FsStat,
  IFileSystem,
  MkdirOptions,
  ReadFileOptions,
  RmOptions,
  WriteFileOptions,
} from "@rejot-dev/thalo/vfs";

export interface InMemoryFile {
  path: string;
  content: string;
}

export interface InMemorySnapshot {
  fileSystem: IFileSystem;
  filePaths: string[];
}

const DIRECTORY_MODE = 0o040755;
const FILE_MODE = 0o100644;
const textEncoder = new TextEncoder();

function normalizePath(path: string): string {
  const parts = path.split("/");
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      normalized.pop();
      continue;
    }

    normalized.push(part);
  }

  return `/${normalized.join("/")}`;
}

function resolveInMemoryPath(base: string, path: string): string {
  if (path.startsWith("/")) {
    return normalizePath(path);
  }

  return normalizePath(`${base}/${path}`);
}

function collectDirectories(paths: Iterable<string>): Set<string> {
  const directories = new Set<string>(["/"]);

  for (const path of paths) {
    const segments = normalizePath(path).split("/").filter(Boolean);
    let current = "";

    for (let index = 0; index < segments.length - 1; index += 1) {
      current += `/${segments[index]}`;
      directories.add(current);
    }
  }

  return directories;
}

function createFileStat(content: string): FsStat {
  return {
    isFile: true,
    isDirectory: false,
    isSymbolicLink: false,
    mode: FILE_MODE,
    size: textEncoder.encode(content).byteLength,
    mtime: new Date(),
  };
}

function createDirectoryStat(): FsStat {
  return {
    isFile: false,
    isDirectory: true,
    isSymbolicLink: false,
    mode: DIRECTORY_MODE,
    size: 0,
    mtime: new Date(),
  };
}

export class InMemoryFs implements IFileSystem {
  private readonly files = new Map<string, string>();
  private readonly directories: Set<string>;

  constructor(initialFiles: Record<string, string>) {
    for (const [path, content] of Object.entries(initialFiles)) {
      this.files.set(normalizePath(path), content);
    }

    this.directories = collectDirectories(this.files.keys());
  }

  resolvePath(base: string, path: string): string {
    return resolveInMemoryPath(base, path);
  }

  async readFile(path: string, _options?: ReadFileOptions | BufferEncoding): Promise<string> {
    const resolvedPath = this.resolvePath("/", path);
    const content = this.files.get(resolvedPath);

    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${resolvedPath}'`);
    }

    return content;
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    return textEncoder.encode(await this.readFile(path));
  }

  async writeFile(
    _path: string,
    _content: FileContent,
    _options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    throw new Error("InMemoryFs is read-only");
  }

  async appendFile(
    _path: string,
    _content: FileContent,
    _options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    throw new Error("InMemoryFs is read-only");
  }

  async exists(path: string): Promise<boolean> {
    const resolvedPath = this.resolvePath("/", path);
    return this.files.has(resolvedPath) || this.directories.has(resolvedPath);
  }

  async stat(path: string): Promise<FsStat> {
    const resolvedPath = this.resolvePath("/", path);
    const content = this.files.get(resolvedPath);

    if (content !== undefined) {
      return createFileStat(content);
    }

    if (this.directories.has(resolvedPath)) {
      return createDirectoryStat();
    }

    throw new Error(`ENOENT: no such file or directory, stat '${resolvedPath}'`);
  }

  async mkdir(_path: string, _options?: MkdirOptions): Promise<void> {
    throw new Error("InMemoryFs is read-only");
  }

  async readdir(path: string): Promise<string[]> {
    return (await this.readdirWithFileTypes(path)).map((entry) => entry.name);
  }

  async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
    const resolvedPath = this.resolvePath("/", path);

    if (!this.directories.has(resolvedPath)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${resolvedPath}'`);
    }

    const entries = new Map<string, DirentEntry>();
    const prefix = resolvedPath === "/" ? "/" : `${resolvedPath}/`;

    for (const directory of this.directories) {
      if (directory === resolvedPath || !directory.startsWith(prefix)) {
        continue;
      }

      const remainder = directory.slice(prefix.length);
      if (!remainder || remainder.includes("/")) {
        continue;
      }

      entries.set(remainder, {
        name: remainder,
        isFile: false,
        isDirectory: true,
        isSymbolicLink: false,
      });
    }

    for (const filePath of this.files.keys()) {
      if (!filePath.startsWith(prefix)) {
        continue;
      }

      const remainder = filePath.slice(prefix.length);
      if (!remainder || remainder.includes("/")) {
        continue;
      }

      entries.set(remainder, {
        name: remainder,
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
      });
    }

    return Array.from(entries.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  async rm(_path: string, _options?: RmOptions): Promise<void> {
    throw new Error("InMemoryFs is read-only");
  }

  async cp(_src: string, _dest: string, _options?: CpOptions): Promise<void> {
    throw new Error("InMemoryFs is read-only");
  }

  async mv(_src: string, _dest: string): Promise<void> {
    throw new Error("InMemoryFs is read-only");
  }

  getAllPaths(): string[] {
    return [...this.directories, ...this.files.keys()].sort((left, right) =>
      left.localeCompare(right),
    );
  }

  async chmod(_path: string, _mode: number): Promise<void> {
    throw new Error("InMemoryFs is read-only");
  }

  async symlink(_target: string, _linkPath: string): Promise<void> {
    throw new Error("InMemoryFs does not support symlinks");
  }

  async link(_existingPath: string, _newPath: string): Promise<void> {
    throw new Error("InMemoryFs does not support hard links");
  }

  async readlink(path: string): Promise<string> {
    throw new Error(`EINVAL: invalid argument, readlink '${this.resolvePath("/", path)}'`);
  }

  async lstat(path: string): Promise<FsStat> {
    return this.stat(path);
  }

  async realpath(path: string): Promise<string> {
    return this.resolvePath("/", path);
  }

  async utimes(_path: string, _atime: Date, _mtime: Date): Promise<void> {
    throw new Error("InMemoryFs is read-only");
  }
}

export function createInMemorySnapshot(files: Iterable<InMemoryFile>): InMemorySnapshot {
  const entries = Array.from(files, ({ path, content }) => [normalizePath(path), content] as const);

  return {
    fileSystem: new InMemoryFs(Object.fromEntries(entries)),
    filePaths: entries.map(([path]) => path),
  };
}
