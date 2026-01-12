"use client";

/**
 * Thalo Runner - Executes thalo commands on playground content.
 *
 * Uses the shared Workspace and command layer from @rejot-dev/thalo
 * with the web-tree-sitter parser.
 */

import { Workspace } from "@rejot-dev/thalo";
import { runCheck as runCheckCommand, type CheckResult } from "@rejot-dev/thalo/commands/check";
import { runQuery as runQueryCommand, type QueryResult } from "@rejot-dev/thalo/commands/query";
import {
  runActualize as runActualizeCommand,
  type ActualizeResult,
} from "@rejot-dev/thalo/commands/actualize";
import { getParser } from "@/lib/thalo-parser.client";

// Virtual filenames for the playground
const FILES = {
  entities: "entities.thalo",
  entries: "entries.thalo",
  synthesis: "syntheses.thalo",
} as const;

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

export interface PlaygroundContent {
  entities: string;
  entries: string;
  synthesis: string;
}

// ===================
// Workspace Creation
// ===================

/**
 * Create a workspace with the web parser and add playground documents.
 */
async function createPlaygroundWorkspace(content: PlaygroundContent): Promise<Workspace> {
  const parser = await getParser();
  const workspace = new Workspace(parser);

  // Add all documents
  if (content.entities.trim()) {
    workspace.addDocument(content.entities, { filename: FILES.entities });
  }
  if (content.entries.trim()) {
    workspace.addDocument(content.entries, { filename: FILES.entries });
  }
  if (content.synthesis.trim()) {
    workspace.addDocument(content.synthesis, { filename: FILES.synthesis });
  }

  return workspace;
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

async function runCheck(content: PlaygroundContent): Promise<CommandResult> {
  const workspace = await createPlaygroundWorkspace(content);
  const result = runCheckCommand(workspace);
  return {
    command: "thalo check",
    lines: formatCheckResult(result),
  };
}

async function runQuery(content: PlaygroundContent, queryStr?: string): Promise<CommandResult> {
  const workspace = await createPlaygroundWorkspace(content);

  // Default query if none provided
  const query = queryStr || "opinion";

  const result = runQueryCommand(workspace, query);

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

  return {
    command: `thalo query '${result.queryString}'`,
    lines: formatQueryResultLines(result),
  };
}

async function runActualize(content: PlaygroundContent): Promise<CommandResult> {
  const workspace = await createPlaygroundWorkspace(content);
  const result = runActualizeCommand(workspace);
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
  content: PlaygroundContent,
  queryStr?: string,
): Promise<CommandResult> {
  switch (command) {
    case "check":
      return runCheck(content);
    case "query":
      return runQuery(content, queryStr);
    case "actualize":
      return runActualize(content);
  }
}
