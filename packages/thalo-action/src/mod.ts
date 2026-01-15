/**
 * Entry point for the Thalo Synthesis GitHub Action.
 */

import * as core from "@actions/core";
import { runSynthesisAction } from "./action.js";

/**
 * Parse inputs from the GitHub Action context.
 */
function parseInputs() {
  return {
    githubToken: core.getInput("github-token", { required: true }),
    command: core.getInput("command", { required: true }),
    syntheses: core
      .getInput("syntheses")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    workingDirectory: core.getInput("working-directory") || ".",
    branchName: core.getInput("branch-name") || "thalo/update-syntheses",
    prTitle: core.getInput("pr-title") || "Update Thalo Syntheses",
    commitMessage: core.getInput("commit-message") || "chore: update syntheses",
    baseBranch: core.getInput("base-branch") || "main",
  };
}

/**
 * Main entry point for the action.
 */
async function run(): Promise<void> {
  try {
    const inputs = parseInputs();

    core.info("Starting Thalo Synthesis action");
    core.info(`Working directory: ${inputs.workingDirectory}`);
    core.info(`Command: ${inputs.command}`);

    if (inputs.syntheses.length > 0) {
      core.info(`Targeting syntheses: ${inputs.syntheses.join(", ")}`);
    } else {
      core.info("Processing all syntheses");
    }

    await runSynthesisAction(inputs);

    core.info("Thalo Synthesis action completed successfully");
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

run();
