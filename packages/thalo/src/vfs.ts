export type {
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
} from "./vfs/interface.js";

export {
  DEFAULT_WORKSPACE_EXTENSIONS,
  collectThaloFilesFromFileSystem,
  loadWorkspaceFilesFromFileSystem,
  loadWorkspaceFromFileSystem,
  shouldIgnoreWorkspacePath,
} from "./vfs/loader.js";
export type {
  LoadFilesFromFileSystemOptions,
  LoadFromFileSystemOptions,
  WorkspaceLoaderOptions,
} from "./vfs/loader.js";

export { applyWorkspaceFileChange } from "./vfs/sync.js";
export type { WorkspaceFileChange } from "./vfs/sync.js";

export {
  FileRevisionConflictError,
  readFileRevision,
  writeWorkspaceDocument,
} from "./vfs/persistence.js";
export type { FileRevision } from "./vfs/persistence.js";
