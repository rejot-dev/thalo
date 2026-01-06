import { parseArgs, type ParseArgsConfig } from "node:util";
import pc from "picocolors";

const VERSION = "0.1.0";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Option definition for a command
 */
export interface OptionDef {
  type: "boolean" | "string";
  short?: string;
  description: string;
  default?: string | boolean;
  choices?: string[];
  multiple?: boolean;
}

/**
 * Command definition
 */
export interface CommandDef {
  name: string;
  description: string;
  usage?: string;
  options?: Record<string, OptionDef>;
  args?: {
    name: string;
    description: string;
    required?: boolean;
    multiple?: boolean;
  };
  subcommands?: Record<string, CommandDef>;
  action?: (ctx: CommandContext) => void | Promise<void>;
}

/**
 * Parsed command context passed to action handlers
 */
export interface CommandContext {
  options: Record<string, string | boolean | string[]>;
  args: string[];
  command: CommandDef;
  commandPath: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Framework
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert our option definitions to node:util parseArgs config
 */
function toParseArgsConfig(options: Record<string, OptionDef>): ParseArgsConfig["options"] {
  const config: ParseArgsConfig["options"] = {};

  for (const [name, def] of Object.entries(options)) {
    const optConfig: NonNullable<ParseArgsConfig["options"]>[string] = {
      type: def.type,
    };

    if (def.short) {
      optConfig.short = def.short;
    }

    if (def.default !== undefined) {
      optConfig.default = def.default;
    }

    if (def.multiple !== undefined) {
      optConfig.multiple = def.multiple;
    }

    config[name] = optConfig;
  }

  return config;
}

/**
 * Global options available to all commands
 */
const globalOptions: Record<string, OptionDef> = {
  help: {
    type: "boolean",
    short: "h",
    description: "Show help for the command",
    default: false,
  },
  version: {
    type: "boolean",
    short: "V",
    description: "Show version number",
    default: false,
  },
  "no-color": {
    type: "boolean",
    description: "Disable colored output",
    default: false,
  },
};

/**
 * Generate help text for a command
 */
export function generateHelp(command: CommandDef, commandPath: string[] = []): string {
  const lines: string[] = [];
  const fullCommandName = commandPath.length > 0 ? commandPath.join(" ") : "ptall";

  // Header
  lines.push("");
  lines.push(pc.bold(command.description));
  lines.push("");

  // Usage
  lines.push(pc.bold("USAGE"));
  let usageLine = `  ${fullCommandName}`;

  if (command.subcommands && Object.keys(command.subcommands).length > 0) {
    usageLine += " <command>";
  }

  if (command.options && Object.keys(command.options).length > 0) {
    usageLine += " [options]";
  }

  if (command.args) {
    const argName = command.args.multiple ? `<${command.args.name}...>` : `<${command.args.name}>`;
    usageLine += command.args.required ? ` ${argName}` : ` [${argName}]`;
  }

  if (command.usage) {
    usageLine = `  ${fullCommandName} ${command.usage}`;
  }

  lines.push(usageLine);
  lines.push("");

  // Subcommands
  if (command.subcommands && Object.keys(command.subcommands).length > 0) {
    lines.push(pc.bold("COMMANDS"));

    const subcommandNames = Object.keys(command.subcommands);
    const maxLen = Math.max(...subcommandNames.map((n) => n.length));

    for (const [name, subcmd] of Object.entries(command.subcommands)) {
      const paddedName = name.padEnd(maxLen + 2);
      lines.push(`  ${pc.cyan(paddedName)}${subcmd.description}`);
    }

    lines.push("");
    lines.push(`  Run '${fullCommandName} <command> --help' for more information on a command.`);
    lines.push("");
  }

  // Options
  const allOptions = { ...globalOptions, ...command.options };
  if (Object.keys(allOptions).length > 0) {
    lines.push(pc.bold("OPTIONS"));

    const optionEntries = Object.entries(allOptions);
    const optionStrings = optionEntries.map(([name, def]) => {
      const shortFlag = def.short ? `-${def.short}, ` : "    ";
      const longFlag = `--${name}`;
      const valueHint =
        def.type === "string" ? ` <${def.choices ? def.choices.join("|") : "value"}>` : "";
      return `${shortFlag}${longFlag}${valueHint}`;
    });
    const maxOptLen = Math.max(...optionStrings.map((s) => s.length));

    for (let i = 0; i < optionEntries.length; i++) {
      const [, def] = optionEntries[i];
      const optStr = optionStrings[i].padEnd(maxOptLen + 2);
      let description = def.description;

      if (def.default !== undefined && def.default !== false && def.default !== "") {
        description += pc.dim(` (default: ${def.default})`);
      }

      lines.push(`  ${pc.dim(optStr)}${description}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Find a command by traversing the path
 */
function findCommand(
  root: CommandDef,
  args: string[],
): { command: CommandDef; commandPath: string[]; remainingArgs: string[] } {
  let current = root;
  const commandPath = ["ptall"];
  const remainingArgs = [...args];

  while (remainingArgs.length > 0) {
    const nextArg = remainingArgs[0];

    // Stop if it's an option
    if (nextArg.startsWith("-")) {
      break;
    }

    // Check if it's a subcommand
    if (current.subcommands && current.subcommands[nextArg]) {
      current = current.subcommands[nextArg];
      commandPath.push(nextArg);
      remainingArgs.shift();
    } else {
      // Not a subcommand, must be a positional arg
      break;
    }
  }

  return { command: current, commandPath, remainingArgs };
}

/**
 * Parse and run a command
 */
export function runCli(rootCommand: CommandDef, argv: string[] = process.argv.slice(2)): void {
  // Find the target command
  const { command, commandPath, remainingArgs } = findCommand(rootCommand, argv);

  // Merge global options with command options
  const allOptions = { ...globalOptions, ...command.options };
  const parseArgsOptions = toParseArgsConfig(allOptions);

  // Parse arguments
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: remainingArgs,
      options: parseArgsOptions,
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    if (err instanceof Error) {
      console.error(pc.red(`Error: ${err.message}`));
      console.error(`\nRun '${commandPath.join(" ")} --help' for usage information.`);
    }
    process.exit(2);
  }

  const { values, positionals } = parsed;

  // Handle no-color by setting env var (picocolors respects NO_COLOR)
  if (values["no-color"]) {
    process.env["NO_COLOR"] = "1";
  }

  // Handle version (only at root level)
  if (values["version"] && commandPath.length === 1) {
    console.log(`ptall v${VERSION}`);
    process.exit(0);
  }

  // Handle help
  if (values["help"]) {
    console.log(generateHelp(command, commandPath));
    process.exit(0);
  }

  // If command has subcommands but no action and no subcommand was specified, show help
  if (command.subcommands && Object.keys(command.subcommands).length > 0 && !command.action) {
    console.log(generateHelp(command, commandPath));
    process.exit(0);
  }

  // Run the command action
  if (command.action) {
    const ctx: CommandContext = {
      options: values as Record<string, string | boolean | string[]>,
      args: positionals,
      command,
      commandPath,
    };

    Promise.resolve(command.action(ctx)).catch((err) => {
      console.error(pc.red(`Error: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    });
  } else {
    console.log(generateHelp(command, commandPath));
    process.exit(0);
  }
}
