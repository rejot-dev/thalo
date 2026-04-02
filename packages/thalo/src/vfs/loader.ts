import { Workspace } from "../model/workspace.js";
import type { IFileSystem } from "./interface.js";

export const DEFAULT_WORKSPACE_EXTENSIONS = [".thalo", ".md"];

export type WorkspaceLoaderOptions =
  | {
      workspace: Workspace;
      createWorkspace?: never;
    }
  | {
      createWorkspace: () => Workspace | Promise<Workspace>;
      workspace?: never;
    };

interface WorkspaceFileDiscoveryOptions {
  extensions?: string[];
  ignore?(path: string): boolean;
}

export type LoadFromFileSystemOptions = WorkspaceLoaderOptions & WorkspaceFileDiscoveryOptions;

export type LoadFilesFromFileSystemOptions = WorkspaceLoaderOptions;

interface CollectOptions {
  extensions: string[];
  ignore(path: string): boolean;
}

interface DirectoryEntryInfo {
  path: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}

type WorkspaceParser = ConstructorParameters<typeof Workspace>[0];
type WorkspaceInternals = {
  parser: WorkspaceParser;
  models: Map<string, unknown>;
  documents: Map<string, unknown>;
  _schemaRegistry: unknown;
  _linkIndex: {
    definitions: Map<string, unknown>;
    references: Map<string, unknown>;
  };
  linkDependencies: Map<string, Set<string>>;
  entityDependencies: Map<string, Set<string>>;
};

function isFsError(error: unknown, code: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const codeValue = "code" in error ? (error as { code?: unknown }).code : undefined;
  if (typeof codeValue === "string" || typeof codeValue === "number") {
    return `${codeValue}` === code;
  }

  return error instanceof Error && error.message.includes(`${code}:`);
}

function normalizeExtensions(extensions?: string[]): string[] {
  const values = extensions && extensions.length > 0 ? extensions : DEFAULT_WORKSPACE_EXTENSIONS;
  return Array.from(new Set(values.map((extension) => extension.trim()).filter(Boolean))).map(
    (extension) => (extension.startsWith(".") ? extension : `.${extension}`),
  );
}

function shouldIncludeWorkspaceFile(path: string, extensions: string[]): boolean {
  return extensions.some((extension) => path.endsWith(extension));
}

function toRelativePath(root: string, path: string): string {
  if (path === root) {
    return "/";
  }

  if (root === "/") {
    return path;
  }

  if (path.startsWith(`${root}/`)) {
    return path.slice(root.length);
  }

  return path;
}

function splitPathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function isIgnoredWorkspaceSegment(segment: string): boolean {
  return segment === "node_modules" || segment.startsWith(".");
}

export function shouldIgnoreWorkspacePath(path: string): boolean {
  return splitPathSegments(path).some(isIgnoredWorkspaceSegment);
}

function createIgnorePredicate(
  root: string,
  ignore?: (path: string) => boolean,
): (path: string) => boolean {
  return (path: string) => {
    if (ignore?.(path)) {
      return true;
    }

    const relativePath = toRelativePath(root, path);
    return shouldIgnoreWorkspacePath(relativePath);
  };
}

