import * as fs from "node:fs/promises";
import * as path from "node:path";
import ignore from "ignore";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";
import { createWorkspace } from "@rejot-dev/thalo/node";
import {
  runFormat,
  type FormatResult,
  type FormatFileInput,
  type SyntaxErrorInfo,
} from "@rejot-dev/thalo";
import { relativePath } from "../files.js";

// ===================
// File Collection (format-specific with ignore patterns)
// ===================

async function loadIgnoreFile(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content.split("\n").filter((line) => line.trim() && !line.startsWith("#"));
  } catch {
    return [];
  }
}

async function createIgnoreFilter(dir: string) {
  const ig = ignore();
  ig.add(await loadIgnoreFile(path.join(dir, ".gitignore")));
  ig.add(await loadIgnoreFile(path.join(dir, ".prettierignore")));
  return ig;
}

async function collectFilesWithIgnore(dir: string, fileTypes: string[]): Promise<string[]> {
  const files: string[] = [];
  const ig = await createIgnoreFilter(dir);

  // Build glob patterns for each file type
  const patterns = fileTypes.map((type) => `**/*.${type}`);

  // exclude prevents traversing into node_modules/.git (perf), ig.ignores handles user patterns
  for (const pattern of patterns) {
    for await (const entry of fs.glob(pattern, {
      cwd: dir,
      exclude: (name) => name === "node_modules" || name.startsWith("."),
    })) {
      // Normalize to forward slashes for ignore matching (ignore lib expects posix paths)
      const igPath = entry.split(path.sep).join("/");
      if (!ig.ignores(igPath)) {
        files.push(path.join(dir, entry));
      }
    }
  }

  return files;
}

async function resolveFormatFiles(paths: string[], fileTypes: string[]): Promise<string[]> {
  const files: string[] = [];

  for (const targetPath of paths) {
    const resolved = path.resolve(targetPath);

    try {
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) {
        files.push(...(await collectFilesWithIgnore(resolved, fileTypes)));
      } else if (stat.isFile()) {
        const ext = path.extname(resolved).slice(1); // Remove leading dot
        if (fileTypes.includes(ext)) {
          files.push(resolved);
        }
      }
    } catch {
      console.error(pc.red(`Error: Path not found: ${targetPath}`));
      process.exit(2);
    }
  }

  return files;
}

function formatSyntaxError(error: SyntaxErrorInfo): string {
  const loc = `${error.line}:${error.column}`.padEnd(8);
  const severityLabel = pc.red("error".padEnd(7));
  const codeLabel = pc.dim(error.code);

  return `  ${pc.dim(loc)} ${severityLabel} ${error.message}  ${codeLabel}`;
}

// ===================
// Prettier Integration
// ===================

function getParser(filePath: string): string {
  const ext = path.extname(filePath).slice(1);
  if (ext === "thalo") {
    return "thalo";
  }
  if (ext === "md") {
    return "markdown";
  }
  return "thalo"; // default
}

async function createPrettierFormatter(): Promise<
  (source: string, filepath: string) => Promise<string>
> {
  const prettier = await import("prettier");
  const thaloPrettier = await import("@rejot-dev/thalo-prettier");

  return async (source: string, filepath: string): Promise<string> => {
    const parser = getParser(filepath);
    // Load project's prettier config (prettier.config.mjs, .prettierrc, etc.)
    const resolvedConfig = await prettier.resolveConfig(filepath);
    return prettier.format(source, {
      ...resolvedConfig,
      filepath,
      parser,
      plugins: [thaloPrettier],
    });
  };
}

// ===================
// Command Action
// ===================

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let settled = false;
    process.stdin.setEncoding("utf-8");

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.removeListener("end", onEnd);
      process.stdin.removeListener("error", onError);
      process.stdin.removeListener("close", onClose);
    };

    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        cleanup();
        fn();
      }
    };

    const onData = (chunk: string) => {
      data += chunk;
    };

    const onEnd = () => {
      settle(() => resolve(data));
    };

    const onError = (error: Error) => {
      settle(() => reject(error));
    };

    const onClose = () => {
      // This handles cases where stdin closes without 'end' (e.g., EOF)
      settle(() => resolve(data));
    };

    // 'data' can fire multiple times, so use 'on'
    process.stdin.on("data", onData);
    // 'end', 'error', and 'close' should only fire once, so use 'once'
    process.stdin.once("end", onEnd);
    process.stdin.once("error", onError);
    process.stdin.once("close", onClose);
  });
}

