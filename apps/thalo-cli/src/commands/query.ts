import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  Workspace,
  parseQuery as parseQueryFragment,
  executeQuery,
  formatQuery,
  findEntryFile,
  getEntrySourceText,
  type Query,
  type InstanceEntry,
} from "@rejot-dev/thalo";
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
  const workspace = new Workspace();

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
 * Get raw entry text from source file
 */
async function getEntryRawText(entry: InstanceEntry, file: string): Promise<string> {
  try {
    const source = await readFile(file, "utf-8");
    return getEntrySourceText(entry, source);
  } catch {
    return `[Could not read entry from ${file}]`;
  }
}

/**
 * Extract query from parsed fragment syntax node.
 * Converts tree-sitter node to model Query.
 */
function extractQueryFromNode(node: { text: string; type: string }): Query | null {
  if (node.type !== "query") {
    return null;
  }

  // Parse the query text to extract entity and conditions
  const text = node.text;
  const whereMatch = text.match(/^(\S+)(?:\s+where\s+(.+))?$/);

  if (!whereMatch) {
    return null;
  }

  const [, entity, conditionsStr] = whereMatch;
  const conditions: Query["conditions"] = [];

  if (conditionsStr) {
    // Split by " and " to get individual conditions
    const condParts = conditionsStr.split(/\s+and\s+/);

    for (const part of condParts) {
      const trimmed = part.trim();

      // Tag condition: #tag
      if (trimmed.startsWith("#")) {
        conditions.push({ kind: "tag", tag: trimmed.slice(1) });
        continue;
      }

      // Link condition: ^link
      if (trimmed.startsWith("^")) {
        conditions.push({ kind: "link", link: trimmed.slice(1) });
        continue;
      }

      // Field condition: field = value
      const fieldMatch = trimmed.match(/^(\S+)\s*=\s*(.+)$/);
      if (fieldMatch) {
        const [, field, value] = fieldMatch;
        // Keep the value as-is (including quotes) to match raw metadata values
        conditions.push({ kind: "field", field, value });
      }
    }
  }

  return { entity, conditions };
}

/**
 * Format timestamp for display
 */
function formatTimestamp(entry: InstanceEntry): string {
  const ts = entry.header.timestamp;
  const date = `${ts.date.year}-${String(ts.date.month).padStart(2, "0")}-${String(ts.date.day).padStart(2, "0")}`;
  const time = `${String(ts.time.hour).padStart(2, "0")}:${String(ts.time.minute).padStart(2, "0")}`;
  return `${date}T${time}`;
}

/**
 * Format entry for default display
 */
function formatEntryDefault(entry: InstanceEntry, file: string): string {
  const lines: string[] = [];
  const ts = formatTimestamp(entry);
  const title = entry.header.title.value;
  const entity = entry.header.entity;
  const link = entry.header.link?.id;
  const tags = entry.header.tags.map((t) => `#${t.name}`).join(" ");
  const startLine = entry.location.startPosition.row + 1;
  const endLine = entry.location.endPosition.row + 1;

  lines.push(
    `${pc.dim(ts)} ${pc.cyan(entity)} ${pc.bold(title)}${link ? " " + pc.green(`^${link}`) : ""}${tags ? " " + pc.yellow(tags) : ""}`,
  );
  lines.push(`  ${pc.dim(`${relativePath(file)}:${startLine}-${endLine}`)}`);

  return lines.join("\n");
}

/**
 * Format entry for JSON output
 */
function formatEntryJson(entry: InstanceEntry, file: string): object {
  return {
    file: relativePath(file),
    timestamp: formatTimestamp(entry),
    entity: entry.header.entity,
    title: entry.header.title.value,
    tags: entry.header.tags.map((t) => t.name),
    link: entry.header.link?.id ?? null,
    metadata: entry.metadata.map((m) => ({
      key: m.key.value,
      value: m.value.raw,
    })),
    location: {
      startLine: entry.location.startPosition.row + 1,
      endLine: entry.location.endPosition.row + 1,
    },
  };
}

/**
 * Parse a query string into a Query object.
 * Supports both full queries ("lore where #tag") and entity-only ("lore").
 */
export function parseQueryString(queryStr: string): Query | null {
  // Check if it's an entity-only query (no "where" clause)
  if (!queryStr.includes(" where ")) {
    // Simple entity name - validate it's a single word
    const trimmed = queryStr.trim();
    if (/^[a-z][a-z0-9-]*$/i.test(trimmed)) {
      return { entity: trimmed, conditions: [] };
    }
    // Not a valid entity name, try parsing as full query
  }

  // Parse as full query
  const parseResult = parseQueryFragment(queryStr);
  if (!parseResult.valid) {
    return null;
  }

  return extractQueryFromNode(parseResult.node);
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

  // Parse the query
  const query = parseQueryString(queryStr);
  if (!query) {
    console.error(pc.red(`Error: Invalid query syntax`));
    console.error(pc.dim(`Query: ${queryStr}`));
    process.exit(2);
  }

  // Handle format
  const format = (options["format"] as OutputFormat) || "default";
  if (format === "json") {
    process.env["NO_COLOR"] = "1";
  }

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

  // Execute query
  const results = executeQuery(workspace, query);

  // Handle limit
  const limitStr = options["limit"] as string | undefined;
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;
  const limitedResults = limit && limit > 0 ? results.slice(0, limit) : results;

  // Output results
  if (format === "json") {
    const jsonResults = limitedResults.map((entry) => {
      const file = findEntryFile(workspace, entry);
      return formatEntryJson(entry, file || "unknown");
    });
    console.log(
      JSON.stringify(
        {
          query: formatQuery(query),
          count: results.length,
          results: jsonResults,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (format === "raw") {
    // Output raw entry text
    for (const entry of limitedResults) {
      const file = findEntryFile(workspace, entry);
      if (file) {
        console.log(await getEntryRawText(entry, file));
        console.log();
      }
    }
    return;
  }

  // Default format
  console.log();
  console.log(`Query: ${pc.cyan(formatQuery(query))}`);
  console.log(`Found: ${pc.bold(String(results.length))} entries`);

  if (limitedResults.length > 0) {
    console.log();
    for (const entry of limitedResults) {
      const file = findEntryFile(workspace, entry);
      console.log(formatEntryDefault(entry, file || "unknown"));
    }
  }

  if (limit && results.length > limit) {
    console.log();
    console.log(pc.dim(`(showing ${limit} of ${results.length} results)`));
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
