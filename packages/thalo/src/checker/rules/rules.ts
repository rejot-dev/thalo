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
  visitor: import("../visitor.js").RuleVisitor;
}

// Existing rules
import { unknownEntityRule } from "./unknown-entity.js";
import { missingRequiredFieldRule } from "./missing-required-field.js";
import { unknownFieldRule } from "./unknown-field.js";
import { invalidFieldTypeRule } from "./invalid-field-type.js";
import { missingRequiredSectionRule } from "./missing-required-section.js";
import { unknownSectionRule } from "./unknown-section.js";
import { unresolvedLinkRule } from "./unresolved-link.js";
import { duplicateLinkIdRule } from "./duplicate-link-id.js";

// Schema definition rules
import { duplicateEntityDefinitionRule } from "./duplicate-entity-definition.js";
import { alterUndefinedEntityRule } from "./alter-undefined-entity.js";
import { alterBeforeDefineRule } from "./alter-before-define.js";
import { duplicateFieldInSchemaRule } from "./duplicate-field-in-schema.js";
import { duplicateSectionInSchemaRule } from "./duplicate-section-in-schema.js";
import { removeUndefinedFieldRule } from "./remove-undefined-field.js";
import { removeUndefinedSectionRule } from "./remove-undefined-section.js";
import { invalidDefaultValueRule } from "./invalid-default-value.js";
import { defineEntityRequiresSectionRule } from "./define-entity-requires-section.js";

// Metadata value rules
import { duplicateMetadataKeyRule } from "./duplicate-metadata-key.js";
import { emptyRequiredValueRule } from "./empty-required-value.js";
import { invalidDateRangeValueRule } from "./invalid-date-range-value.js";

// Content/section rules
import { duplicateSectionHeadingRule } from "./duplicate-section-heading.js";
import { emptySectionRule } from "./empty-section.js";

// Instance entry rules
import { updateWithoutCreateRule } from "./update-without-create.js";
import { timestampOutOfOrderRule } from "./timestamp-out-of-order.js";
import { createRequiresSectionRule } from "./create-requires-section.js";
import { duplicateTimestampRule } from "./duplicate-timestamp.js";

// Style rules
import { missingTitleRule } from "./missing-title.js";

// Synthesis rules
import { synthesisMissingSourcesRule } from "./synthesis-missing-sources.js";
import { synthesisMissingPromptRule } from "./synthesis-missing-prompt.js";
import { synthesisEmptyQueryRule } from "./synthesis-empty-query.js";
import { synthesisUnknownQueryEntityRule } from "./synthesis-unknown-query-entity.js";
import { actualizeUnresolvedTargetRule } from "./actualize-unresolved-target.js";
import { actualizeMissingUpdatedRule } from "./actualize-missing-updated.js";

/**
 * All available validation rules
 */
export const allRules: Rule[] = [
  // Existing rules
  unknownEntityRule,
  missingRequiredFieldRule,
  unknownFieldRule,
  invalidFieldTypeRule,
  missingRequiredSectionRule,
  unknownSectionRule,
  unresolvedLinkRule,
  duplicateLinkIdRule,

  // Schema definition rules
  duplicateEntityDefinitionRule,
  alterUndefinedEntityRule,
  alterBeforeDefineRule,
  duplicateFieldInSchemaRule,
  duplicateSectionInSchemaRule,
  removeUndefinedFieldRule,
  removeUndefinedSectionRule,
  invalidDefaultValueRule,
  defineEntityRequiresSectionRule,

  // Metadata value rules
  duplicateMetadataKeyRule,
  emptyRequiredValueRule,
  invalidDateRangeValueRule,

  // Content/section rules
  duplicateSectionHeadingRule,
  emptySectionRule,

  // Instance entry rules
  updateWithoutCreateRule,
  timestampOutOfOrderRule,
  createRequiresSectionRule,
  duplicateTimestampRule,

  // Style rules
  missingTitleRule,

  // Synthesis rules
  synthesisMissingSourcesRule,
  synthesisMissingPromptRule,
  synthesisEmptyQueryRule,
  synthesisUnknownQueryEntityRule,
  actualizeUnresolvedTargetRule,
  actualizeMissingUpdatedRule,
];

/**
 * Get a rule by code
 */
export function getRule(code: string): Rule | undefined {
  return allRules.find((r) => r.code === code);
}
