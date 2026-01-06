import type { Workspace } from "../model/workspace.js";
import type { Document } from "../model/document.js";
import type { Diagnostic, CheckConfig, CheckContext, Rule, Severity } from "./types.js";
import { getEffectiveSeverity } from "./types.js";
import { allRules } from "./rules/index.js";

/**
 * Check a workspace for issues using all configured rules
 */
export function check(workspace: Workspace, config: CheckConfig = {}): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const rule of allRules) {
    const severity = getEffectiveSeverity(rule, config);
    if (severity === "off") {
      continue;
    }

    const ctx = createContext(workspace, rule, severity, diagnostics);
    rule.check(ctx);
  }

  return diagnostics;
}

/**
 * Check a single document for issues
 */
export function checkDocument(
  document: Document,
  workspace: Workspace,
  config: CheckConfig = {},
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const rule of allRules) {
    const severity = getEffectiveSeverity(rule, config);
    if (severity === "off") {
      continue;
    }

    const ctx = createDocumentContext(workspace, document, rule, severity, diagnostics);
    rule.check(ctx);
  }

  // Filter to only diagnostics from this document
  return diagnostics.filter((d) => d.file === document.file);
}

/**
 * Create a check context for workspace-wide checking
 */
function createContext(
  workspace: Workspace,
  rule: Rule,
  severity: Exclude<Severity, "off">,
  diagnostics: Diagnostic[],
): CheckContext {
  return {
    workspace,
    report(partial) {
      diagnostics.push({
        ...partial,
        code: rule.code,
        severity,
      });
    },
  };
}

/**
 * Create a check context for document-scoped checking
 */
function createDocumentContext(
  workspace: Workspace,
  document: Document,
  rule: Rule,
  severity: Exclude<Severity, "off">,
  diagnostics: Diagnostic[],
): CheckContext {
  return {
    workspace,
    document,
    report(partial) {
      diagnostics.push({
        ...partial,
        code: rule.code,
        severity,
      });
    },
  };
}
