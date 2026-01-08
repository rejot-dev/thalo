import type { Workspace } from "../model/workspace.js";
import type { Document } from "../model/document.js";
import type {
  Diagnostic,
  CheckConfig,
  CheckContext,
  Rule,
  Severity,
  PartialDiagnostic,
} from "./types.js";
import { getEffectiveSeverity } from "./types.js";
import { allRules } from "./rules/index.js";
import { toFileLocation } from "../source-map.js";

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
 * Convert a partial diagnostic to a full diagnostic.
 * If sourceMap is provided, convert location from block-relative to file-absolute.
 */
function createDiagnostic(
  partial: PartialDiagnostic,
  code: string,
  severity: Exclude<Severity, "off">,
): Diagnostic {
  // Convert location if sourceMap is provided
  const location = partial.sourceMap
    ? toFileLocation(partial.sourceMap, partial.location)
    : partial.location;

  return {
    code,
    severity,
    message: partial.message,
    file: partial.file,
    location,
    data: partial.data,
  };
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
      diagnostics.push(createDiagnostic(partial, rule.code, severity));
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
      diagnostics.push(createDiagnostic(partial, rule.code, severity));
    },
  };
}
