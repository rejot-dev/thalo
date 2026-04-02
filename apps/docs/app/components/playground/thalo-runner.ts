"use client";

/**
 * Thalo Runner - Executes thalo commands on playground content.
 *
 * Uses the shared Workspace and command layer from @rejot-dev/thalo
 * with the web-tree-sitter parser.
 */

import { Workspace } from "@rejot-dev/thalo";
import { runCheck as runCheckCommand, type CheckResult } from "@rejot-dev/thalo/commands/check";
import {
  runQuery as runQueryCommand,
  isQueryValidationError,
  isCheckpointError,
  type QueryResult,
} from "@rejot-dev/thalo/commands/query";
import {
  runActualize as runActualizeCommand,
  type ActualizeResult,
} from "@rejot-dev/thalo/commands/actualize";
import {
  applyWorkspaceFileChange,
  loadWorkspaceFilesFromFileSystem,
  type WorkspaceFileChange,
} from "@rejot-dev/thalo/vfs";
import { getParser } from "@/lib/thalo-parser.client";
import type { InMemorySnapshot } from "./in-memory-fs";

// ===================
// Types
// ===================

export type CommandType = "check" | "query" | "actualize";

export interface TerminalLine {
  type: "header" | "info" | "error" | "warning" | "success" | "dim" | "entry" | "prompt" | "blank";
  text: string;
}

export interface CommandResult {
  command: string;
  lines: TerminalLine[];
}

// ===================
// Workspace Creation
// ===================

async function readSnapshotContents(input: InMemorySnapshot): Promise<Map<string, string>> {
  const entries = await Promise.all(
    input.filePaths.map(
      async (path) => [path, await input.fileSystem.readFile(path, "utf8")] as const,
    ),
  );

  return new Map(entries);
}

class PlaygroundWorkspaceRuntime {
  private workspace: Workspace | null = null;
  private syncedFiles = new Map<string, string>();

  async getWorkspace(input: InMemorySnapshot): Promise<Workspace> {
    const currentFiles = await readSnapshotContents(input);

    if (!this.workspace) {
      return this.initializeWorkspace(input, currentFiles);
    }

    try {
      await this.syncWorkspace(input, currentFiles);
      return this.workspace;
    } catch {
      return this.initializeWorkspace(input, currentFiles);
    }
  }

  private async initializeWorkspace(
    input: InMemorySnapshot,
    currentFiles: Map<string, string>,
  ): Promise<Workspace> {
    const parser = await getParser();
    const workspace = new Workspace(parser);

    if (input.filePaths.length > 0) {
      await loadWorkspaceFilesFromFileSystem(input.fileSystem, input.filePaths, {
        workspace,
      });
    }

    this.workspace = workspace;
    this.syncedFiles = currentFiles;
    return workspace;
  }

  private async syncWorkspace(
    input: InMemorySnapshot,
    currentFiles: Map<string, string>,
  ): Promise<void> {
    if (!this.workspace) {
      return;
    }

    const changes: WorkspaceFileChange[] = [];

    for (const path of this.syncedFiles.keys()) {
      if (!currentFiles.has(path)) {
        changes.push({ path, kind: "deleted" });
      }
    }

    for (const [path, content] of currentFiles) {
      const previousContent = this.syncedFiles.get(path);

      if (previousContent === undefined) {
        changes.push({ path, kind: "created" });
        continue;
      }

      if (previousContent !== content) {
        changes.push({ path, kind: "updated" });
      }
    }

    for (const change of changes) {
      await applyWorkspaceFileChange(this.workspace, input.fileSystem, change);
    }

    this.syncedFiles = currentFiles;
  }
}

const runtime = new PlaygroundWorkspaceRuntime();

/**
 * Reuse a long-lived workspace and incrementally sync editor changes into it.
 */
async function createPlaygroundWorkspace(input: InMemorySnapshot): Promise<Workspace> {
  return runtime.getWorkspace(input);
}

// ===================
// Result Formatting
// ===================

/**
 * Format check results into terminal lines.
 */
function formatCheckResult(result: CheckResult): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push({ type: "header", text: "=== Running check ===" });
  lines.push({ type: "blank", text: "" });

  const totalDiagnostics = result.errorCount + result.warningCount + result.infoCount;

  if (totalDiagnostics === 0) {
    lines.push({ type: "success", text: "✓ No issues found" });
    lines.push({
      type: "info",
      text: `  ${result.filesChecked} files checked`,
    });
  } else {
    // Group diagnostics by file
    for (const [file, diagnostics] of result.diagnosticsByFile) {
      lines.push({ type: "info", text: file });
      for (const d of diagnostics) {
        const severityColor =
          d.severity === "error" ? "error" : d.severity === "warning" ? "warning" : "info";
        lines.push({
          type: severityColor,
          text: `  ${d.line}:${d.column}  ${d.severity}  ${d.message}  ${d.code}`,
        });
      }
      lines.push({ type: "blank", text: "" });
    }

    // Summary
    const parts: string[] = [];
    if (result.errorCount > 0) {
      parts.push(`${result.errorCount} error${result.errorCount !== 1 ? "s" : ""}`);
    }
    if (result.warningCount > 0) {
      parts.push(`${result.warningCount} warning${result.warningCount !== 1 ? "s" : ""}`);
    }
    if (result.infoCount > 0) {
      parts.push(`${result.infoCount} info`);
    }

    const isError = result.errorCount > 0;
    lines.push({
      type: isError ? "error" : "warning",
      text: `${isError ? "✗" : "⚠"} ${parts.join(", ")}`,
    });
  }

  return lines;
}

