/**
 * Plain-text formatters for command results.
 *
 * These formatters produce plain text output without any colors or styling.
 * CLI tools can add colors on top using libraries like picocolors.
 * Browser environments can use the structured results directly.
 */

import type { CheckResult, DiagnosticInfo } from "./commands/check.js";
import type { QueryResult, QueryEntryInfo } from "./commands/query.js";
import type {
  ActualizeResult,
  SynthesisOutputInfo,
  ActualizeEntryInfo,
} from "./commands/actualize.js";
import type { Timestamp } from "./ast/types.js";
import { isSyntaxError } from "./ast/types.js";

/**
 * Output format style for diagnostics.
 */
export type DiagnosticFormat = "default" | "compact" | "github";

// ===================
// Timestamp Formatting
// ===================

/**
 * Format a timestamp to ISO-like string for comparisons and display.
 * Example: "2026-01-07T12:00Z" or "2026-01-07T12:00+05:30"
 */
export function formatTimestamp(ts: Timestamp): string {
  const date = `${ts.date.year}-${String(ts.date.month).padStart(2, "0")}-${String(ts.date.day).padStart(2, "0")}`;
  const time = `${String(ts.time.hour).padStart(2, "0")}:${String(ts.time.minute).padStart(2, "0")}`;
  const tz = isSyntaxError(ts.timezone) ? "" : ts.timezone.value;
  return `${date}T${time}${tz}`;
}

/**
 * Format a relative path from CWD (if applicable).
 * This is a no-op since we don't have access to process.cwd() in all environments.
 * CLI tools should handle path relativization themselves.
 */
function formatPath(path: string): string {
  return path;
}

// ===================
// Check Formatters
// ===================

/**
 * Format a single diagnostic in default style.
 */
function formatDiagnosticDefault(d: DiagnosticInfo): string {
  const loc = `${d.line}:${d.column}`.padEnd(8);
  const severity = d.severity.padEnd(7);
  return `  ${loc} ${severity} ${d.message}  ${d.code}`;
}

/**
 * Format a single diagnostic in compact style.
 */
function formatDiagnosticCompact(d: DiagnosticInfo): string {
  const loc = `${formatPath(d.file)}:${d.line}:${d.column}`;
  return `${loc}: ${d.severity[0].toUpperCase()} [${d.code}] ${d.message}`;
}

/**
 * Escape a string for use in GitHub Actions annotation property values.
 * Property values require: % → %25, \n → %0A, \r → %0D, : → %3A, , → %2C
 */
function escapeGithubProperty(value: string): string {
  return value
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");
}

/**
 * Escape a string for use in GitHub Actions annotation message.
 * Messages require: % → %25, \n → %0A, \r → %0D
 */
