import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { CommandDef, CommandContext } from "../cli.js";
import pc from "picocolors";

const execFile = promisify(execFileCallback);

/**
 * Setup merge driver command
 *
 * Configures Git to use the thalo merge driver for .thalo files
 */
async function setupMergeDriverAction(ctx: CommandContext): Promise<void> {
  const { options } = ctx;
  const isGlobal = options["global"] as boolean;
  const checkOnly = options["check"] as boolean;
  const uninstall = options["uninstall"] as boolean;

  if (checkOnly) {
    await checkConfiguration(isGlobal);
    return;
  }

  if (uninstall) {
    await uninstallConfiguration(isGlobal);
    return;
  }

  if (!isGlobal) {
    if (!(await isGitRepository())) {
      console.error(pc.red("Error: Not in a git repository"));
      console.error(
        pc.dim(
          "Run this command from a git repository, or use --global for system-wide configuration",
        ),
      );
      process.exit(1);
    }
  }

  console.log(
    pc.blue(`Configuring thalo merge driver ${isGlobal ? "globally" : "for this repository"}...`),
  );
  console.log();

  try {
    await configureGit(isGlobal);

    if (!isGlobal) {
      await configureGitAttributes();
    }

    console.log();
    console.log(pc.green("✓ Thalo merge driver configured successfully"));
    console.log();
    console.log(pc.bold("Configuration:"));
    if (isGlobal) {
      console.log(pc.dim("  • Git config: ~/.gitconfig"));
      console.log(
        pc.dim(
          "  • You still need to add '*.thalo merge=thalo' to .gitattributes in each repository",
        ),
      );
    } else {
      console.log(pc.dim("  • Git config: .git/config"));
      console.log(pc.dim("  • Git attributes: .gitattributes"));
    }
    console.log();
    console.log(pc.dim("The merge driver will now be used for *.thalo files during git merge"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`Error: ${message}`));
    process.exit(1);
  }
}

/**
 * Check if we're in a git repository
 */
async function isGitRepository(): Promise<boolean> {
  try {
    await execFile("git", ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Configure git config for the merge driver
 */
async function configureGit(isGlobal: boolean): Promise<void> {
  console.log(pc.dim("Configuring git merge driver..."));

  const baseArgs = isGlobal ? ["config", "--global"] : ["config"];

  try {
    await execFile("git", [...baseArgs, "merge.thalo.name", "Thalo semantic merge driver"]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to set merge.thalo.name: ${message}`);
  }

  try {
    await execFile("git", [...baseArgs, "merge.thalo.driver", "thalo merge-driver %O %A %B %P"]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to set merge.thalo.driver: ${message}`);
  }

  console.log(pc.green("  ✓ Git config updated"));
}

/**
 * Configure .gitattributes for thalo files
 */
async function configureGitAttributes(): Promise<void> {
  console.log(pc.dim("Configuring .gitattributes..."));

  const attributesPath = path.join(process.cwd(), ".gitattributes");
  const attributeLine = "*.thalo merge=thalo";

  let content = "";
  try {
    content = await fs.readFile(attributesPath, "utf-8");
  } catch {
    // File doesn't exist, will be created
  }

  if (content.includes(attributeLine)) {
    console.log(pc.green("  ✓ .gitattributes already configured"));
    return;
  }

  const newContent = content.trim()
    ? `${content.trim()}\n${attributeLine}\n`
    : `${attributeLine}\n`;
  await fs.writeFile(attributesPath, newContent, "utf-8");

  console.log(pc.green("  ✓ .gitattributes updated"));
}

/**
 * Check current configuration
 */
async function checkConfiguration(isGlobal: boolean): Promise<void> {
  const scope = isGlobal ? "global" : "local";
  console.log(pc.blue(`Checking ${scope} merge driver configuration...`));
  console.log();

  const baseArgs = isGlobal ? ["config", "--global"] : ["config"];

  try {
    const { stdout: name } = await execFile("git", [...baseArgs, "merge.thalo.name"]);
    console.log(pc.green(`✓ merge.thalo.name: ${name.trim()}`));
  } catch {
    console.log(pc.red("✗ merge.thalo.name: not configured"));
  }

  try {
    const { stdout: driver } = await execFile("git", [...baseArgs, "merge.thalo.driver"]);
    console.log(pc.green(`✓ merge.thalo.driver: ${driver.trim()}`));
  } catch {
    console.log(pc.red("✗ merge.thalo.driver: not configured"));
  }

  if (!isGlobal) {
    const attributesPath = path.join(process.cwd(), ".gitattributes");
    try {
      const content = await fs.readFile(attributesPath, "utf-8");
      if (content.includes("*.thalo merge=thalo")) {
        console.log(pc.green("✓ .gitattributes: configured"));
      } else {
        console.log(pc.yellow("⚠ .gitattributes: not configured"));
      }
    } catch {
      console.log(pc.yellow("⚠ .gitattributes: file not found"));
    }
  }
}

/**
 * Uninstall configuration
 */
async function uninstallConfiguration(isGlobal: boolean): Promise<void> {
  console.log(pc.blue(`Removing ${isGlobal ? "global" : "local"} merge driver configuration...`));
  console.log();

  const baseArgs = isGlobal ? ["config", "--global", "--unset"] : ["config", "--unset"];

  try {
    await execFile("git", [...baseArgs, "merge.thalo.name"]);
    console.log(pc.green("✓ Removed merge.thalo.name"));
  } catch {
    console.log(pc.dim("  merge.thalo.name not found"));
  }

  try {
    await execFile("git", [...baseArgs, "merge.thalo.driver"]);
    console.log(pc.green("✓ Removed merge.thalo.driver"));
  } catch {
    console.log(pc.dim("  merge.thalo.driver not found"));
  }

  if (!isGlobal) {
    const attributesPath = path.join(process.cwd(), ".gitattributes");
    try {
      let content = await fs.readFile(attributesPath, "utf-8");
      const originalContent = content;
      content = content.replace(/^\*\.thalo merge=thalo\n?/gm, "");

      if (content !== originalContent) {
        await fs.writeFile(attributesPath, content, "utf-8");
        console.log(pc.green("✓ Removed from .gitattributes"));
      } else {
        console.log(pc.dim("  .gitattributes entry not found"));
      }
    } catch {
      // File doesn't exist, nothing to do
    }
  }

  console.log();
  console.log(pc.green("✓ Merge driver configuration removed"));
}

export const setupMergeDriverCommand: CommandDef = {
  name: "setup-merge-driver",
  description: "Configure Git to use the thalo merge driver",
  options: {
    global: {
      type: "boolean",
      short: "g",
      description: "Configure globally in ~/.gitconfig",
      default: false,
    },
    check: {
      type: "boolean",
      description: "Check if merge driver is configured",
      default: false,
    },
    uninstall: {
      type: "boolean",
      description: "Remove merge driver configuration",
      default: false,
    },
  },
  action: setupMergeDriverAction,
};
