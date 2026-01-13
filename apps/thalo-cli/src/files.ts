/**
 * Centralized file collection and workspace utilities for CLI commands.
 */

import * as fs from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import { join, resolve } from "node:path";
import pc from "picocolors";
import { createWorkspace, type Workspace } from "@rejot-dev/thalo/native";

/**
 * Default file extensions for thalo files.
 */
export const DEFAULT_EXTENSIONS = [".thalo", ".md"];

/**
 * Default file types (without leading dot).
 */
export const DEFAULT_FILE_TYPES = ["thalo", "md"];

/**
 * Get relative path from current working directory.
 */
export function relativePath(filePath: string): string {
  const cwd = process.cwd();
  const resolvedCwd = path.resolve(cwd);
  const resolvedFilePath = path.resolve(filePath);
  const rel = path.relative(resolvedCwd, resolvedFilePath);
  return rel || filePath;
}

// ===================
// Synchronous versions (for check, actualize)
// ===================

/**
 * Collect all thalo files from a directory (sync).
 */
export function collectThaloFilesSync(
  dir: string,
  extensions: string[] = DEFAULT_EXTENSIONS,
): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (extensions.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Resolve file paths from command arguments (sync).
 * Supports both file types with leading dot ([".md", ".thalo"]) or without (["md", "thalo"]).
 */
export function resolveFilesSync(
  paths: string[],
  fileTypes: string[] = DEFAULT_FILE_TYPES,
): string[] {
  const files: string[] = [];
  // Normalize to extensions with leading dot
  const extensions = fileTypes.map((type) => (type.startsWith(".") ? type : `.${type}`));

  for (const targetPath of paths) {
    const resolved = path.resolve(targetPath);

    if (!fs.existsSync(resolved)) {
      console.error(pc.red(`Error: Path not found: ${targetPath}`));
      process.exit(2);
    }

    const fileStat = fs.statSync(resolved);
    if (fileStat.isDirectory()) {
      files.push(...collectThaloFilesSync(resolved, extensions));
    } else if (fileStat.isFile()) {
      // Accept file if extension matches or if no filtering is needed
      if (extensions.some((ext) => resolved.endsWith(ext))) {
        files.push(resolved);
      }
    }
  }

  return files;
}

/**
 * Load workspace from files (sync).
 */
export function loadWorkspaceSync(files: string[]): Workspace {
  const workspace = createWorkspace();

  for (const file of files) {
    try {
      const source = fs.readFileSync(file, "utf-8");
      workspace.addDocument(source, { filename: file });
    } catch (err) {
      console.error(pc.red(`Error reading ${file}: ${err instanceof Error ? err.message : err}`));
    }
  }

  return workspace;
}

// ===================
// Async versions (for query, format)
// ===================

/**
 * Collect all thalo files from a directory (async).
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
 * Resolve file paths from command arguments (async).
 * Supports both file types with leading dot ([".md", ".thalo"]) or without (["md", "thalo"]).
 */
export async function resolveFiles(
  paths: string[],
  fileTypes: string[] = DEFAULT_FILE_TYPES,
): Promise<string[]> {
  const files: string[] = [];
  // Normalize to extensions with leading dot
  const extensions = fileTypes.map((type) => (type.startsWith(".") ? type : `.${type}`));

  for (const targetPath of paths) {
    const resolved = resolve(targetPath);

    let fileStat;
    try {
      fileStat = await stat(resolved);
    } catch {
      console.error(pc.red(`Error: Path not found: ${targetPath}`));
      process.exit(2);
    }

    if (fileStat.isDirectory()) {
      files.push(...(await collectThaloFiles(resolved, extensions)));
    } else if (fileStat.isFile()) {
      // Accept file if extension matches
      if (extensions.some((ext) => resolved.endsWith(ext))) {
        files.push(resolved);
      }
    }
  }

  return files;
}

/**
 * Load workspace from files (async).
 */
export async function loadWorkspace(files: string[]): Promise<Workspace> {
  const workspace = createWorkspace();

  for (const file of files) {
    try {
      const source = await readFile(file, "utf-8");
      workspace.addDocument(source, { filename: file });
    } catch (err) {
      console.error(pc.red(`Error reading ${file}: ${err instanceof Error ? err.message : err}`));
    }
  }

  return workspace;
}

/**
 * Load the full workspace from the current working directory (async).
 * This is the standard way to load a workspace - always includes all files from CWD.
 */
export async function loadFullWorkspace(
  fileTypes: string[] = DEFAULT_FILE_TYPES,
): Promise<{ workspace: Workspace; files: string[] }> {
  const files = await resolveFiles(["."], fileTypes);
  const workspace = await loadWorkspace(files);
  return { workspace, files };
}
