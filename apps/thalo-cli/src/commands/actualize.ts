import {
  runActualize,
  generateInstructions,
  generateTimestamp,
  DEFAULT_INSTRUCTIONS_TEMPLATE,
  type SynthesisOutputInfo,
} from "@rejot-dev/thalo";
import { formatCheckpoint } from "@rejot-dev/thalo/change-tracker";
import { createChangeTracker, UncommittedChangesError } from "@rejot-dev/thalo/change-tracker/node";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";
import { loadFullWorkspace, relativePath } from "../files.js";

/**
 * Format a synthesis that is up to date.
 */
function formatUpToDate(synthesis: SynthesisOutputInfo): string {
  return pc.green(`✓ ${relativePath(synthesis.file)}: ${synthesis.title} - up to date`);
}

/**
 * Format a synthesis with pending entries.
 */
function formatSynthesisWithEntries(
  synthesis: SynthesisOutputInfo,
  instructionsTemplate: string,
): string {
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(
    pc.bold(pc.cyan(`=== Synthesis: ${synthesis.title} (${relativePath(synthesis.file)}) ===`)),
  );
  lines.push(`Target: ${pc.yellow(`^${synthesis.linkId}`)}`);
  lines.push(`Sources: ${synthesis.sources.join(", ")}`);

  if (synthesis.lastCheckpoint) {
    const markerDisplay =
      synthesis.lastCheckpoint.type === "git"
        ? `git:${synthesis.lastCheckpoint.value.slice(0, 7)}`
        : formatCheckpoint(synthesis.lastCheckpoint);
    lines.push(`Last checkpoint: ${pc.dim(markerDisplay)}`);
  }

  // Prompt
  lines.push("");
  lines.push(pc.bold("--- User Prompt ---"));
  lines.push(synthesis.prompt || pc.dim("(no prompt defined)"));

  // Entries
  lines.push("");
  lines.push(pc.bold(`--- Changed Entries (${synthesis.entries.length}) ---`));
  for (const entry of synthesis.entries) {
    lines.push("");
    lines.push(entry.rawText);
  }

  // Instructions
  const checkpointValue = formatCheckpoint(synthesis.currentCheckpoint);
  const instructions = generateInstructions(instructionsTemplate, {
    file: relativePath(synthesis.file),
    linkId: synthesis.linkId,
    checkpoint: checkpointValue,
    timestamp: generateTimestamp(),
  });

  lines.push("");
  lines.push(pc.bold("--- Instructions ---"));
  lines.push(instructions);
  lines.push("");
  lines.push(pc.dim("─".repeat(60)));

  return lines.join("\n");
}

async function actualizeAction(ctx: CommandContext): Promise<void> {
  const { args, options } = ctx;
  const instructionsTemplate = (options["instructions"] as string) || DEFAULT_INSTRUCTIONS_TEMPLATE;
  const force = options["force"] as boolean;

  // Load full workspace from CWD
  const { workspace, files } = await loadFullWorkspace();
  if (files.length === 0) {
    console.log("No .thalo or .md files found.");
    process.exit(0);
  }

  // Create change tracker (auto-detects git)
  const tracker = await createChangeTracker({ cwd: process.cwd(), force });

  // Run actualize command
  let result;
  try {
    result = await runActualize(workspace, {
      targetLinkIds: args.length > 0 ? args : undefined,
      tracker,
    });
  } catch (error) {
    if (error instanceof UncommittedChangesError) {
      console.error(pc.red("Error: Source files have uncommitted changes:"));
      for (const file of error.files) {
        console.error(pc.yellow(`  - ${file}`));
      }
      console.error();
      console.error(pc.dim("Commit your changes or use --force to proceed anyway."));
      console.error(
        pc.dim("Note: Using --force may cause already-processed entries to appear again."),
      );
      process.exit(1);
    }
    throw error;
  }

  // Show tracker type
  if (result.trackerType === "git") {
    console.log(pc.dim("Using git-based change tracking"));
  }

  // Warn about not found link IDs
  for (const id of result.notFoundLinkIds) {
    console.error(pc.yellow(`Warning: No synthesis found with link ID: ^${id}`));
  }

  // Exit early if we filtered to specific IDs but found none
  if (args.length > 0 && result.syntheses.length === 0 && result.notFoundLinkIds.length > 0) {
    process.exit(1);
  }

  if (result.syntheses.length === 0) {
    console.log(pc.dim("No synthesis definitions found."));
    process.exit(0);
  }

  // Output results
  let hasOutput = false;
  for (const synthesis of result.syntheses) {
    if (synthesis.isUpToDate) {
      console.log(formatUpToDate(synthesis));
    } else {
      hasOutput = true;
      console.log(formatSynthesisWithEntries(synthesis, instructionsTemplate));
    }
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
    name: "links",
    description:
      "Link IDs of synthesis definitions to actualize (e.g., ^my-synthesis). If omitted, all syntheses are checked.",
    required: false,
    multiple: true,
  },
  options: {
    instructions: {
      type: "string",
      short: "i",
      description: "Custom instructions template. Use placeholders: {file}, {linkId}, {checkpoint}",
    },
    force: {
      type: "boolean",
      short: "f",
      description:
        "Proceed even if source files have uncommitted changes. May cause duplicate processing.",
    },
  },
  action: actualizeAction,
};
