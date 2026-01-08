import * as fs from "node:fs";
import * as path from "node:path";
import {
  Workspace,
  executeQueries,
  formatQuery,
  type ModelSynthesisEntry,
  type ModelActualizeEntry,
  type ModelInstanceEntry,
} from "@rejot-dev/thalo";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";

/**
 * Collect all thalo and markdown files from a directory
 */
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

/**
 * Resolve file paths from command arguments
 */
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

/**
 * Load workspace from files
 */
function loadWorkspace(files: string[]): Workspace {
  const workspace = new Workspace();

  for (const file of files) {
    try {
      const source = fs.readFileSync(file, "utf-8");
      workspace.addDocument(source, { filename: file });
    } catch (err) {
      console.error(pc.red(`Error reading ${file}: ${err instanceof Error ? err.message : err}`));
    }
  }

  return workspace;
}

/**
 * Find all synthesis definitions in the workspace
 */
function findSyntheses(workspace: Workspace): ModelSynthesisEntry[] {
  const syntheses: ModelSynthesisEntry[] = [];

  for (const doc of workspace.allDocuments()) {
    syntheses.push(...doc.synthesisEntries);
  }

  return syntheses;
}

/**
 * Find the latest actualize entry for a synthesis
 */
function findLatestActualize(
  workspace: Workspace,
  synthesisLinkId: string,
): ModelActualizeEntry | null {
  let latest: ModelActualizeEntry | null = null;

  for (const doc of workspace.allDocuments()) {
    for (const entry of doc.actualizeEntries) {
      if (entry.target === synthesisLinkId) {
        if (!latest || entry.timestamp > latest.timestamp) {
          latest = entry;
        }
      }
    }
  }

  return latest;
}

/**
 * Get the 'updated' timestamp from an actualize entry
 */
function getUpdatedTimestamp(actualize: ModelActualizeEntry | null): string | null {
  if (!actualize) {
    return null;
  }
  return actualize.metadata.get("updated")?.raw ?? null;
}

/**
 * Get raw entry text from source file
 */
function getEntryRawText(entry: ModelInstanceEntry): string {
  try {
    const source = fs.readFileSync(entry.file, "utf-8");
    const start = entry.location.startIndex;
    const end = entry.location.endIndex;
    return source.slice(start, end).trim();
  } catch {
    return `[Could not read entry from ${entry.file}]`;
  }
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

function actualizeAction(ctx: CommandContext): void {
  const { args } = ctx;

  // Determine target paths
  const targetPaths = args.length > 0 ? args : ["."];

  // Collect and load files
  const files = resolveFiles(targetPaths);
  if (files.length === 0) {
    console.log("No .thalo or .md files found.");
    process.exit(0);
  }

  const workspace = loadWorkspace(files);

  // Find all synthesis definitions
  const syntheses = findSyntheses(workspace);

  if (syntheses.length === 0) {
    console.log(pc.dim("No synthesis definitions found."));
    process.exit(0);
  }

  let hasOutput = false;

  for (const synthesis of syntheses) {
    // Find latest actualize entry
    const lastActualize = findLatestActualize(workspace, synthesis.linkId);
    const lastUpdated = getUpdatedTimestamp(lastActualize);

    // Query for new entries
    const newEntries = executeQueries(workspace, synthesis.sources, {
      afterTimestamp: lastUpdated,
    });

    if (newEntries.length === 0) {
      console.log(pc.green(`✓ ${relativePath(synthesis.file)}: ${synthesis.title} - up to date`));
      continue;
    }

    hasOutput = true;

    // Output synthesis header
    console.log();
    console.log(
      pc.bold(pc.cyan(`=== Synthesis: ${synthesis.title} (${relativePath(synthesis.file)}) ===`)),
    );
    console.log(`Target: ${pc.yellow(`^${synthesis.linkId}`)}`);
    console.log(`Sources: ${synthesis.sources.map(formatQuery).join(", ")}`);
    if (lastUpdated) {
      console.log(`Last updated: ${pc.dim(lastUpdated)}`);
    }

    // Output prompt
    console.log();
    console.log(pc.bold("--- User Prompt ---"));
    console.log(synthesis.prompt || pc.dim("(no prompt defined)"));

    // Output new entries
    console.log();
    console.log(pc.bold(`--- New Entries (${newEntries.length}) ---`));
    for (const entry of newEntries) {
      console.log();
      console.log(getEntryRawText(entry));
    }

    // Output instructions
    console.log();
    console.log(pc.bold("--- Instructions ---"));
    console.log(
      `1. Update the content directly below the \`\`\`thalo block in ${relativePath(synthesis.file)}`,
    );
    console.log(`2. Place output BEFORE any subsequent \`\`\`thalo blocks`);
    console.log(
      `3. Append to the thalo block: ${pc.cyan(`actualize-synthesis ^${synthesis.linkId}`)}`,
    );
    console.log(`   with metadata: ${pc.cyan("updated: <current-timestamp>")}`);
    console.log();
    console.log(pc.dim("─".repeat(60)));
  }

  if (!hasOutput) {
    console.log();
    console.log(pc.green("All syntheses are up to date."));
  }
}

export const actualizeCommand: CommandDef = {
  name: "actualize",
  description: "Output prompts and entries for pending synthesis updates",
  args: {
    name: "paths",
    description: "Files or directories to check for syntheses",
    required: false,
    multiple: true,
  },
  options: {},
  action: actualizeAction,
};
