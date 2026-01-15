/**
 * Node.js-only file utilities for loading Thalo workspaces.
 *
 * This module provides helpers for discovering and loading .thalo and .md files.
 * It should only be used in Node.js environments (CLI, scripts, GitHub Actions).
 *
 * @module @rejot-dev/thalo/files
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createWorkspace, type Workspace } from "./parser.native.js";

/**
 * Default file extensions for thalo files.
 */
export const DEFAULT_EXTENSIONS = [".thalo", ".md"];

/**
 * Collect all thalo files from a directory recursively.
 *
 * Skips hidden directories (starting with .) and node_modules.
 *
 * @param dir - Directory to search
 * @param extensions - File extensions to include (default: .thalo, .md)
 * @returns Array of absolute file paths
 */
export async function collectThaloFiles(
  dir: string,
  extensions: string[] = DEFAULT_EXTENSIONS,
): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (extensions.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Load a workspace from a directory.
 *
 * Discovers all .thalo and .md files in the directory and loads them
 * into a new Workspace instance.
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
  const resolvedCwd = resolve(cwd);

  // Check if directory exists
  try {
    const dirStat = await stat(resolvedCwd);
    if (!dirStat.isDirectory()) {
      throw new Error(`Path is not a directory: ${cwd}`);
    }
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      throw new Error(`Directory not found: ${cwd}`);
    }
    throw err;
  }

  // Collect all thalo files
  const files = await collectThaloFiles(resolvedCwd, extensions);

  if (files.length === 0) {
    throw new Error(`No ${extensions.join(" or ")} files found in ${cwd}`);
  }

  // Create workspace and add documents
  const workspace = createWorkspace();

  for (const file of files) {
    const source = await readFile(file, "utf-8");
    workspace.addDocument(source, { filename: file });
  }

  return workspace;
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
  const workspace = createWorkspace();

  for (const file of files) {
    const resolvedPath = resolve(file);
    const source = await readFile(resolvedPath, "utf-8");
    workspace.addDocument(source, { filename: resolvedPath });
  }

  return workspace;
}
