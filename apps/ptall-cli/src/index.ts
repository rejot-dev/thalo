import * as fs from "node:fs";
import * as path from "node:path";
import {
  Workspace,
  check,
  allRules,
  type Diagnostic,
  type Severity,
  type CheckConfig,
} from "@wilco/ptall";

const VERSION = "0.1.0";

type SeverityKey = Exclude<Severity, "off">;

type OutputFormat = "default" | "json" | "compact" | "github";

interface CliOptions {
  help: boolean;
  version: boolean;
  quiet: boolean;
  format: OutputFormat;
  noColor: boolean;
  severity: SeverityKey;
  maxWarnings: number | null;
  watch: boolean;
  listRules: boolean;
  rules: Map<string, Severity>;
  paths: string[];
}

const SEVERITY_ORDER: Record<SeverityKey, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const SEVERITY_COLORS = {
  error: "\x1b[31m", // red
  warning: "\x1b[33m", // yellow
  info: "\x1b[36m", // cyan
} as const;

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";

let useColor = process.stdout.isTTY;

function colorize(text: string, color: string): string {
  return useColor ? `${color}${text}${RESET}` : text;
}

function formatDiagnosticDefault(diagnostic: Diagnostic): string {
  const { file, location, severity, code, message } = diagnostic;
  const severityColor = SEVERITY_COLORS[severity];

  const loc = `${file}:${location.startPosition.row + 1}:${location.startPosition.column + 1}`;
  const severityLabel = colorize(severity.toUpperCase(), severityColor);
  const codeLabel = colorize(`[${code}]`, DIM);

  return `${colorize(loc, BOLD)} ${severityLabel} ${codeLabel} ${message}`;
}

function formatDiagnosticCompact(diagnostic: Diagnostic): string {
  const { file, location, severity, code, message } = diagnostic;
  const loc = `${file}:${location.startPosition.row + 1}:${location.startPosition.column + 1}`;
  return `${loc}: ${severity[0].toUpperCase()} [${code}] ${message}`;
}

function formatDiagnosticGithub(diagnostic: Diagnostic): string {
  const { file, location, severity, code, message } = diagnostic;
  const line = location.startPosition.row + 1;
  const col = location.startPosition.column + 1;
  const endLine = location.endPosition.row + 1;
  const endCol = location.endPosition.column + 1;

  // GitHub Actions workflow command format
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

function collectPtallFiles(dir: string, extensions: string[] = [".ptall", ".md"]): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      // Skip unreadable directories
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
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

function printHelp(): void {
  console.log(`
${colorize("ptall", BOLD)} - Lint and check ptall files

${colorize("USAGE", BOLD)}
  ptall [options] [files or directories...]

${colorize("OPTIONS", BOLD)}
  ${colorize("-h, --help", DIM)}              Show this help message
  ${colorize("-v, --version", DIM)}           Show version number
  ${colorize("-q, --quiet", DIM)}             Only show errors, suppress warnings and info
  ${colorize("-f, --format <fmt>", DIM)}      Output format: default, json, compact, github
  ${colorize("--no-color", DIM)}              Disable colored output
  ${colorize("--severity <level>", DIM)}      Minimum severity to report: error, warning, info
  ${colorize("--max-warnings <n>", DIM)}      Exit with error if warnings exceed threshold
  ${colorize("--rule <rule>=<sev>", DIM)}     Set rule severity (can be repeated)
  ${colorize("--list-rules", DIM)}            List all available rules
  ${colorize("-w, --watch", DIM)}             Watch files for changes and re-run

${colorize("EXAMPLES", BOLD)}
  ${colorize("ptall kc/", DIM)}                         Check all files in kc/
  ${colorize("ptall -f json kc/", DIM)}                 Output diagnostics as JSON
  ${colorize("ptall --quiet kc/", DIM)}                 Only show errors
  ${colorize("ptall --rule unknown-entity=off", DIM)}   Disable a specific rule
  ${colorize("ptall --max-warnings 10 kc/", DIM)}       Fail if >10 warnings
  ${colorize("ptall -w kc/", DIM)}                      Watch mode

${colorize("EXIT CODES", BOLD)}
  ${colorize("0", GREEN)}  No errors
  ${colorize("1", SEVERITY_COLORS["error"])}  Errors found or max warnings exceeded
  ${colorize("2", SEVERITY_COLORS["warning"])}  Invalid arguments
`);
}

function printVersion(): void {
  console.log(`ptall-cli v${VERSION}`);
}

function printRules(): void {
  console.log(`\n${colorize("Available Rules", BOLD)}\n`);

  const maxCodeLen = Math.max(...allRules.map((r) => r.code.length));

  for (const rule of allRules) {
    const severityColor = SEVERITY_COLORS[rule.defaultSeverity as SeverityKey] ?? DIM;
    const code = rule.code.padEnd(maxCodeLen);
    const severity = colorize(rule.defaultSeverity.padEnd(7), severityColor);
    console.log(`  ${colorize(code, BOLD)}  ${severity}  ${rule.name}`);
  }
  console.log();
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    version: false,
    quiet: false,
    format: "default",
    noColor: false,
    severity: "info",
    maxWarnings: null,
    watch: false,
    listRules: false,
    rules: new Map(),
    paths: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "-v":
      case "--version":
        options.version = true;
        break;
      case "-q":
      case "--quiet":
        options.quiet = true;
        options.severity = "error";
        break;
      case "--no-color":
        options.noColor = true;
        break;
      case "-f":
      case "--format": {
        const format = args[++i];
        if (!["default", "json", "compact", "github"].includes(format)) {
          console.error(`Invalid format: ${format}. Use: default, json, compact, github`);
          process.exit(2);
        }
        options.format = format as OutputFormat;
        break;
      }
      case "--severity": {
        const sev = args[++i] as SeverityKey;
        if (!["error", "warning", "info"].includes(sev)) {
          console.error(`Invalid severity: ${sev}. Use: error, warning, info`);
          process.exit(2);
        }
        options.severity = sev;
        break;
      }
      case "--max-warnings": {
        const n = parseInt(args[++i], 10);
        if (isNaN(n) || n < 0) {
          console.error(`Invalid max-warnings value: ${args[i]}`);
          process.exit(2);
        }
        options.maxWarnings = n;
        break;
      }
      case "--rule": {
        const ruleArg = args[++i];
        const match = ruleArg?.match(/^([^=]+)=(.+)$/);
        if (!match) {
          console.error(`Invalid rule format: ${ruleArg}. Use: --rule <rule>=<severity>`);
          process.exit(2);
        }
        const [, ruleCode, ruleSev] = match;
        if (!["error", "warning", "info", "off"].includes(ruleSev)) {
          console.error(`Invalid rule severity: ${ruleSev}. Use: error, warning, info, off`);
          process.exit(2);
        }
        options.rules.set(ruleCode, ruleSev as Severity);
        break;
      }
      case "--list-rules":
        options.listRules = true;
        break;
      case "-w":
      case "--watch":
        options.watch = true;
        break;
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(2);
        }
        options.paths.push(arg);
    }
  }

  return options;
}

