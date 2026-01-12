import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runQuery, formatQueryResultRaw, type QueryEntryInfo } from "@rejot-dev/thalo";
import { createWorkspace, Workspace } from "@rejot-dev/thalo/native";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";

type OutputFormat = "default" | "json" | "raw";

/**
 * Collect all thalo and markdown files from a directory
 */
async function collectThaloFiles(
  dir: string,
  extensions: string[] = [".thalo", ".md"],
): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (extensions.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Resolve file paths from command arguments
 */
async function resolveFiles(paths: string[]): Promise<string[]> {
  const files: string[] = [];

  for (const targetPath of paths) {
    const resolved = resolve(targetPath);

    let fileStat;
    try {
      fileStat = await stat(resolved);
    } catch {
      console.error(pc.red(`Error: Path not found: ${targetPath}`));
      process.exit(2);
    }

    if (fileStat.isDirectory()) {
      files.push(...(await collectThaloFiles(resolved)));
    } else if (fileStat.isFile()) {
      files.push(resolved);
    }
  }

  return files;
}

/**
 * Load workspace from files
 */
async function loadWorkspace(files: string[]): Promise<Workspace> {
  const workspace = createWorkspace();

  for (const file of files) {
    try {
      const source = await readFile(file, "utf-8");
      workspace.addDocument(source, { filename: file });
    } catch (err) {
      console.error(pc.red(`Error reading ${file}: ${err instanceof Error ? err.message : err}`));
    }
  }

  return workspace;
}

/**
 * Relative path from cwd
 */
function relativePath(filePath: string): string {
  const cwd = process.cwd();
  if (filePath.startsWith(cwd)) {
    const rel = filePath.slice(cwd.length + 1);
    return rel || filePath;
  }
  return filePath;
}

/**
 * Format entry with colors for default display
 */
function formatEntryDefault(entry: QueryEntryInfo): string {
  const lines: string[] = [];
  const tags = entry.tags.map((t) => `#${t}`).join(" ");

  lines.push(
    `${pc.dim(entry.timestamp)} ${pc.cyan(entry.entity)} ${pc.bold(entry.title)}${entry.linkId ? " " + pc.green(`^${entry.linkId}`) : ""}${tags ? " " + pc.yellow(tags) : ""}`,
  );
  lines.push(`  ${pc.dim(`${relativePath(entry.file)}:${entry.startLine}-${entry.endLine}`)}`);

  return lines.join("\n");
}

/**
 * Format entry for JSON output
 */
function formatEntryJson(entry: QueryEntryInfo): object {
  return {
    file: relativePath(entry.file),
    timestamp: entry.timestamp,
    entity: entry.entity,
    title: entry.title,
    tags: entry.tags,
    link: entry.linkId,
    location: {
      startLine: entry.startLine,
      endLine: entry.endLine,
    },
  };
}

async function queryAction(ctx: CommandContext): Promise<void> {
  const { options, args } = ctx;

  // Get query string
  const queryStr = args[0];
  if (!queryStr) {
    console.error(pc.red("Error: Query string is required"));
    console.error(`\nUsage: thalo query "<query>"`);
    console.error(`\nExamples:`);
    console.error(`  thalo query 'lore'`);
    console.error(`  thalo query 'lore where #career'`);
    console.error(`  thalo query 'opinion where subject = "topic"'`);
    process.exit(2);
  }

  // Handle format
  const format = (options["format"] as OutputFormat) || "default";
  if (format === "json") {
    process.env["NO_COLOR"] = "1";
  }

  // Handle limit
  const limitStr = options["limit"] as string | undefined;
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  // Determine target paths
  const targetPaths = args.slice(1);
  const searchPaths = targetPaths.length > 0 ? targetPaths : ["."];

  // Collect and load files
  const files = await resolveFiles(searchPaths);
  if (files.length === 0) {
    console.log("No .thalo or .md files found.");
    process.exit(0);
  }

  const workspace = await loadWorkspace(files);

  // Execute query using shared command
  const result = runQuery(workspace, queryStr, {
    limit,
    includeRawText: format === "raw",
  });

  if (!result) {
    console.error(pc.red(`Error: Invalid query syntax`));
    console.error(pc.dim(`Query: ${queryStr}`));
    process.exit(2);
  }

  // Output results
  if (format === "json") {
    console.log(
      JSON.stringify(
        {
          query: result.queryString,
          count: result.totalCount,
          results: result.entries.map(formatEntryJson),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (format === "raw") {
    // Output raw entry text using shared formatter
    const lines = formatQueryResultRaw(result);
    for (const line of lines) {
      console.log(line);
    }
    return;
  }

  // Default format with colors
  console.log();
  console.log(`Query: ${pc.cyan(result.queryString)}`);
  console.log(`Found: ${pc.bold(String(result.totalCount))} entries`);

  if (result.entries.length > 0) {
    console.log();
    for (const entry of result.entries) {
      console.log(formatEntryDefault(entry));
    }
  }

  if (limit && result.totalCount > limit) {
    console.log();
    console.log(pc.dim(`(showing ${limit} of ${result.totalCount} results)`));
  }

  console.log();
}

export const queryCommand: CommandDef = {
  name: "query",
  description: "Query entries by entity type, tags, links, or metadata",
  usage: '"<query>" [paths...]',
  args: {
    name: "query",
    description: "Query string (e.g., 'lore where #career', 'opinion where subject = \"topic\"')",
    required: true,
    multiple: true,
  },
  options: {
    format: {
      type: "string",
      short: "f",
      description: "Output format",
      choices: ["default", "json", "raw"],
      default: "default",
    },
    limit: {
      type: "string",
      short: "n",
      description: "Maximum number of results to show",
    },
  },
  action: queryAction,
};
