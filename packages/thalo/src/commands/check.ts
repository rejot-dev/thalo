/**
 * Check command - runs the checker on a workspace and returns structured results.
 */

import type { Workspace } from "../model/workspace.js";
import { check } from "../checker/check.js";
import type { CheckConfig, Diagnostic } from "../checker/types.js";

// ===================
// Types
// ===================

/**
 * Severity levels for diagnostics
 */
export type DiagnosticSeverity = "error" | "warning" | "info";

/**
 * A single diagnostic (error, warning, or info) from the checker.
 */
export interface DiagnosticInfo {
  /** File path where the diagnostic occurred */
  file: string;
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
  /** End line (1-based) */
  endLine: number;
  /** End column (1-based) */
  endColumn: number;
  /** Severity level */
  severity: DiagnosticSeverity;
  /** Rule code (e.g., "unknown-entity", "missing-title") */
  code: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Result of running the check command.
 */
export interface CheckResult {
  /** Number of files that were checked */
  filesChecked: number;
  /** Diagnostics grouped by file path */
  diagnosticsByFile: Map<string, DiagnosticInfo[]>;
  /** Total number of errors */
  errorCount: number;
  /** Total number of warnings */
  warningCount: number;
  /** Total number of info messages */
  infoCount: number;
}

/**
 * Options for running the check command.
 */
export interface RunCheckOptions {
  /** Checker configuration (rule overrides, etc.) */
  config?: CheckConfig;
  /** Minimum severity to include (default: "info") */
  minSeverity?: DiagnosticSeverity;
}

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

/**
 * Convert a diagnostic to DiagnosticInfo.
 */
function toDiagnosticInfo(diagnostic: Diagnostic): DiagnosticInfo {
  return {
    file: diagnostic.file,
    line: diagnostic.location.startPosition.row + 1,
    column: diagnostic.location.startPosition.column + 1,
    endLine: diagnostic.location.endPosition.row + 1,
    endColumn: diagnostic.location.endPosition.column + 1,
    severity: diagnostic.severity as DiagnosticSeverity,
    code: diagnostic.code,
    message: diagnostic.message,
  };
}

/**
 * Run the check command on a workspace.
 *
 * @param workspace - The workspace to check
 * @param options - Check options
 * @returns Structured check results
 */
export function runCheck(workspace: Workspace, options: RunCheckOptions = {}): CheckResult {
  const { config = {}, minSeverity = "info" } = options;

  // Run the checker
  const diagnostics = check(workspace, config);

  // Filter by minimum severity
  const minSeverityOrder = SEVERITY_ORDER[minSeverity];
  const filteredDiagnostics = diagnostics.filter(
    (d) => SEVERITY_ORDER[d.severity as DiagnosticSeverity] <= minSeverityOrder,
  );

  // Sort diagnostics by file, then position
  filteredDiagnostics.sort((a, b) => {
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }
    if (a.location.startPosition.row !== b.location.startPosition.row) {
      return a.location.startPosition.row - b.location.startPosition.row;
    }
    return a.location.startPosition.column - b.location.startPosition.column;
  });

  // Group by file
  const diagnosticsByFile = new Map<string, DiagnosticInfo[]>();
  for (const d of filteredDiagnostics) {
    const existing = diagnosticsByFile.get(d.file) || [];
    existing.push(toDiagnosticInfo(d));
    diagnosticsByFile.set(d.file, existing);
  }

  // Count by severity
  const errorCount = filteredDiagnostics.filter((d) => d.severity === "error").length;
  const warningCount = filteredDiagnostics.filter((d) => d.severity === "warning").length;
  const infoCount = filteredDiagnostics.filter((d) => d.severity === "info").length;

  return {
    filesChecked: workspace.files().length,
    diagnosticsByFile,
    errorCount,
    warningCount,
    infoCount,
  };
}