/**
 * Format query results into terminal lines.
 */
function formatQueryResultLines(result: QueryResult): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push({ type: "header", text: `=== Query: ${result.queryString} ===` });
  lines.push({ type: "blank", text: "" });
  lines.push({ type: "info", text: `Found: ${result.totalCount} entries` });
  lines.push({ type: "blank", text: "" });

  for (const entry of result.entries) {
    const link = entry.linkId ? ` ^${entry.linkId}` : "";
    const tags = entry.tags.length > 0 ? " " + entry.tags.map((t) => `#${t}`).join(" ") : "";

    lines.push({
      type: "entry",
      text: `${entry.timestamp} ${entry.entity} "${entry.title}"${link}${tags}`,
    });
  }

  if (result.entries.length === 0) {
    lines.push({ type: "dim", text: "No matching entries found." });
  }

  return lines;
}

/**
 * Format actualize results into terminal lines.
 */
function formatActualizeResultLines(result: ActualizeResult): TerminalLine[] {
  const lines: TerminalLine[] = [];

  if (result.syntheses.length === 0) {
    lines.push({ type: "header", text: "=== Running actualize ===" });
    lines.push({ type: "blank", text: "" });
    lines.push({ type: "dim", text: "No synthesis definitions found." });
    return lines;
  }

  for (const synthesis of result.syntheses) {
    lines.push({ type: "header", text: `=== Synthesis: ${synthesis.title} ===` });
    lines.push({ type: "info", text: `Target: ^${synthesis.linkId}` });

    if (synthesis.sources.length > 0) {
      lines.push({ type: "info", text: `Sources: ${synthesis.sources.join(", ")}` });
    }

    lines.push({ type: "blank", text: "" });

    // Show prompt
    if (synthesis.prompt) {
      lines.push({ type: "header", text: "--- User Prompt ---" });
      for (const line of synthesis.prompt.split("\n")) {
        lines.push({ type: "prompt", text: line });
      }
      lines.push({ type: "blank", text: "" });
    }

    // Show matching entries
    if (synthesis.entries.length > 0) {
      lines.push({ type: "header", text: `--- Entries (${synthesis.entries.length}) ---` });
      lines.push({ type: "blank", text: "" });

      for (const entry of synthesis.entries) {
        if (entry.rawText) {
          for (const line of entry.rawText.split("\n")) {
            lines.push({ type: "entry", text: line });
          }
          lines.push({ type: "blank", text: "" });
        }
      }
    } else {
      lines.push({ type: "success", text: "✓ Up to date - no new entries." });
      lines.push({ type: "blank", text: "" });
    }

    // Instructions
    lines.push({ type: "header", text: "--- Instructions ---" });
    lines.push({
      type: "dim",
      text: `1. Update the content directly below the \`\`\`thalo block in ${synthesis.file}`,
    });
    lines.push({ type: "dim", text: `2. Place output BEFORE any subsequent \`\`\`thalo blocks` });
    lines.push({
      type: "dim",
      text: `3. Append to the thalo block: actualize-synthesis ^${synthesis.linkId}`,
    });
    lines.push({ type: "dim", text: `   with metadata: updated: <current-timestamp>` });
  }

  return lines;
}

// ===================
// Command Runners
// ===================

async function runCheck(input: InMemorySnapshot): Promise<CommandResult> {
  const workspace = await createPlaygroundWorkspace(input);
  const result = runCheckCommand(workspace);
  return {
    command: "thalo check",
    lines: formatCheckResult(result),
  };
}

async function runQuery(input: InMemorySnapshot, queryStr?: string): Promise<CommandResult> {
  const workspace = await createPlaygroundWorkspace(input);

  // Default query if none provided
  const query = queryStr || "opinion";

  const result = await runQueryCommand(workspace, query);

  if (!result) {
    return {
      command: `thalo query '${query}'`,
      lines: [
        { type: "header", text: `=== Query: ${query} ===` },
        { type: "blank", text: "" },
        { type: "error", text: "Invalid query syntax" },
      ],
    };
  }

  // Handle validation errors (e.g., unknown entity)
  if (isQueryValidationError(result)) {
    return {
      command: `thalo query '${query}'`,
      lines: [
        { type: "header", text: `=== Query: ${query} ===` },
        { type: "blank", text: "" },
        { type: "error", text: result.message },
      ],
    };
  }

  // Handle checkpoint errors
  if (isCheckpointError(result)) {
    return {
      command: `thalo query '${query}'`,
      lines: [
        { type: "header", text: `=== Query: ${query} ===` },
        { type: "blank", text: "" },
        { type: "error", text: result.message },
      ],
    };
  }

  return {
    command: `thalo query '${result.queryString}'`,
    lines: formatQueryResultLines(result),
  };
}

async function runActualize(input: InMemorySnapshot): Promise<CommandResult> {
  const workspace = await createPlaygroundWorkspace(input);
  const result = await runActualizeCommand(workspace);
  return {
    command: "thalo actualize",
    lines: formatActualizeResultLines(result),
  };
}

// ===================
// Public API
// ===================

export async function runCommand(
  command: CommandType,
  input: InMemorySnapshot,
  queryStr?: string,
): Promise<CommandResult> {
  switch (command) {
    case "check":
      return runCheck(input);
    case "query":
      return runQuery(input, queryStr);
    case "actualize":
      return runActualize(input);
  }
}
