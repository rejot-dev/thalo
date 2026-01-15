import {
  runQuery,
  formatQueryResultRaw,
  isQueryValidationError,
  isCheckpointError,
  type QueryEntryInfo,
} from "@rejot-dev/thalo";
import { createChangeTracker, NotInGitRepoError } from "@rejot-dev/thalo/change-tracker/node";
import { parseCheckpoint } from "@rejot-dev/thalo";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";
import { resolveFiles, loadWorkspace, relativePath } from "../files.js";

type OutputFormat = "default" | "json" | "raw";

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

  // Handle format - --json flag overrides --format option
  const jsonFlag = options["json"] as boolean;
  const format = jsonFlag ? "json" : (options["format"] as OutputFormat) || "default";
  if (format === "json") {
    process.env["NO_COLOR"] = "1";
  }

  // Handle limit
  const limitStr = options["limit"] as string | undefined;
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  // Handle since checkpoint
  const since = options["since"] as string | undefined;

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

  // Create tracker if git checkpoint is used
  let tracker;
  if (since) {
    const marker = parseCheckpoint(since);
    if (marker?.type === "git") {
      try {
        tracker = await createChangeTracker({ cwd: process.cwd() });
      } catch (err) {
        if (err instanceof NotInGitRepoError) {
          console.error(
            pc.red(`Error: Cannot use git checkpoint "${since}" - not in a git repository`),
          );
          console.error(pc.dim(`Directory: ${err.cwd}`));
        } else {
          const message = err instanceof Error ? err.message : String(err);
          console.error(pc.red(`Error: Failed to create git tracker for checkpoint "${since}"`));
          console.error(pc.dim(message));
        }
        process.exit(2);
      }
    }
  }

  // Execute query using shared command
  const result = await runQuery(workspace, queryStr, {
    limit,
    includeRawText: format === "raw",
    since,
    tracker,
  });

  if (!result) {
    console.error(pc.red(`Error: Invalid query syntax`));
    console.error(pc.dim(`Query: ${queryStr}`));
    process.exit(2);
  }

  // Handle validation errors
  if (isQueryValidationError(result)) {
    console.error(pc.red(`Error: ${result.message}`));
    process.exit(2);
  }

  // Handle checkpoint errors
  if (isCheckpointError(result)) {
    console.error(pc.red(`Error: ${result.message}`));
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
    json: {
      type: "boolean",
      description: "Output as JSON (shorthand for --format json)",
      default: false,
    },
    limit: {
      type: "string",
      short: "n",
      description: "Maximum number of results to show",
    },
    since: {
      type: "string",
      short: "s",
      description: "Only show entries since checkpoint (ts:2026-01-10T15:00Z or git:abc123)",
    },
  },
  action: queryAction,
};