async function listDirectoryEntries(
  fs: IFileSystem,
  directory: string,
): Promise<DirectoryEntryInfo[]> {
  if (fs.readdirWithFileTypes) {
    const entries = await fs.readdirWithFileTypes(directory);
    return entries
      .map((entry) => ({
        path: fs.resolvePath(directory, entry.name),
        isFile: entry.isFile,
        isDirectory: entry.isDirectory,
        isSymbolicLink: entry.isSymbolicLink,
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  const names = await fs.readdir(directory);
  const entries: DirectoryEntryInfo[] = [];

  for (const name of names) {
    const path = fs.resolvePath(directory, name);
    const stats = await fs.lstat(path);
    entries.push({
      path,
      isFile: stats.isFile,
      isDirectory: stats.isDirectory,
      isSymbolicLink: stats.isSymbolicLink,
    });
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function getOrCreateWorkspace(options?: WorkspaceLoaderOptions): Promise<Workspace> {
  if (options?.workspace && options.createWorkspace) {
    throw new Error("Provide either workspace or createWorkspace, not both.");
  }

  if (options?.workspace) {
    return options.workspace;
  }

  if (options?.createWorkspace) {
    return await options.createWorkspace();
  }

  throw new Error(
    "Loading a workspace from a filesystem now requires an explicit workspace or createWorkspace option.",
  );
}

function cloneDependencyMap(dependencies: Map<string, Set<string>>): Map<string, Set<string>> {
  return new Map(Array.from(dependencies, ([key, files]) => [key, new Set(files)]));
}

function createScratchWorkspace(workspace: Workspace): Workspace {
  const parser = (workspace as unknown as WorkspaceInternals).parser;
  const scratchWorkspace = new Workspace(parser);

  for (const model of workspace.allModels()) {
    scratchWorkspace.updateDocument(model.file, model.source);
  }

  return scratchWorkspace;
}

function commitScratchWorkspace(targetWorkspace: Workspace, scratchWorkspace: Workspace): void {
  const target = targetWorkspace as unknown as WorkspaceInternals;
  const scratch = scratchWorkspace as unknown as WorkspaceInternals;

  target.models = new Map(scratch.models);
  target.documents = new Map(scratch.documents);
  target._schemaRegistry = scratch._schemaRegistry;
  target._linkIndex = {
    definitions: new Map(scratch._linkIndex.definitions),
    references: new Map(scratch._linkIndex.references),
  };
  target.linkDependencies = cloneDependencyMap(scratch.linkDependencies);
  target.entityDependencies = cloneDependencyMap(scratch.entityDependencies);
}

async function addOrUpdateWorkspaceDocument(
  workspace: Workspace,
  fs: IFileSystem,
  file: string,
): Promise<void> {
  const source = await fs.readFile(file, "utf8");

  if (workspace.hasDocument(file)) {
    workspace.updateDocument(file, source);
    return;
  }

  workspace.addDocument(source, { filename: file });
}

async function assertRootDirectory(
  fs: IFileSystem,
  root: string,
  originalRoot: string,
): Promise<void> {
  let stats;
  try {
    stats = await fs.stat(root);
  } catch (error) {
    if (isFsError(error, "ENOENT")) {
      throw new Error(`Directory not found: ${originalRoot}`);
    }
    throw error;
  }

  if (!stats.isDirectory) {
    throw new Error(`Path is not a directory: ${originalRoot}`);
  }
}

export async function collectThaloFilesFromFileSystem(
  fs: IFileSystem,
  root: string,
  options: WorkspaceFileDiscoveryOptions = {},
): Promise<string[]> {
  const resolvedRoot = fs.resolvePath("/", root);
  await assertRootDirectory(fs, resolvedRoot, root);

  const collectOptions: CollectOptions = {
    extensions: normalizeExtensions(options.extensions),
    ignore: createIgnorePredicate(resolvedRoot, options.ignore),
  };

  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await listDirectoryEntries(fs, directory);

    for (const entry of entries) {
      if (collectOptions.ignore(entry.path)) {
        continue;
      }

      if (entry.isSymbolicLink) {
        continue;
      }

      if (entry.isDirectory) {
        await walk(entry.path);
        continue;
      }

      if (entry.isFile && shouldIncludeWorkspaceFile(entry.path, collectOptions.extensions)) {
        files.push(entry.path);
      }
    }
  }

  await walk(resolvedRoot);
  return files;
}

export async function loadWorkspaceFromFileSystem(
  fs: IFileSystem,
  root: string,
  options: LoadFromFileSystemOptions,
): Promise<Workspace> {
  const workspace = await getOrCreateWorkspace(options);
  const files = await collectThaloFilesFromFileSystem(fs, root, options);
  const extensions = normalizeExtensions(options.extensions);

  if (files.length === 0) {
    throw new Error(`No ${extensions.join(" or ")} files found in ${root}`);
  }

  const scratchWorkspace = createScratchWorkspace(workspace);
  for (const file of files) {
    await addOrUpdateWorkspaceDocument(scratchWorkspace, fs, file);
  }

  commitScratchWorkspace(workspace, scratchWorkspace);
  return workspace;
}

export async function loadWorkspaceFilesFromFileSystem(
  fs: IFileSystem,
  files: string[],
  options: LoadFilesFromFileSystemOptions,
): Promise<Workspace> {
  const workspace = await getOrCreateWorkspace(options);
  const scratchWorkspace = createScratchWorkspace(workspace);

  for (const file of files) {
    const resolvedPath = fs.resolvePath("/", file);
    await addOrUpdateWorkspaceDocument(scratchWorkspace, fs, resolvedPath);
  }

  commitScratchWorkspace(workspace, scratchWorkspace);
  return workspace;
}
