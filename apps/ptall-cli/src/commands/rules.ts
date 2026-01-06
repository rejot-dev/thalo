import { allRules } from "@wilco/ptall";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";

type SeverityKey = "error" | "warning" | "info";

const severityColor = {
  error: pc.red,
  warning: pc.yellow,
  info: pc.cyan,
} as const;

function listAction(ctx: CommandContext): void {
  const { options } = ctx;

  console.log();
  console.log(pc.bold("Available Rules"));
  console.log();

  const maxCodeLen = Math.max(...allRules.map((r) => r.code.length));

  // Filter by severity if specified
  let filteredRules = allRules;
  if (options["severity"]) {
    filteredRules = allRules.filter((r) => r.defaultSeverity === options["severity"]);
  }

  if (options["json"]) {
    const output = filteredRules.map((r) => ({
      code: r.code,
      name: r.name,
      defaultSeverity: r.defaultSeverity,
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  for (const rule of filteredRules) {
    const color = severityColor[rule.defaultSeverity as SeverityKey] ?? pc.dim;
    const code = rule.code.padEnd(maxCodeLen);
    const severity = color(rule.defaultSeverity.padEnd(7));
    console.log(`  ${pc.bold(code)}  ${severity}  ${rule.name}`);
  }

  console.log();
  console.log(pc.dim(`Total: ${filteredRules.length} rules`));
  console.log();
}

const listSubcommand: CommandDef = {
  name: "list",
  description: "List all available rules",
  options: {
    severity: {
      type: "string",
      short: "s",
      description: "Filter by severity level",
      choices: ["error", "warning", "info"],
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
  },
  action: listAction,
};

export const rulesCommand: CommandDef = {
  name: "rules",
  description: "Manage and inspect linting rules",
  subcommands: {
    list: listSubcommand,
  },
};
