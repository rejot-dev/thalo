import type { Location } from "../ast/types.js";
import type { Workspace } from "../model/workspace.js";
import type { Document } from "../model/document.js";

/**
 * Severity levels for diagnostics
 */
export type Severity = "error" | "warning" | "info" | "off";

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
