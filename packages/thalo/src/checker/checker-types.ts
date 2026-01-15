import type { Location } from "../ast/ast-types.js";
import type { SourceMap } from "../source-map.js";

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
  /** Location in the source (file-absolute) */
  location: Location;
  /** Additional data for the diagnostic (rule-specific) */
  data?: Record<string, unknown>;
}

/**
 * Partial diagnostic with optional sourceMap for position mapping
 */
export interface PartialDiagnostic {
  /** Human-readable message */
  message: string;
  /** File path where the issue was found */
  file: string;
  /** Location in the source (block-relative) */
  location: Location;
  /** Source map for converting block-relative to file-absolute positions */
  sourceMap?: SourceMap;
  /** Additional data for the diagnostic (rule-specific) */
  data?: Record<string, unknown>;
}

/**
 * Rule scope - determines when a rule needs to re-run.
 *
 * - "entry": Rule only looks at individual entries, can run incrementally on changed entries
 * - "document": Rule looks at entries within a single document, runs on full document
 * - "workspace": Rule looks across multiple documents, runs on full workspace
 */
export type RuleScope = "entry" | "document" | "workspace";

/**
 * Dependency declaration for a rule.
 * Used for incremental checking to determine when a rule needs to re-run.
 */
export interface RuleDependencies {
  /** Rule scope - determines when rule needs to re-run */
  scope: RuleScope;
  /** Rule needs schema registry data */
  schemas?: boolean;
  /** Rule needs link index data */
  links?: boolean;
  /** Entity names this rule cares about (for targeted invalidation) */
  entities?: "all" | string[];
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

  /**
   * Dependency declaration for incremental checking.
   */
  dependencies: RuleDependencies;

  /**
   * Visitor-based implementation.
   * Allows single-pass checking with other rules.
   */
  visitor: import("./visitor.js").RuleVisitor;
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
