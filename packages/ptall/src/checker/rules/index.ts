import type { Rule } from "../types.js";

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

// Timestamp rules
import { duplicateTimestampRule } from "./duplicate-timestamp.js";

// Metadata value rules
import { duplicateMetadataKeyRule } from "./duplicate-metadata-key.js";
import { emptyRequiredValueRule } from "./empty-required-value.js";
import { invalidDateValueRule } from "./invalid-date-value.js";
import { invalidDateRangeValueRule } from "./invalid-date-range-value.js";

// Content/section rules
import { duplicateSectionHeadingRule } from "./duplicate-section-heading.js";
import { emptySectionRule } from "./empty-section.js";

// Instance entry rules
import { updateWithoutCreateRule } from "./update-without-create.js";

// Style rules
import { missingTitleRule } from "./missing-title.js";

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

  // Timestamp rules
  duplicateTimestampRule,

  // Metadata value rules
  duplicateMetadataKeyRule,
  emptyRequiredValueRule,
  invalidDateValueRule,
  invalidDateRangeValueRule,

  // Content/section rules
  duplicateSectionHeadingRule,
  emptySectionRule,

  // Instance entry rules
  updateWithoutCreateRule,

  // Style rules
  missingTitleRule,
];

/**
 * Get a rule by code
 */
export function getRule(code: string): Rule | undefined {
  return allRules.find((r) => r.code === code);
}
