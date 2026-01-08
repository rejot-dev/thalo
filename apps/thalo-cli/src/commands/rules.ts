import { allRules, RULE_CATEGORIES, type RuleCategory, type Rule } from "@rejot-dev/thalo";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";

type SeverityKey = "error" | "warning" | "info";

const severityColor = {
  error: pc.red,
  warning: pc.yellow,
  info: pc.cyan,
} as const;

/**
 * Group rules by category and sort them
 */
function groupRulesByCategory(rules: Rule[]): Map<RuleCategory, Rule[]> {
  const grouped = new Map<RuleCategory, Rule[]>();

  // Initialize groups in order
  const sortedCategories = (Object.keys(RULE_CATEGORIES) as RuleCategory[]).sort(
    (a, b) => RULE_CATEGORIES[a].order - RULE_CATEGORIES[b].order,
  );

  for (const cat of sortedCategories) {
    grouped.set(cat, []);
  }

  // Group rules
  for (const rule of rules) {
    const existing = grouped.get(rule.category) ?? [];
    existing.push(rule);
    grouped.set(rule.category, existing);
  }

  // Sort rules within each category alphabetically by code
  for (const [cat, catRules] of grouped) {
    grouped.set(
      cat,
      catRules.sort((a, b) => a.code.localeCompare(b.code)),
    );
  }

  return grouped;
}

function listAction(ctx: CommandContext): void {
  const { options } = ctx;

  // Filter by severity if specified
  let filteredRules = allRules;
  if (options["severity"]) {
    filteredRules = allRules.filter((r) => r.defaultSeverity === options["severity"]);
  }

  // Filter by category if specified
  if (options["category"]) {
    filteredRules = filteredRules.filter((r) => r.category === options["category"]);
  }

  if (options["json"]) {
    const output = filteredRules.map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      category: r.category,
      defaultSeverity: r.defaultSeverity,
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log();
  console.log(pc.bold("Available Rules"));

  const maxCodeLen = Math.max(...filteredRules.map((r) => r.code.length));
  const grouped = groupRulesByCategory(filteredRules);

  for (const [category, rules] of grouped) {
    if (rules.length === 0) {
      continue;
    }

    const { label } = RULE_CATEGORIES[category];
    console.log();
    console.log(pc.cyan(pc.bold(`  ${label}`)));
    console.log();

    for (const rule of rules) {
      const color = severityColor[rule.defaultSeverity as SeverityKey] ?? pc.dim;
      const code = rule.code.padEnd(maxCodeLen);
      const severity = color(rule.defaultSeverity.padEnd(7));
      console.log(`    ${pc.bold(code)}  ${severity}  ${pc.dim(rule.description)}`);
    }
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
    category: {
      type: "string",
      short: "c",
      description: "Filter by category",
      choices: ["instance", "link", "schema", "metadata", "content"],
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
