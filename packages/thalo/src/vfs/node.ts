import type { ThaloWorkspaceInterface } from "../api.js";
import type { Workspace } from "../model/workspace.js";
import { wrapWorkspace } from "../api.js";
import { createInitializedWorkspace } from "../parser.node.js";
import type { IFileSystem } from "./interface.js";
import {
  loadWorkspaceFilesFromFileSystem,
  loadWorkspaceFromFileSystem,
  type LoadFilesFromFileSystemOptions,
  type LoadFromFileSystemOptions,
} from "./loader.js";

export * from "../vfs.js";
export { createNodeHostFileSystem } from "./node-host-fs.js";

type NodeWorkspaceLoaderOptions = {
  workspace?: Workspace;
  createWorkspace?: () => Workspace | Promise<Workspace>;
};

export type NodeLoadFromFileSystemOptions = Omit<
  LoadFromFileSystemOptions,
  "workspace" | "createWorkspace"
> &
  NodeWorkspaceLoaderOptions;

export type NodeLoadFilesFromFileSystemOptions = NodeWorkspaceLoaderOptions;

function withNodeWorkspaceFactory(
  options: NodeWorkspaceLoaderOptions = {},
): LoadFilesFromFileSystemOptions {
  if (options.workspace && options.createWorkspace) {
    throw new Error("Provide either workspace or createWorkspace, not both.");
  }

  if (options.workspace) {
    return { workspace: options.workspace };
  }

  return {
    createWorkspace: options.createWorkspace ?? createInitializedWorkspace,
  };
}

export async function loadThaloFromFileSystem(
  fs: IFileSystem,
  root: string,
  options: NodeLoadFromFileSystemOptions = {},
): Promise<ThaloWorkspaceInterface> {
  const workspace = await loadWorkspaceFromFileSystem(fs, root, {
    extensions: options.extensions,
    ignore: options.ignore,
    ...withNodeWorkspaceFactory(options),
  });
  return wrapWorkspace(workspace);
}

export async function loadThaloFilesFromFileSystem(
  fs: IFileSystem,
  files: string[],
  options: NodeLoadFilesFromFileSystemOptions = {},
): Promise<ThaloWorkspaceInterface> {
  const workspace = await loadWorkspaceFilesFromFileSystem(
    fs,
    files,
    withNodeWorkspaceFactory(options),
  );
  return wrapWorkspace(workspace);
}
