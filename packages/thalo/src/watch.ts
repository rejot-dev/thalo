import { readFile, stat } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_EXTENSIONS } from "./files.js";
import type { ThaloWorkspaceInterface, WorkspaceWatchOptions, WorkspaceWatchEvent } from "./api.js";
import type { Entry } from "./ast/ast-types.js";
import { getEntryIdentity, serializeIdentity } from "./merge/entry-matcher.js";

type EntrySnapshot = {
  hash: string;
  entry: ReturnType<ThaloWorkspaceInterface["entriesInFile"]>[number];
};

function normalizeExtensions(extensions?: string[]): string[] {
  const normalized = (extensions && extensions.length > 0 ? extensions : DEFAULT_EXTENSIONS).map(
    (ext) => (ext.startsWith(".") ? ext : `.${ext}`),
  );
  return Array.from(new Set(normalized));
}

function isWatchedFile(file: string, extensions: string[]): boolean {
  return extensions.some((ext) => file.endsWith(ext));
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

  const wrapped = workspace.entriesInFile(file);
  const snapshot = new Map<string, EntrySnapshot>();

  model.ast.entries.forEach((entry, index) => {
    const wrappedEntry = wrapped[index];
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

  const partsList = pathsList.map((p) => path.resolve(p).split(path.sep));
  const shortest = partsList.reduce((acc, cur) => (cur.length < acc.length ? cur : acc));

  const common: string[] = [];
  for (let i = 0; i < shortest.length; i += 1) {
    const segment = shortest[i];
    if (partsList.every((parts) => parts[i] === segment)) {
      common.push(segment);
    } else {
      break;
    }
  }

  if (common.length === 0) {
    return null;
  }

  return common.join(path.sep) || path.parse(pathsList[0]).root;
}

export function watchWorkspace(
  workspace: ThaloWorkspaceInterface,
  options: WorkspaceWatchOptions = {},
): AsyncIterable<WorkspaceWatchEvent> {
  const extensions = normalizeExtensions(options.extensions);
  const debounceMs = options.debounceMs ?? 100;
  const includeExisting = options.includeExisting ?? false;
  const signal = options.signal;

  const files = workspace.files().filter((file) => isWatchedFile(file, extensions));
  if (files.length === 0) {
    throw new Error("workspace.watch() requires a workspace with at least one file.");
  }

  const fileSnapshots = new Map<string, Map<string, EntrySnapshot>>();
  const knownFiles = new Set<string>();

  for (const file of files) {
    knownFiles.add(file);
    fileSnapshots.set(file, buildSnapshotForFile(workspace, file));
  }

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
    } else {
      eventQueue.push(event);
    }
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
    const added = workspace.entries();
    if (added.length === 0) {
      return;
    }
    pushEvent({
      added,
      updated: [],
      removed: [],
      files: workspace.files(),
    });
  };

  const processPending = async (): Promise<void> => {
    if (pendingFiles.size === 0) {
      return;
    }

    const changedFiles = Array.from(pendingFiles);
    pendingFiles.clear();

    const added: WorkspaceWatchEvent["added"] = [];
    const updated: WorkspaceWatchEvent["updated"] = [];
    const removed: WorkspaceWatchEvent["removed"] = [];
    const touchedFiles: string[] = [];

    for (const file of changedFiles) {
      if (!isWatchedFile(file, extensions)) {
        continue;
      }

      let exists = true;
      try {
        await stat(file);
      } catch {
        exists = false;
      }

      const previousSnapshot = fileSnapshots.get(file) ?? new Map();

      if (!exists) {
        if (knownFiles.has(file)) {
          knownFiles.delete(file);
          fileSnapshots.delete(file);
          workspace._internal.removeDocument(file);
          for (const snap of previousSnapshot.values()) {
            removed.push(snap.entry);
          }
          touchedFiles.push(file);
        }
        continue;
      }

      const source = await readFile(file, "utf-8");
      workspace._internal.updateDocument(file, source);
      knownFiles.add(file);
      const nextSnapshot = buildSnapshotForFile(workspace, file);
      fileSnapshots.set(file, nextSnapshot);

      for (const [identity, next] of nextSnapshot) {
        const prev = previousSnapshot.get(identity);
        if (!prev) {
          added.push(next.entry);
        } else if (prev.hash !== next.hash) {
          updated.push(next.entry);
        }
      }

      for (const [identity, prev] of previousSnapshot) {
        if (!nextSnapshot.has(identity)) {
          removed.push(prev.entry);
        }
      }

      touchedFiles.push(file);
    }

    if (added.length > 0 || updated.length > 0 || removed.length > 0) {
      pushEvent({
        added,
        updated,
        removed,
        files: touchedFiles,
      });
    }
  };

  const scheduleProcess = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      processPending().catch(() => {
        // Intentionally ignore watcher errors to keep stream alive.
      });
    }, debounceMs);
  };

  let root = findCommonRoot(files);
  if (root && files.includes(root)) {
    root = path.dirname(root);
  }
  const rootIsFilesystemRoot = root ? root === path.parse(root).root : false;
  const watchDirs =
    root && !rootIsFilesystemRoot
      ? [root]
      : Array.from(new Set(files.map((file) => path.dirname(file))));

  for (const dir of watchDirs) {
    const watcher = fs.watch(dir, { recursive: true }, (_eventType, filename) => {
      if (!filename) {
        return;
      }
      const resolved = path.isAbsolute(filename) ? filename : path.resolve(dir, filename);
      if (!isWatchedFile(resolved, extensions)) {
        return;
      }
      pendingFiles.add(resolved);
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
