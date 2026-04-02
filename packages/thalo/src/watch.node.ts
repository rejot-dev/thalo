import { stat } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { createNodeHostFileSystem } from "./vfs/node-host-fs.js";
import type { ThaloWorkspaceInterface, WorkspaceWatchOptions, WorkspaceWatchEvent } from "./api.js";
import type { Entry } from "./ast/ast-types.js";
import { getEntryIdentity, serializeIdentity } from "./merge/entry-matcher.js";
import { DEFAULT_WORKSPACE_EXTENSIONS } from "./vfs/loader.js";
import { applyWorkspaceFileChange } from "./vfs/sync.js";

type EntrySnapshot = {
  hash: string;
  entry: ReturnType<ThaloWorkspaceInterface["entriesInFile"]>[number];
};

function normalizeExtensions(extensions?: string[]): string[] {
  const normalized =
    extensions && extensions.length > 0 ? extensions : DEFAULT_WORKSPACE_EXTENSIONS;
  return Array.from(new Set(normalized)).map((extension) =>
    extension.startsWith(".") ? extension : `.${extension}`,
  );
}

function isWatchedFile(file: string, extensions: string[]): boolean {
  return extensions.some((extension) => file.endsWith(extension));
}

function isIgnoredWorkspaceSegment(segment: string): boolean {
  return segment === "node_modules" || segment.startsWith(".");
}

function isIgnoredWatchedPath(file: string, roots: string[]): boolean {
  for (const root of roots) {
    const relativePath = path.relative(root, file);
    if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      continue;
    }

    if (relativePath.split(path.sep).filter(Boolean).some(isIgnoredWorkspaceSegment)) {
      return true;
    }
  }

  return false;
}

function stripForComparison(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripForComparison);
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "syntaxNode" || key === "location") {
        continue;
      }
      result[key] = stripForComparison(value);
    }
    return result;
  }
  return obj;
}

function hashEntry(entry: Entry): string {
  return JSON.stringify(stripForComparison(entry));
}

function buildSnapshotForFile(
  workspace: ThaloWorkspaceInterface,
  file: string,
): Map<string, EntrySnapshot> {
  const model = workspace._internal.getModel(file);
  if (!model) {
    return new Map();
  }

  const wrappedEntries = workspace.entriesInFile(file);
  const snapshot = new Map<string, EntrySnapshot>();

  model.ast.entries.forEach((entry, index) => {
    const wrappedEntry = wrappedEntries[index];
    if (!wrappedEntry) {
      return;
    }

    const identity = serializeIdentity(getEntryIdentity(entry));
    snapshot.set(identity, {
      hash: hashEntry(entry),
      entry: wrappedEntry,
    });
  });

  return snapshot;
}

function findCommonRoot(pathsList: string[]): string | null {
  if (pathsList.length === 0) {
    return null;
  }

  const partsList = pathsList.map((item) => path.resolve(item).split(path.sep));
  const shortest = partsList.reduce((currentShortest, current) =>
    current.length < currentShortest.length ? current : currentShortest,
  );

  const common: string[] = [];
  for (let index = 0; index < shortest.length; index += 1) {
    const segment = shortest[index];
    if (partsList.every((parts) => parts[index] === segment)) {
      common.push(segment);
      continue;
    }
    break;
  }

  if (common.length === 0) {
    return null;
  }

  return common.join(path.sep) || path.parse(pathsList[0]).root;
}

function createWatchFileSystem(files: string[]) {
  const sampleFile = files[0] ?? path.resolve(process.cwd());
  const commonRoot =
    findCommonRoot(files.map((file) => path.dirname(file))) ??
    path.dirname(path.resolve(sampleFile));
  return createNodeHostFileSystem(commonRoot);
}

