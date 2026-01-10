import * as fs from "node:fs";
import { mergeThaloFiles } from "@rejot-dev/thalo";
import type { CommandDef, CommandContext } from "../cli.js";
import pc from "picocolors";

/**
 * Git merge driver command
 *
 * Called by Git with: thalo merge-driver %O %A %B %P
 * - %O = base file (common ancestor)
 * - %A = ours file (current/local version) - MODIFIED IN PLACE
 * - %B = theirs file (incoming version)
 * - %P = path in repository (for display)
 *
 * Exit codes:
 * - 0: Clean merge (no conflicts)
 * - 1: Conflicts detected
 * - 2: Fatal error (file read/write failure)
 */
async function mergeDriverAction(ctx: CommandContext): Promise<void> {
  const { args, options } = ctx;

  if (args.length < 3) {
    console.error(pc.red("Error: merge-driver requires 3 file arguments"));
    console.error("Usage: thalo merge-driver <base> <ours> <theirs> [<path>]");
    process.exit(2);
  }

  const [basePath, oursPath, theirsPath] = args;
  const repoPath = args[3] || oursPath;

  let base: string, ours: string, theirs: string;
  try {
    [base, ours, theirs] = await Promise.all([
      fs.promises.readFile(basePath, "utf-8"),
      fs.promises.readFile(oursPath, "utf-8"),
      fs.promises.readFile(theirsPath, "utf-8"),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`Error reading files: ${message}`));
    process.exit(2);
  }

  const showBase = options["diff3"] as boolean;
  const result = mergeThaloFiles(base, ours, theirs, {
    showBase,
    markerStyle: showBase ? "diff3" : "git",
  });

  try {
    await fs.promises.writeFile(oursPath, result.content, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`Error writing merged file: ${message}`));
    process.exit(2);
  }

  if (!options["quiet"]) {
    if (result.success) {
      console.log(pc.green(`✓ Auto-merged ${repoPath}`));
      console.log(
        pc.dim(`  ${result.stats.totalEntries} entries, ${result.stats.autoMerged} auto-merged`),
      );
    } else {
      console.log(pc.yellow(`⚠ Conflicts in ${repoPath}`));
      console.log(pc.dim(`  ${result.conflicts.length} conflict(s) to resolve`));

      if (options["verbose"]) {
        console.log();
        for (const conflict of result.conflicts) {
          console.log(`  ${pc.yellow("•")} ${conflict.message}`);
        }
      }
    }
  }

  process.exit(result.success ? 0 : 1);
}

export const mergeDriverCommand: CommandDef = {
  name: "merge-driver",
  description: "Git merge driver for thalo files (internal use)",
  args: {
    name: "files",
    description: "Base, ours, theirs, and optional path",
    required: true,
    multiple: true,
  },
  options: {
    quiet: {
      type: "boolean",
      short: "q",
      description: "Suppress output",
      default: false,
    },
    verbose: {
      type: "boolean",
      short: "v",
      description: "Show detailed conflict information",
      default: false,
    },
    diff3: {
      type: "boolean",
      description: "Use diff3 conflict style (show base)",
      default: false,
    },
  },
  action: mergeDriverAction,
};
