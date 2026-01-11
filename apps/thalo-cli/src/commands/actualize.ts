import * as fs from "node:fs";
import * as path from "node:path";
import {
  Workspace,
  formatQuery,
  findAllSyntheses,
  findLatestActualize,
  findEntryFile,
  getEntrySourceText,
  type InstanceEntry,
  type ActualizeInfo,
} from "@rejot-dev/thalo";
import {
  createChangeTracker,
  parseCheckpoint,
  formatCheckpoint,
  type ChangeMarker,
} from "@rejot-dev/thalo/change-tracker";
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
 * Get the change marker from an actualize entry.
 * Reads from the checkpoint metadata field.
 */
function getActualizeMarker(actualize: ActualizeInfo | null): ChangeMarker | null {
  if (!actualize) {
    return null;
  }
  const checkpoint = actualize.entry.metadata.find((m) => m.key.value === "checkpoint");
  return parseCheckpoint(checkpoint?.value.raw);
}

/**
 * Get raw entry text from source file (CLI-specific with filesystem access)
 */
function getEntryRawText(entry: InstanceEntry, file: string): string {
  try {
    const source = fs.readFileSync(file, "utf-8");
    return getEntrySourceText(entry, source);
  } catch {
    return `[Could not read entry from ${file}]`;
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

async function actualizeAction(ctx: CommandContext): Promise<void> {
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

  // Create change tracker (auto-detects git)
  const tracker = await createChangeTracker({ cwd: process.cwd() });
  const isGitMode = tracker.type === "git";

  if (isGitMode) {
    console.log(pc.dim("Using git-based change tracking"));
  }

  // Find all synthesis definitions
  const syntheses = findAllSyntheses(workspace);

  if (syntheses.length === 0) {
    console.log(pc.dim("No synthesis definitions found."));
    process.exit(0);
  }

  let hasOutput = false;

  for (const synthesis of syntheses) {
    // Find latest actualize entry
    const lastActualize = findLatestActualize(workspace, synthesis.linkId);
    const lastMarker = getActualizeMarker(lastActualize);

    // Get changed entries using the tracker
    const { entries: newEntries, currentMarker } = await tracker.getChangedEntries(
      workspace,
      synthesis.sources,
      lastMarker,
    );

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
    if (lastMarker) {
      const markerDisplay =
        lastMarker.type === "git"
          ? `git:${lastMarker.value.slice(0, 7)}`
          : formatCheckpoint(lastMarker);
      console.log(`Last checkpoint: ${pc.dim(markerDisplay)}`);
    }

    // Output prompt
    console.log();
    console.log(pc.bold("--- User Prompt ---"));
    console.log(synthesis.prompt || pc.dim("(no prompt defined)"));

    // Output new entries
    console.log();
    console.log(pc.bold(`--- Changed Entries (${newEntries.length}) ---`));
    for (const entry of newEntries) {
      const entryFile = findEntryFile(workspace, entry);
      console.log();
      if (!entryFile) {
        console.log(pc.dim("[Could not locate entry file]"));
        continue;
      }
      console.log(getEntryRawText(entry, entryFile));
    }

    // Output instructions with checkpoint metadata
    console.log();
    console.log(pc.bold("--- Instructions ---"));
    console.log(
      `1. Update the content directly below the \`\`\`thalo block in ${relativePath(synthesis.file)}`,
    );
    console.log(`2. Place output BEFORE any subsequent \`\`\`thalo blocks`);
    console.log(
      `3. Append to the thalo block: ${pc.cyan(`actualize-synthesis ^${synthesis.linkId}`)}`,
    );

    // Format checkpoint
    const checkpointValue = formatCheckpoint(currentMarker);
    console.log(`   with metadata: ${pc.cyan(`checkpoint: "${checkpointValue}"`)}`);
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
