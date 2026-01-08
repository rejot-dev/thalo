import * as fs from "node:fs";
import * as path from "node:path";
import {
  Workspace,
  check,
  type Diagnostic,
  type Severity,
  type CheckConfig,
} from "@rejot-dev/thalo";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";

type SeverityKey = Exclude<Severity, "off">;
type OutputFormat = "default" | "json" | "compact" | "github";

const SEVERITY_ORDER: Record<SeverityKey, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const severityColor = {
  error: pc.red,
  warning: pc.yellow,
  info: pc.cyan,
} as const;

function relativePath(filePath: string): string {
  const cwd = process.cwd();
  if (filePath.startsWith(cwd)) {
    const rel = filePath.slice(cwd.length + 1);
    return rel || filePath;
  }
  return filePath;
}

function formatDiagnosticDefault(diagnostic: Diagnostic): string {
  const { location, severity, code, message } = diagnostic;
  const color = severityColor[severity];

  const line = String(location.startPosition.row + 1);
  const col = String(location.startPosition.column + 1);
  const loc = `${line}:${col}`.padEnd(8);
  const severityLabel = color(severity.padEnd(7));
  const codeLabel = pc.dim(code);

  return `  ${pc.dim(loc)} ${severityLabel} ${message}  ${codeLabel}`;
}

function formatDiagnosticCompact(diagnostic: Diagnostic): string {
  const { file, location, severity, code, message } = diagnostic;
  const rel = relativePath(file);
  const loc = `${rel}:${location.startPosition.row + 1}:${location.startPosition.column + 1}`;
  return `${loc}: ${severity[0].toUpperCase()} [${code}] ${message}`;
}

function formatDiagnosticGithub(diagnostic: Diagnostic): string {
  const { file, location, severity, code, message } = diagnostic;
  const line = location.startPosition.row + 1;
  const col = location.startPosition.column + 1;
  const endLine = location.endPosition.row + 1;
  const endCol = location.endPosition.column + 1;

  return `::${severity} file=${file},line=${line},col=${col},endLine=${endLine},endColumn=${endCol},title=${code}::${message}`;
}

function formatDiagnostic(diagnostic: Diagnostic, format: OutputFormat): string {
  switch (format) {
    case "compact":
      return formatDiagnosticCompact(diagnostic);
    case "github":
      return formatDiagnosticGithub(diagnostic);
    default:
      return formatDiagnosticDefault(diagnostic);
  }
}