export function watchWorkspace(
  workspace: ThaloWorkspaceInterface,
  options: WorkspaceWatchOptions = {},
): AsyncIterable<WorkspaceWatchEvent> {
  const extensions = normalizeExtensions(options.extensions);
  const debounceMs = options.debounceMs ?? 100;
  const includeExisting = options.includeExisting ?? false;
  const signal = options.signal;

  const watchedFiles = workspace.files().filter((file) => isWatchedFile(file, extensions));
  if (watchedFiles.length === 0) {
    throw new Error("workspace.watch() requires a workspace with at least one file.");
  }

  const watchedFileSet = new Set(watchedFiles);
  const nodeFs = createWatchFileSystem(watchedFiles);
  const fileSnapshots = new Map<string, Map<string, EntrySnapshot>>();
  const knownFiles = new Set<string>();

  for (const file of watchedFiles) {
    knownFiles.add(file);
    fileSnapshots.set(file, buildSnapshotForFile(workspace, file));
  }

  let root = findCommonRoot(watchedFiles);
  if (root && watchedFiles.includes(root)) {
    root = path.dirname(root);
  }
  const rootIsFilesystemRoot = root ? root === path.parse(root).root : false;
  const watchDirs =
    root && !rootIsFilesystemRoot
      ? [root]
      : Array.from(new Set(watchedFiles.map((file) => path.dirname(file))));

  const eventQueue: WorkspaceWatchEvent[] = [];
  let pendingResolve: ((event: WorkspaceWatchEvent | null) => void) | null = null;
  let closed = false;

  const pushEvent = (event: WorkspaceWatchEvent): void => {
    if (closed) {
      return;
    }

    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve(event);
      return;
    }

    eventQueue.push(event);
  };

  const closeQueue = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve(null);
    }
  };

  const watchers: fs.FSWatcher[] = [];
  let debounceTimer: NodeJS.Timeout | null = null;
  const pendingFiles = new Set<string>();

  const emitExisting = (): void => {
    if (!includeExisting) {
      return;
    }

    const added = workspace.entries().filter((entry) => watchedFileSet.has(entry.file));
    if (added.length === 0) {
      return;
    }

    pushEvent({
      added,
      updated: [],
      removed: [],
      files: watchedFiles,
    });
  };

  const processPending = async (): Promise<void> => {
    if (pendingFiles.size === 0) {
      return;
    }

    const changedFiles = Array.from(pendingFiles);
    const added: WorkspaceWatchEvent["added"] = [];
    const updated: WorkspaceWatchEvent["updated"] = [];
    const removed: WorkspaceWatchEvent["removed"] = [];
    const touchedFiles: string[] = [];
    let shouldRetry = false;

    for (const file of changedFiles) {
      if (!isWatchedFile(file, extensions)) {
        pendingFiles.delete(file);
        continue;
      }
      if (!knownFiles.has(file) && isIgnoredWatchedPath(file, watchDirs)) {
        pendingFiles.delete(file);
        continue;
      }

      try {
        let exists = true;
        try {
          await stat(file);
        } catch {
          exists = false;
        }

        const previousSnapshot = fileSnapshots.get(file) ?? new Map();
        const changeKind = exists ? (knownFiles.has(file) ? "updated" : "created") : "deleted";

        await applyWorkspaceFileChange(workspace._internal, nodeFs, {
          path: file,
          kind: changeKind,
        });

        if (changeKind === "deleted") {
          knownFiles.delete(file);
          fileSnapshots.delete(file);
          for (const snapshot of previousSnapshot.values()) {
            removed.push(snapshot.entry);
          }
          touchedFiles.push(file);
          pendingFiles.delete(file);
          continue;
        }

        knownFiles.add(file);
        const nextSnapshot = buildSnapshotForFile(workspace, file);
        fileSnapshots.set(file, nextSnapshot);

        for (const [identity, next] of nextSnapshot) {
          const previous = previousSnapshot.get(identity);
          if (!previous) {
            added.push(next.entry);
          } else if (previous.hash !== next.hash) {
            updated.push(next.entry);
          }
        }

        for (const [identity, previous] of previousSnapshot) {
          if (!nextSnapshot.has(identity)) {
            removed.push(previous.entry);
          }
        }

        touchedFiles.push(file);
        pendingFiles.delete(file);
      } catch (error) {
        shouldRetry = true;
        console.error(`[thalo] Failed to process workspace change for ${file}:`, error);
      }
    }

    if (added.length > 0 || updated.length > 0 || removed.length > 0) {
      pushEvent({
        added,
        updated,
        removed,
        files: touchedFiles,
      });
    }

    if (!closed && shouldRetry && pendingFiles.size > 0) {
      scheduleProcess();
    }
  };

  const scheduleProcess = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      void processPending().catch((error) => {
        console.error("[thalo] Workspace watch processing failed:", error);
      });
    }, debounceMs);
  };

  for (const directory of watchDirs) {
    const watcher = fs.watch(directory, { recursive: true }, (_eventType, filename) => {
      if (!filename) {
        return;
      }

      const resolvedFile = path.isAbsolute(filename)
        ? filename
        : path.resolve(directory, filename.toString());

      if (!isWatchedFile(resolvedFile, extensions)) {
        return;
      }
      if (!knownFiles.has(resolvedFile) && isIgnoredWatchedPath(resolvedFile, watchDirs)) {
        return;
      }

      pendingFiles.add(resolvedFile);
      scheduleProcess();
    });
    watchers.push(watcher);
  }

  const cleanup = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    for (const watcher of watchers) {
      watcher.close();
    }

    if (signal) {
      signal.removeEventListener("abort", closeQueueWithCleanup);
    }
  };

  const closeQueueWithCleanup = (): void => {
    cleanup();
    closeQueue();
  };

  if (signal) {
    if (signal.aborted) {
      closeQueueWithCleanup();
    } else {
      signal.addEventListener("abort", closeQueueWithCleanup, { once: true });
    }
  }

  emitExisting();

  const iterator: AsyncIterable<WorkspaceWatchEvent> = {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (eventQueue.length > 0) {
            return { value: eventQueue.shift()!, done: false };
          }
          if (closed) {
            return { value: undefined, done: true };
          }

          const event = await new Promise<WorkspaceWatchEvent | null>((resolve) => {
            pendingResolve = resolve;
          });

          if (!event) {
            return { value: undefined, done: true };
          }

          return { value: event, done: false };
        },
        async return() {
          closeQueue();
          return { value: undefined, done: true };
        },
      };
    },
  };

  return {
    [Symbol.asyncIterator]() {
      const baseIterator = iterator[Symbol.asyncIterator]();
      return {
        async next() {
          return baseIterator.next();
        },
        async return() {
          closeQueueWithCleanup();
          return { value: undefined, done: true };
        },
      };
    },
  };
}
