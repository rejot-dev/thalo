import { initParser } from "@rejot-dev/thalo/node";
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
 * When invoked without a subcommand, shows help
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
};

// Initialize parser (with WASM fallback if native bindings unavailable)
// then run the CLI
initParser()
  .then(() => {
    runCli(rootCommand);
  })
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to initialize parser: ${message}`);
    process.exit(1);
  });
