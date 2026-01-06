import { runCli, type CommandDef } from "./cli.js";
import { checkCommand, rulesCommand } from "./commands/index.js";

/**
 * Root command definition
 *
 * When invoked without a subcommand, defaults to 'check' behavior
 */
const rootCommand: CommandDef = {
  name: "ptall",
  description: "Lint and check ptall files",
  subcommands: {
    check: checkCommand,
    rules: rulesCommand,
  },
  // Default action when no subcommand is provided - run check
  action: checkCommand.action,
  args: checkCommand.args,
  options: checkCommand.options,
};

runCli(rootCommand);
