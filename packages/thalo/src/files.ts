/**
 * Node.js-only file utilities for loading Thalo workspaces.
 *
 * This module provides helpers for discovering and loading .thalo and .md files.
 * It should only be used in Node.js environments (CLI, scripts, GitHub Actions).
 *
 * @module @rejot-dev/thalo/files
 */

import path from "node:path";
import { createInitializedWorkspace } from "./parser.node.js";
import type { Workspace } from "./model/workspace.js";
import {
  DEFAULT_WORKSPACE_EXTENSIONS,
  collectThaloFilesFromFileSystem,
  loadWorkspaceFilesFromFileSystem,
  loadWorkspaceFromFileSystem,
  shouldIgnoreWorkspacePath,
} from "./vfs/loader.js";
import { createNodeHostFileSystem } from "./vfs/node-host-fs.js";

/**
 * Default file extensions for thalo files.
 */
export const DEFAULT_EXTENSIONS = DEFAULT_WORKSPACE_EXTENSIONS;

function createNodeFileSystem(root: string | string[]) {
  return createNodeHostFileSystem(root);
}

export function shouldIgnoreWorkspaceRelativePath(relativePath: string): boolean {
  return shouldIgnoreWorkspacePath(relativePath.replaceAll(path.sep, "/"));
}

/**
 * Collect all thalo files from a directory recursively.
 *
 * Skips hidden files/directories (starting with .) and node_modules.
 *
 * @param dir - Directory to search
 * @param extensions - File extensions to include (default: .thalo, .md)
 * @returns Array of absolute file paths
 */
export async function collectThaloFiles(
  dir: string,
  extensions: string[] = DEFAULT_EXTENSIONS,
): Promise<string[]> {
  const resolvedDir = path.resolve(dir);
  const fs = createNodeFileSystem(resolvedDir);
  return await collectThaloFilesFromFileSystem(fs, resolvedDir, { extensions });
}

/**
 * Load a workspace from a directory.
 *
 * Discovers all .thalo and .md files in the directory and loads them
 * into a new Workspace instance.
 *
 * This initializes the Node parser on demand, using the native parser when
 * available and falling back to WASM otherwise.
 *
 * @param cwd - Working directory to load files from
 * @param extensions - File extensions to include (default: .thalo, .md)
 * @returns The loaded workspace
 * @throws Error if directory doesn't exist or no files found
 *
 * @example
 * ```typescript
 * import { loadWorkspaceFromDirectory } from "@rejot-dev/thalo/files";
 *
 * const workspace = await loadWorkspaceFromDirectory("./my-thalo-project");
 * ```
 */
export async function loadWorkspaceFromDirectory(
  cwd: string,
  extensions: string[] = DEFAULT_EXTENSIONS,
): Promise<Workspace> {
  const resolvedCwd = path.resolve(cwd);
  const fs = createNodeFileSystem(resolvedCwd);
  return await loadWorkspaceFromFileSystem(fs, resolvedCwd, {
    createWorkspace: createInitializedWorkspace,
    extensions,
  });
}

/**
 * Load a workspace from specific files.
 *
 * @param files - Array of file paths to load
 * @returns The loaded workspace
 *
 * @example
 * ```typescript
 * import { loadWorkspaceFromFiles } from "@rejot-dev/thalo/files";
 *
 * const workspace = await loadWorkspaceFromFiles([
 *   "./entries.thalo",
 *   "./syntheses.thalo",
 * ]);
 * ```
 */
export async function loadWorkspaceFromFiles(files: string[]): Promise<Workspace> {
  const resolvedFiles = files.map((file) => path.resolve(file));
  if (resolvedFiles.length === 0) {
    return await createInitializedWorkspace();
  }

  const fs = createNodeFileSystem(resolvedFiles.map((file) => path.dirname(file)));
  return await loadWorkspaceFilesFromFileSystem(fs, resolvedFiles, {
    createWorkspace: createInitializedWorkspace,
  });
}
