import * as fs from "node:fs";
import {
  formatQuery,
  findAllSyntheses,
  findLatestActualize,
  findEntryFile,
  getEntrySourceText,
  generateInstructions,
  DEFAULT_INSTRUCTIONS_TEMPLATE,
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
import { resolveFilesSync, loadWorkspaceSync, relativePath } from "../files.js";

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

async function actualizeAction(ctx: CommandContext): Promise<void> {
  const { args, options } = ctx;
  const instructionsTemplate = (options["instructions"] as string) || DEFAULT_INSTRUCTIONS_TEMPLATE;

  // Determine target paths
  const targetPaths = args.length > 0 ? args : ["."];

  // Collect and load files
  const files = resolveFilesSync(targetPaths);
  if (files.length === 0) {
    console.log("No .thalo or .md files found.");
    process.exit(0);
  }

  const workspace = loadWorkspaceSync(files);

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
    const checkpointValue = formatCheckpoint(currentMarker);
    const instructions = generateInstructions(instructionsTemplate, {
      file: relativePath(synthesis.file),
      linkId: synthesis.linkId,
      checkpoint: checkpointValue,
    });

    console.log();
    console.log(pc.bold("--- Instructions ---"));
    console.log(instructions);
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
  options: {
    instructions: {
      type: "string",
      short: "i",
      description: "Custom instructions template. Use placeholders: {file}, {linkId}, {checkpoint}",
    },
  },
  action: actualizeAction,
};
