import type { Location } from "../ast/types.js";
import type { Workspace } from "../model/workspace.js";
import type { Document } from "../model/document.js";

/**
 * Severity levels for diagnostics
 */
export type Severity = "error" | "warning" | "info" | "off";

/**
 * Rule categories for grouping related rules
 */
export type RuleCategory = "instance" | "link" | "schema" | "metadata" | "content";

/**
 * Display order and labels for rule categories
 */
export const RULE_CATEGORIES: Record<RuleCategory, { order: number; label: string }> = {
  instance: { order: 1, label: "Instance Entry Rules" },
  link: { order: 2, label: "Link Rules" },
  schema: { order: 3, label: "Schema Definition Rules" },
  metadata: { order: 4, label: "Metadata Value Rules" },
  content: { order: 5, label: "Content Rules" },
};

/**
 * A diagnostic message from the checker
 */
export interface Diagnostic {
  /** The rule code that generated this diagnostic */
  code: string;
  /** Severity level */
  severity: Exclude<Severity, "off">;
  /** Human-readable message */
  message: string;
  /** File path where the issue was found */
  file: string;
  /** Location in the source */
  location: Location;
  /** Additional data for the diagnostic (rule-specific) */
  data?: Record<string, unknown>;
}

/**
 * Context provided to rules during checking
 */
export interface CheckContext {
  /** The workspace being checked */
  workspace: Workspace;
  /** The document being checked (for document-scoped rules) */
  document?: Document;
  /** Report a diagnostic */
  report(diagnostic: Omit<Diagnostic, "code" | "severity">): void;
}

/**
 * A validation rule
 */
export interface Rule {
  /** Unique rule code (e.g., "unknown-entity") */
  code: string;
  /** Human-readable rule name */
  name: string;
  /** Short description of what this rule checks */
  description: string;
  /** Category for grouping related rules */
  category: RuleCategory;
  /** Default severity for this rule */
  defaultSeverity: Severity;
  /** Run the rule and report diagnostics */
  check(ctx: CheckContext): void;
}

/**
 * Configuration for the checker
 */
export interface CheckConfig {
  /** Override severity for specific rules */
  rules?: Partial<Record<string, Severity>>;
}

/**
 * Get the effective severity for a rule given a config
 */
export function getEffectiveSeverity(rule: Rule, config: CheckConfig): Severity {
  return config.rules?.[rule.code] ?? rule.defaultSeverity;
}
