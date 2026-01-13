import * as fs from "node:fs";
import * as path from "node:path";
import {
  runCheck,
  formatDiagnostic as formatDiagnosticPlain,
  type Severity,
  type CheckConfig,
  type CheckResult,
  type DiagnosticInfo,
  type DiagnosticSeverity,
} from "@rejot-dev/thalo";
import { createWorkspace } from "@rejot-dev/thalo/native";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";

type SeverityKey = DiagnosticSeverity;
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

function formatDiagnosticDefault(d: DiagnosticInfo): string {
  const color = severityColor[d.severity];

  const loc = `${d.line}:${d.column}`.padEnd(8);
  const severityLabel = color(d.severity.padEnd(7));
  const codeLabel = pc.dim(d.code);

  return `  ${pc.dim(loc)} ${severityLabel} ${d.message}  ${codeLabel}`;
}

function formatDiagnostic(d: DiagnosticInfo, format: OutputFormat): string {
  switch (format) {
    case "compact":
    case "github":
      // Use shared formatter for compact/github formats (no colors needed)
      return formatDiagnosticPlain(d, format);
    default:
      return formatDiagnosticDefault(d);
  }
}

function collectFiles(dir: string, fileTypes: string[]): string[] {
  const files: string[] = [];
  const extensions = fileTypes.map((type) => `.${type}`);

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

function resolveFiles(paths: string[], fileTypes: string[]): string[] {
  const files: string[] = [];

  for (const targetPath of paths) {
    const resolved = path.resolve(targetPath);

    if (!fs.existsSync(resolved)) {
      console.error(pc.red(`Error: Path not found: ${targetPath}`));
      process.exit(2);
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      files.push(...collectFiles(resolved, fileTypes));
    } else if (stat.isFile()) {
      const ext = path.extname(resolved).slice(1); // Remove leading dot
      if (fileTypes.includes(ext)) {
        files.push(resolved);
      }
    }
  }

  return files;
}

interface RunResult {
  files: string[];
  result: CheckResult;
}

function executeCheck(files: string[], config: CheckConfig): RunResult {
  const workspace = createWorkspace();

  for (const file of files) {
    try {
      const source = fs.readFileSync(file, "utf-8");
      workspace.addDocument(source, { filename: file });
    } catch (err) {
      console.error(pc.red(`Error reading ${file}: ${err instanceof Error ? err.message : err}`));
    }
  }

  const result = runCheck(workspace, { config });

  return { files, result };
}

interface OutputOptions {
  format: OutputFormat;
  severity: SeverityKey;
}

function outputResults(runResult: RunResult, options: OutputOptions): void {
  const { result, files } = runResult;
  const { diagnosticsByFile, errorCount, warningCount, infoCount } = result;

  // Collect and filter diagnostics by severity
  const minSeverity = SEVERITY_ORDER[options.severity];
  const filtered: DiagnosticInfo[] = [];
  for (const diagnostics of diagnosticsByFile.values()) {
    for (const d of diagnostics) {
      if (SEVERITY_ORDER[d.severity] <= minSeverity) {
        filtered.push(d);
      }
    }
  }

  // Track which files have issues
  const filesWithIssues = new Set(filtered.map((d) => d.file));

  if (options.format === "json") {
    const output = {
      files: files.length,
      issues: filtered.length,
      errors: errorCount,
      warnings: warningCount,
      info: infoCount,
      diagnostics: filtered.map((d) => ({
        file: d.file,
        line: d.line,
        column: d.column,
        endLine: d.endLine,
        endColumn: d.endColumn,
        severity: d.severity,
        code: d.code,
        message: d.message,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Always print all files that were checked
  if (options.format === "default") {
    // Print all files first
    for (const file of files) {
      const hasIssues = filesWithIssues.has(file);
      if (hasIssues) {
        // Make files with issues bold
        console.log(pc.bold(pc.red(`✗`) + ` ${relativePath(file)}`));
      } else {
        // Files without issues in regular text
        console.log(pc.green(`✓`) + ` ${relativePath(file)}`);
      }
    }

    // Then show diagnostics grouped by file
    if (filtered.length > 0) {
      console.log();
      const byFile = new Map<string, DiagnosticInfo[]>();
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

function watchFiles(
  paths: string[],
  fileTypes: string[],
  options: OutputOptions,
  config: CheckConfig,
): void {
  console.log(pc.dim("Watching for file changes..."));
  console.log();

  const runAndReport = (): void => {
    console.clear();
    console.log(pc.dim(`[${new Date().toLocaleTimeString()}] Checking...`));
    console.log();

    const files = resolveFiles(paths, fileTypes);
    if (files.length === 0) {
      const fileTypesStr = fileTypes.join(", ");
      console.log(`No .${fileTypesStr} files found.`);
      return;
    }

    const runResult = executeCheck(files, config);
    outputResults(runResult, options);

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
  const extensions = fileTypes.map((type) => `.${type}`);

  for (const dir of watchedDirs) {
    fs.watch(dir, { recursive: true }, (_eventType, filename) => {
      if (!filename) {
        return;
      }
      if (!extensions.some((ext) => filename.endsWith(ext))) {
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

  // Parse file types
  const fileTypeStr = (options["file-type"] as string) || "md,thalo";
  const fileTypes = fileTypeStr.split(",").map((t) => t.trim());

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
    watchFiles(targetPaths, fileTypes, { format, severity }, config);
    return;
  }

  // Collect files
  const files = resolveFiles(targetPaths, fileTypes);

  if (files.length === 0) {
    const fileTypesStr = fileTypes.join(", ");
    console.log(`No .${fileTypesStr} files found.`);
    process.exit(0);
  }

  // Run checks
  const runResult = executeCheck(files, config);

  // Output results
  outputResults(runResult, { format, severity });

  // Determine exit code
  if (runResult.result.errorCount > 0) {
    process.exit(1);
  }

  const maxWarnings = options["max-warnings"];
  if (maxWarnings !== undefined) {
    const maxWarningsNum = parseInt(maxWarnings as string, 10);
    if (isNaN(maxWarningsNum) || maxWarningsNum < 0) {
      console.error(`Invalid max-warnings value: ${maxWarnings}`);
      process.exit(2);
    }

    if (runResult.result.warningCount > maxWarningsNum) {
      if (format !== "json") {
        console.log();
        console.error(
          pc.red(
            `Warning threshold exceeded: ${runResult.result.warningCount} warnings (max: ${maxWarningsNum})`,
          ),
        );
      }
      process.exit(1);
    }
  }
}

export const checkCommand: CommandDef = {
  name: "check",
  description: "Check and lint thalo and markdown files for errors and warnings",
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
    "file-type": {
      type: "string",
      description: "Comma-separated list of file types to check (e.g., 'md,thalo')",
      default: "md,thalo",
    },
  },
  action: checkAction,
};