function resolveFiles(paths: string[]): string[] {
  const files: string[] = [];

  for (const targetPath of paths) {
    const resolved = path.resolve(targetPath);

    if (!fs.existsSync(resolved)) {
      console.error(colorize(`Error: Path not found: ${targetPath}`, SEVERITY_COLORS["error"]));
      process.exit(2);
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      files.push(...collectPtallFiles(resolved));
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
      console.error(
        colorize(
          `Error reading ${file}: ${err instanceof Error ? err.message : err}`,
          SEVERITY_COLORS["error"],
        ),
      );
    }
  }

  const diagnostics = check(workspace, config);

  // Sort by file, then by location
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

function outputResults(result: RunResult, options: CliOptions): void {
  const { diagnostics, errorCount, warningCount, infoCount, files } = result;

  // Filter by minimum severity
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

  // Output diagnostics
  for (const diagnostic of filtered) {
    console.log(formatDiagnostic(diagnostic, options.format));
  }

  // Summary (not for github format)
  if (options.format !== "github") {
    console.log();
    console.log(
      `${colorize("Found", BOLD)} ${files.length} files, ${filtered.length} issues ` +
        `(${colorize(String(errorCount), SEVERITY_COLORS["error"])} errors, ` +
        `${colorize(String(warningCount), SEVERITY_COLORS["warning"])} warnings, ` +
        `${colorize(String(infoCount), SEVERITY_COLORS["info"])} info)`,
    );
  }
}

function watchFiles(paths: string[], options: CliOptions, config: CheckConfig): void {
  console.log(colorize("Watching for file changes...", DIM));
  console.log();

  const runAndReport = (): void => {
    console.clear();
    console.log(colorize(`[${new Date().toLocaleTimeString()}] Checking...`, DIM));
    console.log();

    const files = resolveFiles(paths);
    if (files.length === 0) {
      console.log("No .ptall or .md files found.");
      return;
    }

    const result = runCheck(files, config);
    outputResults(result, options);

    console.log();
    console.log(colorize("Watching for file changes... (Ctrl+C to exit)", DIM));
  };

  // Initial run
  runAndReport();

  // Watch directories
  const watchedDirs = new Set<string>();
  for (const targetPath of paths) {
    const resolved = path.resolve(targetPath);
    const stat = fs.statSync(resolved);
    const dir = stat.isDirectory() ? resolved : path.dirname(resolved);
    watchedDirs.add(dir);
  }

  // Debounce file changes
  let debounceTimer: NodeJS.Timeout | null = null;

  for (const dir of watchedDirs) {
    fs.watch(dir, { recursive: true }, (_eventType, filename) => {
      if (!filename) {
        return;
      }
      if (!filename.endsWith(".ptall") && !filename.endsWith(".md")) {
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

function main(): void {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Apply color settings
  if (options.noColor || options.format === "json" || options.format === "github") {
    useColor = false;
  }

  // Handle info commands
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    printVersion();
    process.exit(0);
  }

  if (options.listRules) {
    printRules();
    process.exit(0);
  }

  // Build check config from rule overrides
  const config: CheckConfig = {};
  if (options.rules.size > 0) {
    config.rules = Object.fromEntries(options.rules);
  }

  // Default to current directory if no paths provided
  const targetPaths = options.paths.length > 0 ? options.paths : ["."];

  // Watch mode
  if (options.watch) {
    watchFiles(targetPaths, options, config);
    return; // Never returns
  }

  // Collect files
  const files = resolveFiles(targetPaths);

  if (files.length === 0) {
    console.log("No .ptall or .md files found.");
    process.exit(0);
  }

  // Run checks
  const result = runCheck(files, config);

  // Output results
  outputResults(result, options);

  // Determine exit code
  if (result.errorCount > 0) {
    process.exit(1);
  }

  if (options.maxWarnings !== null && result.warningCount > options.maxWarnings) {
    if (options.format !== "json") {
      console.log();
      console.error(
        colorize(
          `Warning threshold exceeded: ${result.warningCount} warnings (max: ${options.maxWarnings})`,
          SEVERITY_COLORS["error"],
        ),
      );
    }
    process.exit(1);
  }
}

main();
