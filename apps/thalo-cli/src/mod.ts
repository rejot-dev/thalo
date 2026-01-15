import { runCli, type CommandDef } from "./cli.js";
import { actualizeCommand } from "./commands/actualize.js";
import { checkCommand } from "./commands/check.js";
import { formatCommand } from "./commands/format.js";
import { initCommand } from "./commands/init.js";
import { lspCommand } from "./commands/lsp.js";
import { queryCommand } from "./commands/query.js";
import { rulesCommand } from "./commands/rules.js";
import { mergeDriverCommand } from "./commands/merge-driver.js";
import { setupMergeDriverCommand } from "./commands/setup-merge-driver.js";

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
    format: formatCommand,
    init: initCommand,
    lsp: lspCommand,
    query: queryCommand,
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
