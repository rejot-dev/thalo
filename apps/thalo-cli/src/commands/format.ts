import * as fs from "node:fs/promises";
import * as path from "node:path";
import ignore from "ignore";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";

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

async function collectFiles(dir: string, fileTypes: string[]): Promise<string[]> {
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

async function resolveFiles(paths: string[], fileTypes: string[]): Promise<string[]> {
  const files: string[] = [];

  for (const targetPath of paths) {
    const resolved = path.resolve(targetPath);

    try {
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) {
        files.push(...(await collectFiles(resolved, fileTypes)));
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

function relativePath(filePath: string): string {
  const cwd = process.cwd();
  if (filePath.startsWith(cwd)) {
    const rel = filePath.slice(cwd.length + 1);
    return rel || filePath;
  }
  return filePath;
}

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

async function formatAction(ctx: CommandContext): Promise<void> {
  const { options, args } = ctx;
  const checkOnly = options["check"] as boolean;
  const writeBack = options["write"] as boolean;
  const fileTypeStr = (options["file-type"] as string) || "md,thalo";
  const fileTypes = fileTypeStr.split(",").map((t) => t.trim());

  const targetPaths = args.length > 0 ? args : ["."];
  const files = await resolveFiles(targetPaths, fileTypes);

  if (files.length === 0) {
    const fileTypesStr = fileTypes.join(", ");
    console.log(`No .${fileTypesStr} files found.`);
    process.exit(0);
  }

  const prettier = await import("prettier");
  const thaloPrettier = await import("@rejot-dev/thalo-prettier");

  let changedCount = 0;
  let errorCount = 0;

  const results = await Promise.allSettled(
    files.map(async (file) => {
      try {
        const content = await fs.readFile(file, "utf-8");
        const parser = getParser(file);
        // Always include thalo plugin so embedded thalo code blocks in markdown get formatted
        const formatted = await prettier.format(content, {
          filepath: file,
          parser,
          plugins: [thaloPrettier],
        });
        return { file, formatted, isChanged: content !== formatted };
      } catch (err) {
        throw { file, err };
      }
    }),
  );

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
        // Make files needing formatting bold with ✗
        console.log(pc.bold(pc.red(`✗`) + ` ${relativePath(file)}`));
        changedCount++;
      } else {
        // Files already formatted
        console.log(pc.green(`✓`) + ` ${relativePath(file)}`);
      }
    } else if (writeBack) {
      if (isChanged) {
        await fs.writeFile(file, formatted, "utf-8");
        // Make formatted files bold (like prettier)
        console.log(pc.bold(pc.green(`✓`) + ` ${relativePath(file)}`));
        changedCount++;
      } else {
        // Print unchanged files in regular text
        console.log(pc.green(`✓`) + ` ${relativePath(file)}`);
      }
    } else {
      // This branch shouldn't happen since write defaults to true, but keep for safety
      if (isChanged) {
        console.log(pc.yellow(`⚠`) + ` ${relativePath(file)} (needs formatting)`);
        changedCount++;
      } else {
        console.log(pc.green(`✓`) + ` ${relativePath(file)}`);
      }
    }
  }

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
    "file-type": {
      type: "string",
      description: "Comma-separated list of file types to format (e.g., 'md,thalo')",
      default: "md,thalo",
    },
  },
  action: formatAction,
};
