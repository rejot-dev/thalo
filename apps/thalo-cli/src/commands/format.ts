import * as fs from "node:fs/promises";
import * as path from "node:path";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";

/**
 * Collect .thalo files using glob pattern
 */
async function collectThaloFiles(dir: string): Promise<string[]> {
  const pattern = "**/*.thalo";
  const files: string[] = [];

  // Use Node's built-in glob (Node 22+)
  for await (const entry of fs.glob(pattern, {
    cwd: dir,
    exclude: (name) => name.startsWith(".") || name === "node_modules",
  })) {
    files.push(path.join(dir, entry));
  }

  return files;
}

/**
 * Resolve files from paths (files or directories)
 */
async function resolveFiles(paths: string[]): Promise<string[]> {
  const files: string[] = [];

  for (const targetPath of paths) {
    const resolved = path.resolve(targetPath);

    try {
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) {
        files.push(...(await collectThaloFiles(resolved)));
      } else if (stat.isFile()) {
        files.push(resolved);
      }
    } catch {
      console.error(pc.red(`Error: Path not found: ${targetPath}`));
      process.exit(2);
    }
  }

  return files;
}

function relativePath(filePath: string): string {
  const cwd = process.cwd();
  if (filePath.startsWith(cwd)) {
    const rel = filePath.slice(cwd.length + 1);
    return rel || filePath;
  }
  return filePath;
}

async function formatAction(ctx: CommandContext): Promise<void> {
  const { options, args } = ctx;
  const checkOnly = options["check"] as boolean;
  const writeBack = options["write"] as boolean;

  // Handle stdin mode
  if (options["stdin"]) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString("utf-8");

    try {
      const prettier = await import("prettier");
      const thaloPrettier = await import("@rejot-dev/thalo-prettier");

      const formatted = await prettier.format(input, {
        parser: "thalo",
        plugins: [thaloPrettier],
      });

      process.stdout.write(formatted);
    } catch (err) {
      console.error(pc.red(`Error: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    }
    return;
  }

  // Determine target paths
  const targetPaths = args.length > 0 ? args : ["."];

  // Collect files
  const files = await resolveFiles(targetPaths);

  if (files.length === 0) {
    console.log("No .thalo files found.");
    process.exit(0);
  }

  // Load prettier and plugin once
  const prettier = await import("prettier");
  const thaloPrettier = await import("@rejot-dev/thalo-prettier");

  let changedCount = 0;
  let errorCount = 0;

  // Process files in parallel
  const results = await Promise.allSettled(
    files.map(async (file) => {
      try {
        const content = await fs.readFile(file, "utf-8");

        const formatted = await prettier.format(content, {
          parser: "thalo",
          plugins: [thaloPrettier],
        });

        return { file, content, formatted, isChanged: content !== formatted };
      } catch (err) {
        throw { file, err };
      }
    }),
  );

  // Output results
  for (const result of results) {
    if (result.status === "rejected") {
      const { file, err } = result.reason as { file: string; err: unknown };
      const message = err instanceof Error ? err.message : String(err);
      console.error(pc.red(`✗`) + ` ${relativePath(file)}: ${message}`);
      errorCount++;
      continue;
    }

    const { file, formatted, isChanged } = result.value;

    if (checkOnly) {
      if (isChanged) {
        console.log(relativePath(file));
        changedCount++;
      }
    } else if (writeBack) {
      if (isChanged) {
        await fs.writeFile(file, formatted, "utf-8");
        console.log(pc.green(`✓`) + ` ${relativePath(file)}`);
        changedCount++;
      }
    } else {
      // Default: output formatted content (only makes sense for single file)
      if (files.length === 1) {
        process.stdout.write(formatted);
      } else {
        // Multiple files without --write: show diff status
        if (isChanged) {
          console.log(pc.yellow(`⚠`) + ` ${relativePath(file)} (needs formatting)`);
          changedCount++;
        } else {
          console.log(pc.green(`✓`) + ` ${relativePath(file)}`);
        }
      }
    }
  }

  // Summary for multi-file operations
  if (files.length > 1 || checkOnly) {
    console.log();
    if (checkOnly) {
      if (changedCount > 0) {
        console.log(
          pc.yellow(
            `${changedCount} file${changedCount !== 1 ? "s" : ""} need${changedCount === 1 ? "s" : ""} formatting`,
          ),
        );
        process.exit(1);
      } else {
        console.log(pc.green(`All ${files.length} files are properly formatted`));
      }
    } else if (writeBack) {
      console.log(`Formatted ${changedCount} file${changedCount !== 1 ? "s" : ""}`);
    }
  }

  if (errorCount > 0) {
    process.exit(1);
  }
}

export const formatCommand: CommandDef = {
  name: "format",
  description: "Format thalo files using Prettier",
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
      default: false,
    },
    stdin: {
      type: "boolean",
      description: "Read input from stdin and write to stdout",
      default: false,
    },
  },
  action: formatAction,
};