function escapeGithubMessage(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/**
 * Map internal severity to GitHub Actions annotation level.
 * GitHub Actions supports: error, warning, notice (not "info")
 */
function toGithubSeverity(severity: string): string {
  return severity === "info" ? "notice" : severity;
}

/**
 * Format a single diagnostic in GitHub Actions style.
 */
function formatDiagnosticGithub(d: DiagnosticInfo): string {
  const severity = toGithubSeverity(d.severity);
  const file = escapeGithubProperty(d.file);
  const title = escapeGithubProperty(d.code);
  const message = escapeGithubMessage(d.message);

  return `::${severity} file=${file},line=${d.line},col=${d.column},endLine=${d.endLine},endColumn=${d.endColumn},title=${title}::${message}`;
}

/**
 * Format a single diagnostic.
 */
export function formatDiagnostic(d: DiagnosticInfo, format: DiagnosticFormat = "default"): string {
  switch (format) {
    case "compact":
      return formatDiagnosticCompact(d);
    case "github":
      return formatDiagnosticGithub(d);
    default:
      return formatDiagnosticDefault(d);
  }
}

/**
 * Format check results as an array of lines.
 */
export function formatCheckResult(
  result: CheckResult,
  format: DiagnosticFormat = "default",
): string[] {
  const lines: string[] = [];

  if (format === "default") {
    // Group diagnostics by file for cleaner output
    for (const [file, diagnostics] of result.diagnosticsByFile) {
      lines.push("");
      lines.push(formatPath(file));
      for (const d of diagnostics) {
        lines.push(formatDiagnosticDefault(d));
      }
    }
  } else {
    // Flat list for compact/github formats
    for (const [, diagnostics] of result.diagnosticsByFile) {
      for (const d of diagnostics) {
        lines.push(formatDiagnostic(d, format));
      }
    }
  }

  // Summary line (skip for github format)
  if (format !== "github") {
    lines.push("");
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

    const summary = parts.length > 0 ? parts.join(", ") : "no issues";
    lines.push(`${result.filesChecked} files checked, ${summary}`);
  }

  return lines;
}

// ===================
// Query Formatters
// ===================

/**
 * Format a query entry in default style.
 */
function formatQueryEntryDefault(entry: QueryEntryInfo): string[] {
  const lines: string[] = [];

  const link = entry.linkId ? ` ^${entry.linkId}` : "";
  const tags = entry.tags.length > 0 ? " " + entry.tags.map((t) => `#${t}`).join(" ") : "";

  lines.push(`${entry.timestamp} ${entry.entity} ${entry.title}${link}${tags}`);
  lines.push(`  ${formatPath(entry.file)}:${entry.startLine}-${entry.endLine}`);

  return lines;
}

/**
 * Format query results as an array of lines.
 */
export function formatQueryResult(result: QueryResult): string[] {
  const lines: string[] = [];

  lines.push("");
  lines.push(`Query: ${result.queryString}`);
  lines.push(`Found: ${result.totalCount} entries`);

  if (result.entries.length > 0) {
    lines.push("");
    for (const entry of result.entries) {
      lines.push(...formatQueryEntryDefault(entry));
    }
  }

  if (result.entries.length < result.totalCount) {
    lines.push("");
    lines.push(`(showing ${result.entries.length} of ${result.totalCount} results)`);
  }

  lines.push("");

  return lines;
}

/**
 * Format query results in raw format (just the entry source text).
 */
export function formatQueryResultRaw(result: QueryResult): string[] {
  const lines: string[] = [];

  for (const entry of result.entries) {
    if (entry.rawText) {
      lines.push(entry.rawText);
      lines.push("");
    }
  }

  return lines;
}

// ===================
// Actualize Formatters
// ===================

/**
 * Format a synthesis entry for actualize output.
 */
function formatActualizeEntry(entry: ActualizeEntryInfo): string[] {
  return entry.rawText.split("\n");
}

/**
 * Format a single synthesis output.
 */
function formatSynthesisOutput(synthesis: SynthesisOutputInfo): string[] {
  const lines: string[] = [];

  if (synthesis.isUpToDate) {
    lines.push(`✓ ${formatPath(synthesis.file)}: ${synthesis.title} - up to date`);
    return lines;
  }

  lines.push("");
  lines.push(`=== Synthesis: ${synthesis.title} (${formatPath(synthesis.file)}) ===`);
  lines.push(`Target: ^${synthesis.linkId}`);
  lines.push(`Sources: ${synthesis.sources.join(", ")}`);
  if (synthesis.lastUpdated) {
    lines.push(`Last updated: ${synthesis.lastUpdated}`);
  }

  // Output prompt
  lines.push("");
  lines.push("--- User Prompt ---");
  if (synthesis.prompt) {
    lines.push(synthesis.prompt);
  } else {
    lines.push("(no prompt defined)");
  }

  // Output new entries
  lines.push("");
  lines.push(`--- New Entries (${synthesis.entries.length}) ---`);
  for (const entry of synthesis.entries) {
    lines.push("");
    lines.push(...formatActualizeEntry(entry));
  }

  // Output instructions
  lines.push("");
  lines.push("--- Instructions ---");
  lines.push(
    `1. Update the content directly below the \`\`\`thalo block in ${formatPath(synthesis.file)}`,
  );
  lines.push(`2. Place output BEFORE any subsequent \`\`\`thalo blocks`);
  lines.push(`3. Append to the thalo block: actualize-synthesis ^${synthesis.linkId}`);
  lines.push(`   with metadata: updated: <current-timestamp>`);
  lines.push("");
  lines.push("─".repeat(60));

  return lines;
}

/**
 * Format actualize results as an array of lines.
 */
export function formatActualizeResult(result: ActualizeResult): string[] {
  const lines: string[] = [];

  if (result.syntheses.length === 0) {
    lines.push("No synthesis definitions found.");
    return lines;
  }

  let hasOutput = false;

  for (const synthesis of result.syntheses) {
    if (!synthesis.isUpToDate) {
      hasOutput = true;
    }
    lines.push(...formatSynthesisOutput(synthesis));
  }

  if (!hasOutput) {
    lines.push("");
    lines.push("All syntheses are up to date.");
  }

  return lines;
}
