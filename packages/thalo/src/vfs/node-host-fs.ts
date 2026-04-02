import path from "node:path";
import { ReadWriteFs } from "just-bash";
import type {
  BufferEncoding,
  CpOptions,
  DirentEntry,
  FileContent,
  IFileSystem,
  MkdirOptions,
  ReadFileOptions,
  RmOptions,
  WriteFileOptions,
} from "./interface.js";

function toPosixRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function toLogicalPath(value: string): string {
  return path.posix.resolve("/", value.replaceAll("\\", "/"));
}

interface HostMount {
  hostRoot: string;
  fs: ReadWriteFs;
}

function normalizeHostRoots(root: string | string[]): string[] {
  const roots = Array.isArray(root) ? root : [root];
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const entry of roots) {
    const resolvedEntry = path.resolve(entry);
    if (seen.has(resolvedEntry)) {
      continue;
    }

    seen.add(resolvedEntry);
    deduped.push(resolvedEntry);
  }

  return deduped;
}

class NodeHostFileSystem implements IFileSystem {
  private readonly mounts: HostMount[];
  private readonly hostPathMounts: HostMount[];

  constructor(root: string | string[]) {
    const hostRoots = normalizeHostRoots(root);

    if (hostRoots.length === 0) {
      throw new Error("NodeHostFileSystem requires at least one host root.");
    }

    this.mounts = hostRoots.map((hostRoot) => ({
      hostRoot,
      fs: new ReadWriteFs({ root: hostRoot, allowSymlinks: true }),
    }));

    this.hostPathMounts = [...this.mounts].sort(
      (left, right) => right.hostRoot.length - left.hostRoot.length,
    );
  }

  private getHostPathMount(pathValue: string): { mount: HostMount; logicalPath: string } | null {
    const resolvedPath = path.resolve(pathValue);

    for (const mount of this.hostPathMounts) {
      const relativePath = path.relative(mount.hostRoot, resolvedPath);
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        continue;
      }

      return {
        mount,
        logicalPath: relativePath === "" ? "/" : `/${toPosixRelativePath(relativePath)}`,
      };
    }

    return null;
  }

  private getLogicalPathMount(pathValue: string): { mount: HostMount; logicalPath: string } {
    const mount = this.mounts[0];

    if (!mount) {
      throw new Error("NodeHostFileSystem requires at least one host root.");
    }

    return { mount, logicalPath: toLogicalPath(pathValue) };
  }

  private getMount(pathValue: string): { mount: HostMount; logicalPath: string } {
    return this.getHostPathMount(pathValue) ?? this.getLogicalPathMount(pathValue);
  }

  private toHostPath(mount: HostMount, logicalPath: string): string {
    if (logicalPath === "/") {
      return mount.hostRoot;
    }

    return path.resolve(mount.hostRoot, `.${logicalPath}`);
  }

  readFile(pathValue: string, options?: ReadFileOptions | BufferEncoding): Promise<string> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.readFile(logicalPath, options);
  }

  readFileBuffer(pathValue: string): Promise<Uint8Array> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.readFileBuffer(logicalPath);
  }

  writeFile(
    pathValue: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.writeFile(logicalPath, content, options);
  }

  appendFile(
    pathValue: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.appendFile(logicalPath, content, options);
  }

  exists(pathValue: string): Promise<boolean> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.exists(logicalPath);
  }

  stat(pathValue: string) {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.stat(logicalPath);
  }

  mkdir(pathValue: string, options?: MkdirOptions): Promise<void> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.mkdir(logicalPath, options);
  }

  readdir(pathValue: string): Promise<string[]> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.readdir(logicalPath);
  }

  readdirWithFileTypes(pathValue: string): Promise<DirentEntry[]> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.readdirWithFileTypes!(logicalPath);
  }

  rm(pathValue: string, options?: RmOptions): Promise<void> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.rm(logicalPath, options);
  }

  cp(src: string, dest: string, options?: CpOptions): Promise<void> {
    const source = this.getMount(src);
    const target = this.getMount(dest);

    if (source.mount !== target.mount) {
      throw new Error(`Cross-root copies are not supported: ${src} -> ${dest}`);
    }

    return source.mount.fs.cp(source.logicalPath, target.logicalPath, options);
  }

  mv(src: string, dest: string): Promise<void> {
    const source = this.getMount(src);
    const target = this.getMount(dest);

    if (source.mount !== target.mount) {
      throw new Error(`Cross-root moves are not supported: ${src} -> ${dest}`);
    }

    return source.mount.fs.mv(source.logicalPath, target.logicalPath);
  }

  resolvePath(base: string, pathValue: string): string {
    return path.posix.resolve(base, pathValue);
  }

  getAllPaths(): string[] {
    return this.mounts.flatMap((mount) =>
      mount.fs.getAllPaths().map((entry) => this.toHostPath(mount, entry)),
    );
  }

  chmod(pathValue: string, mode: number): Promise<void> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.chmod(logicalPath, mode);
  }

  symlink(target: string, linkPath: string): Promise<void> {
    const targetMount = this.getMount(target);
    const linkMount = this.getMount(linkPath);

    if (targetMount.mount !== linkMount.mount) {
      throw new Error(`Cross-root symlinks are not supported: ${target} -> ${linkPath}`);
    }

    return targetMount.mount.fs.symlink(targetMount.logicalPath, linkMount.logicalPath);
  }

  link(existingPath: string, newPath: string): Promise<void> {
    const source = this.getMount(existingPath);
    const target = this.getMount(newPath);

    if (source.mount !== target.mount) {
      throw new Error(`Cross-root hard links are not supported: ${existingPath} -> ${newPath}`);
    }

    return source.mount.fs.link(source.logicalPath, target.logicalPath);
  }

  async readlink(pathValue: string): Promise<string> {
    const { mount, logicalPath } = this.getMount(pathValue);
    const target = await mount.fs.readlink(logicalPath);
    return target.startsWith("/") ? this.toHostPath(mount, target) : target;
  }

  lstat(pathValue: string) {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.lstat(logicalPath);
  }

  async realpath(pathValue: string): Promise<string> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return this.toHostPath(mount, await mount.fs.realpath(logicalPath));
  }

  utimes(pathValue: string, atime: Date, mtime: Date): Promise<void> {
    const { mount, logicalPath } = this.getMount(pathValue);
    return mount.fs.utimes(logicalPath, atime, mtime);
  }
}

export function createNodeHostFileSystem(root: string | string[]): IFileSystem {
  return new NodeHostFileSystem(root);
}