function collectThaloFiles(dir: string, extensions: string[] = [".thalo", ".md"]): string[] {
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

function resolveFiles(paths: string[]): string[] {
  const files: string[] = [];

  for (const targetPath of paths) {
    const resolved = path.resolve(targetPath);

    if (!fs.existsSync(resolved)) {
      console.error(pc.red(`Error: Path not found: ${targetPath}`));
      process.exit(2);
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      files.push(...collectThaloFiles(resolved));
    } else if (stat.isFile()) {
      files.push(resolved);
    }
  }

  return files;
}

interface RunResult {
  files: string[];
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

function runCheck(files: string[], config: CheckConfig): RunResult {
  const workspace = new Workspace();

  for (const file of files) {
    try {
      const source = fs.readFileSync(file, "utf-8");
      workspace.addDocument(source, { filename: file });
    } catch (err) {
      console.error(pc.red(`Error reading ${file}: ${err instanceof Error ? err.message : err}`));
    }
  }

  const diagnostics = check(workspace, config);

  diagnostics.sort((a: Diagnostic, b: Diagnostic) => {
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }
    if (a.location.startPosition.row !== b.location.startPosition.row) {
      return a.location.startPosition.row - b.location.startPosition.row;
    }
    return a.location.startPosition.column - b.location.startPosition.column;
  });

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
  const infoCount = diagnostics.filter((d) => d.severity === "info").length;

  return { files, diagnostics, errorCount, warningCount, infoCount };
}

interface OutputOptions {
  format: OutputFormat;
  severity: SeverityKey;
}

function outputResults(result: RunResult, options: OutputOptions): void {
  const { diagnostics, errorCount, warningCount, infoCount, files } = result;

  const minSeverity = SEVERITY_ORDER[options.severity];
  const filtered = diagnostics.filter((d) => SEVERITY_ORDER[d.severity] <= minSeverity);

  if (options.format === "json") {
    const output = {
      files: files.length,
      issues: filtered.length,
      errors: errorCount,
      warnings: warningCount,
      info: infoCount,
      diagnostics: filtered.map((d) => ({
        file: d.file,
        line: d.location.startPosition.row + 1,
        column: d.location.startPosition.column + 1,
        endLine: d.location.endPosition.row + 1,
        endColumn: d.location.endPosition.column + 1,
        severity: d.severity,
        code: d.code,
        message: d.message,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (options.format === "default") {
    // Group diagnostics by file for cleaner output
    const byFile = new Map<string, Diagnostic[]>();
    for (const d of filtered) {
      const existing = byFile.get(d.file) || [];
      existing.push(d);
      byFile.set(d.file, existing);
    }

    for (const [file, fileDiagnostics] of byFile) {
      console.log();
      console.log(pc.underline(relativePath(file)));
      for (const diagnostic of fileDiagnostics) {
        console.log(formatDiagnosticDefault(diagnostic));
      }
    }
  } else {
    for (const diagnostic of filtered) {
      console.log(formatDiagnostic(diagnostic, options.format));
    }
  }

  if (options.format !== "github") {
    console.log();
    const parts: string[] = [];
    if (errorCount > 0) {
      parts.push(pc.red(`${errorCount} error${errorCount !== 1 ? "s" : ""}`));
    }
    if (warningCount > 0) {
      parts.push(pc.yellow(`${warningCount} warning${warningCount !== 1 ? "s" : ""}`));
    }
    if (infoCount > 0) {
      parts.push(pc.cyan(`${infoCount} info`));
    }

    const summary = parts.length > 0 ? parts.join(", ") : pc.green("no issues");
    console.log(`${pc.bold(String(files.length))} files checked, ${summary}`);
  }
}

function watchFiles(paths: string[], options: OutputOptions, config: CheckConfig): void {
  console.log(pc.dim("Watching for file changes..."));
  console.log();

  const runAndReport = (): void => {
    console.clear();
    console.log(pc.dim(`[${new Date().toLocaleTimeString()}] Checking...`));
    console.log();

    const files = resolveFiles(paths);
    if (files.length === 0) {
      console.log("No .thalo or .md files found.");
      return;
    }

    const result = runCheck(files, config);
    outputResults(result, options);

    console.log();
    console.log(pc.dim("Watching for file changes... (Ctrl+C to exit)"));
  };

  runAndReport();

  const watchedDirs = new Set<string>();
  for (const targetPath of paths) {
    const resolved = path.resolve(targetPath);
    const stat = fs.statSync(resolved);
    const dir = stat.isDirectory() ? resolved : path.dirname(resolved);
    watchedDirs.add(dir);
  }

  let debounceTimer: NodeJS.Timeout | null = null;

  for (const dir of watchedDirs) {
    fs.watch(dir, { recursive: true }, (_eventType, filename) => {
      if (!filename) {
        return;
      }
      if (!filename.endsWith(".thalo") && !filename.endsWith(".md")) {
        return;
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        runAndReport();
      }, 100);
    });
  }
}

function parseRuleOverrides(ruleArgs: string | string[] | undefined): Map<string, Severity> {
  const rules = new Map<string, Severity>();

  if (!ruleArgs) {
    return rules;
  }

  const ruleList = Array.isArray(ruleArgs) ? ruleArgs : [ruleArgs];

  for (const ruleArg of ruleList) {
    const match = ruleArg.match(/^([^=]+)=(.+)$/);
    if (!match) {
      console.error(`Invalid rule format: ${ruleArg}. Use: --rule <rule>=<severity>`);
      process.exit(2);
    }
    const [, ruleCode, ruleSev] = match;
    if (!["error", "warning", "info", "off"].includes(ruleSev)) {
      console.error(`Invalid rule severity: ${ruleSev}. Use: error, warning, info, off`);
      process.exit(2);
    }
    rules.set(ruleCode, ruleSev as Severity);
  }

  return rules;
}

function checkAction(ctx: CommandContext): void {
  const { options, args } = ctx;

  // Handle format-dependent color disabling
  const format = (options["format"] as OutputFormat) || "default";
  if (format === "json" || format === "github") {
    process.env["NO_COLOR"] = "1";
  }

  // Determine severity level
  let severity: SeverityKey = (options["severity"] as SeverityKey) || "info";
  if (options["quiet"]) {
    severity = "error";
  }

  // Parse rule overrides
  const rules = parseRuleOverrides(options["rule"] as string | string[] | undefined);

  // Build check config
  const config: CheckConfig = {};
  if (rules.size > 0) {
    config.rules = Object.fromEntries(rules);
  }

  // Determine target paths
  const targetPaths = args.length > 0 ? args : ["."];

  // Watch mode
  if (options["watch"]) {
    watchFiles(targetPaths, { format, severity }, config);
    return;
  }

  // Collect files
  const files = resolveFiles(targetPaths);

  if (files.length === 0) {
    console.log("No .thalo or .md files found.");
    process.exit(0);
  }

  // Run checks
  const result = runCheck(files, config);

  // Output results
  outputResults(result, { format, severity });

  // Determine exit code
  if (result.errorCount > 0) {
    process.exit(1);
  }

  const maxWarnings = options["max-warnings"];
  if (maxWarnings !== undefined) {
    const maxWarningsNum = parseInt(maxWarnings as string, 10);
    if (isNaN(maxWarningsNum) || maxWarningsNum < 0) {
      console.error(`Invalid max-warnings value: ${maxWarnings}`);
      process.exit(2);
    }

    if (result.warningCount > maxWarningsNum) {
      if (format !== "json") {
        console.log();
        console.error(
          pc.red(
            `Warning threshold exceeded: ${result.warningCount} warnings (max: ${maxWarningsNum})`,
          ),
        );
      }
      process.exit(1);
    }
  }
}

export const checkCommand: CommandDef = {
  name: "check",
  description: "Check and lint thalo files for errors and warnings",
  args: {
    name: "paths",
    description: "Files or directories to check",
    required: false,
    multiple: true,
  },
  options: {
    quiet: {
      type: "boolean",
      short: "q",
      description: "Only show errors, suppress warnings and info",
      default: false,
    },
    format: {
      type: "string",
      short: "f",
      description: "Output format",
      choices: ["default", "json", "compact", "github"],
      default: "default",
    },
    severity: {
      type: "string",
      description: "Minimum severity to report",
      choices: ["error", "warning", "info"],
      default: "info",
    },
    "max-warnings": {
      type: "string",
      description: "Exit with error if warnings exceed threshold",
    },
    rule: {
      type: "string",
      description: "Set rule severity (e.g., unknown-entity=off)",
      multiple: true,
    },
    watch: {
      type: "boolean",
      short: "w",
      description: "Watch files for changes and re-run",
      default: false,
    },
  },
  action: checkAction,
};