async function formatAction(ctx: CommandContext): Promise<void> {
  const { options, args } = ctx;
  const checkOnly = options["check"] as boolean;
  const writeBack = options["write"] as boolean;
  const useStdin = options["stdin"] as boolean;
  const fileTypeStr = (options["file-type"] as string) || "md,thalo";
  const fileTypes = fileTypeStr.split(",").map((t) => t.trim());

  // Handle stdin mode - read from stdin, output to stdout
  if (useStdin) {
    const content = await readStdin();
    const workspace = createWorkspace();
    const formatter = await createPrettierFormatter();

    // Use a placeholder filepath for parser detection (default to .thalo)
    const filepath = args[0] || "stdin.thalo";
    const files: FormatFileInput[] = [{ file: filepath, content }];
    const result = await runFormat(workspace, files, { formatter });

    const fileResult = result.fileResults[0];
    if (fileResult) {
      // Output formatted content to stdout
      process.stdout.write(fileResult.formatted);
    }

    // Exit with error code if there were syntax errors
    if (result.syntaxErrorCount > 0) {
      process.exit(1);
    }
    return;
  }

  const targetPaths = args.length > 0 ? args : ["."];
  const filePaths = await resolveFormatFiles(targetPaths, fileTypes);

  if (filePaths.length === 0) {
    const fileTypesStr = fileTypes.join(", ");
    console.log(`No .${fileTypesStr} files found.`);
    process.exit(0);
  }

  // Read all file contents
  const files: FormatFileInput[] = await Promise.all(
    filePaths.map(async (file) => ({
      file,
      content: await fs.readFile(file, "utf-8"),
    })),
  );

  // Create workspace and formatter
  const workspace = createWorkspace();
  const formatter = await createPrettierFormatter();

  // Run format
  const result: FormatResult = await runFormat(workspace, files, { formatter });

  // Output results
  let writeCount = 0;

  for (const fileResult of result.fileResults) {
    const relPath = relativePath(fileResult.file);

    if (fileResult.hasSyntaxErrors) {
      // File has syntax errors - mark as failed
      console.log(pc.bold(pc.red(`✗`) + ` ${relPath}`));
    } else if (checkOnly) {
      if (fileResult.isChanged) {
        // Make files needing formatting bold with ✗
        console.log(pc.bold(pc.red(`✗`) + ` ${relPath}`));
      } else {
        // Files already formatted
        console.log(pc.green(`✓`) + ` ${relPath}`);
      }
    } else if (writeBack) {
      if (fileResult.isChanged) {
        await fs.writeFile(fileResult.file, fileResult.formatted, "utf-8");
        // Make formatted files bold (like prettier)
        console.log(pc.bold(pc.green(`✓`) + ` ${relPath}`));
        writeCount++;
      } else {
        // Print unchanged files in regular text
        console.log(pc.green(`✓`) + ` ${relPath}`);
      }
    } else {
      // This branch shouldn't happen since write defaults to true, but keep for safety
      if (fileResult.isChanged) {
        console.log(pc.yellow(`⚠`) + ` ${relPath} (needs formatting)`);
      } else {
        console.log(pc.green(`✓`) + ` ${relPath}`);
      }
    }
  }

  // Print syntax errors grouped by file (like check command does)
  const filesWithErrors = result.fileResults.filter((r) => r.hasSyntaxErrors);
  if (filesWithErrors.length > 0) {
    console.log();
    for (const fileResult of filesWithErrors) {
      console.log();
      console.log(pc.underline(relativePath(fileResult.file)));
      for (const error of fileResult.syntaxErrors) {
        console.log(formatSyntaxError(error));
      }
    }
  }

  // Print summary
  if (result.filesProcessed > 1 || checkOnly) {
    console.log();
    if (checkOnly) {
      const totalIssues = result.changedCount + result.syntaxErrorCount;
      if (totalIssues > 0) {
        const parts: string[] = [];
        if (result.syntaxErrorCount > 0) {
          parts.push(
            pc.red(
              `${result.syntaxErrorCount} file${result.syntaxErrorCount !== 1 ? "s" : ""} with syntax errors`,
            ),
          );
        }
        if (result.changedCount > 0) {
          parts.push(
            pc.yellow(
              `${result.changedCount} file${result.changedCount !== 1 ? "s" : ""} need${result.changedCount === 1 ? "s" : ""} formatting`,
            ),
          );
        }
        console.log(parts.join(", "));
        process.exit(1);
      } else {
        console.log(pc.green(`All ${result.filesProcessed} files are properly formatted`));
      }
    } else if (writeBack) {
      console.log(`Formatted ${writeCount} file${writeCount !== 1 ? "s" : ""}`);
    }
  }

  if (result.syntaxErrorCount > 0) {
    process.exit(1);
  }
}

export const formatCommand: CommandDef = {
  name: "format",
  description: "Format thalo and markdown files using Prettier",
  args: {
    name: "paths",
    description: "Files or directories to format",
    required: false,
    multiple: true,
  },
  options: {
    check: {
      type: "boolean",
      short: "c",
      description: "Check if files are formatted (exit 1 if not)",
      default: false,
    },
    write: {
      type: "boolean",
      short: "w",
      description: "Write formatted output back to files",
      default: true,
    },
    stdin: {
      type: "boolean",
      description: "Read from stdin and output to stdout (for editor integration)",
      default: false,
    },
    "file-type": {
      type: "string",
      description: "Comma-separated list of file types to format (e.g., 'md,thalo')",
      default: "md,thalo",
    },
  },
  action: formatAction,
};
