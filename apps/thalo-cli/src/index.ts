import { runCli, type CommandDef } from "./cli.js";
import {
  actualizeCommand,
  checkCommand,
  initCommand,
  rulesCommand,
  mergeDriverCommand,
  setupMergeDriverCommand,
} from "./commands/index.js";

/**
 * Root command definition
 *
 * When invoked without a subcommand, defaults to 'check' behavior
 */
const rootCommand: CommandDef = {
  name: "thalo",
  description: "Lint and check thalo files",
  subcommands: {
    actualize: actualizeCommand,
    check: checkCommand,
    init: initCommand,
    rules: rulesCommand,
    "merge-driver": mergeDriverCommand,
    "setup-merge-driver": setupMergeDriverCommand,
  },
  // Default action when no subcommand is provided - run check
  action: checkCommand.action,
  args: checkCommand.args,
  options: checkCommand.options,
};

runCli(rootCommand);
