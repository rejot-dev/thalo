import type { Rule } from "../types.js";
import { unknownEntityRule } from "./unknown-entity.js";
import { missingRequiredFieldRule } from "./missing-required-field.js";
import { unknownFieldRule } from "./unknown-field.js";
import { invalidFieldTypeRule } from "./invalid-field-type.js";
import { missingRequiredSectionRule } from "./missing-required-section.js";
import { unknownSectionRule } from "./unknown-section.js";
import { unresolvedLinkRule } from "./unresolved-link.js";
import { duplicateLinkIdRule } from "./duplicate-link-id.js";

/**
 * All available validation rules
 */
export const allRules: Rule[] = [
  unknownEntityRule,
  missingRequiredFieldRule,
  unknownFieldRule,
  invalidFieldTypeRule,
  missingRequiredSectionRule,
  unknownSectionRule,
  unresolvedLinkRule,
  duplicateLinkIdRule,
];

/**
 * Get a rule by code
 */
export function getRule(code: string): Rule | undefined {
  return allRules.find((r) => r.code === code);
}
