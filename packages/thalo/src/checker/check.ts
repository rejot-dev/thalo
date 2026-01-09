import type { Workspace, InvalidationResult } from "../model/workspace.js";
import type { SemanticModel } from "../semantic/types.js";
import type { Entry, SourceFile } from "../ast/types.js";
import type { Diagnostic, CheckConfig, Rule, Severity, PartialDiagnostic } from "./types.js";
import { getEffectiveSeverity } from "./types.js";
import { allRules } from "./rules/index.js";
import { toFileLocation, type SourceMap } from "../source-map.js";
import { collectSyntaxErrors as collectSyntaxErrorNodes } from "../ast/visitor.js";
import { buildWorkspaceIndex } from "./workspace-index.js";
import { runVisitors, runVisitorsOnModel, runVisitorsOnEntries } from "./visitor.js";
import type { RuleVisitor } from "./visitor.js";

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

/**
 * Collect syntax errors from an AST and convert them to diagnostics.
 * Includes both root-level parse errors and nested syntax errors within entries.
 */
function collectSyntaxErrors(ast: SourceFile, file: string, sourceMap?: SourceMap): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Collect root-level syntax errors (malformed entries)
  for (const error of ast.syntaxErrors) {
    diagnostics.push({
      code: `syntax-${error.code}`,
      severity: "error" as const,
      message: error.message,
      file,
      location: sourceMap ? toFileLocation(sourceMap, error.location) : error.location,
    });
  }

  // Collect nested syntax errors within valid entries
  const nestedErrors = collectSyntaxErrorNodes(ast);
  for (const error of nestedErrors) {
    diagnostics.push({
      code: `syntax-${error.code}`,
      severity: "error" as const,
      message: error.message,
      file,
      location: sourceMap ? toFileLocation(sourceMap, error.location) : error.location,
    });
  }

  return diagnostics;
}

/**
 * Check a workspace for issues using all configured rules
 */
export function check(workspace: Workspace, config: CheckConfig = {}): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Collect syntax errors from all models
  for (const model of workspace.allModels()) {
    diagnostics.push(...collectSyntaxErrors(model.ast, model.file, model.sourceMap));
  }

  // Build workspace index for efficient rule execution
  const index = buildWorkspaceIndex(workspace);

  // Get active rules and their visitors
  const activeRules = allRules.filter((r) => getEffectiveSeverity(r, config) !== "off");
  const visitors = activeRules.map((rule) => createTrackedVisitor(rule, config, diagnostics));

  // Run all visitors in a single pass (report handled by wrapped visitors)
  runVisitors(visitors, workspace, index, noop);

  return diagnostics;
}

/**
 * Check a single model for issues
 */
export function checkModel(
  model: SemanticModel,
  workspace: Workspace,
  config: CheckConfig = {},
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...collectSyntaxErrors(model.ast, model.file, model.sourceMap));

  // Build workspace index
  const index = buildWorkspaceIndex(workspace);

  // Get active rules and their visitors
  const activeRules = allRules.filter((r) => getEffectiveSeverity(r, config) !== "off");
  const visitors = activeRules.map((rule) => createTrackedVisitor(rule, config, diagnostics));

  // Run visitors on this model only
  runVisitorsOnModel(visitors, model, workspace, index, noop);

  return diagnostics.filter((d) => d.file === model.file);
}

/**
 * Check a single document for issues (alias for checkModel that gets model from workspace)
 */
export function checkDocument(
  file: string,
  workspace: Workspace,
  config: CheckConfig = {},
): Diagnostic[] {
  const model = workspace.getModel(file);
  if (!model) {
    return [];
  }
  return checkModel(model, workspace, config);
}

/**
 * Perform incremental checking based on what changed.
 *
 * Only runs rules that are affected by the changes, and only on
 * the affected scope (entry, document, or workspace).
 */
export function checkIncremental(
  workspace: Workspace,
  changedFile: string,
  changedEntries: Entry[],
  invalidation: InvalidationResult,
  config: CheckConfig = {},
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const model = workspace.getModel(changedFile);
  if (!model) {
    return diagnostics;
  }

  // Always collect syntax errors
  diagnostics.push(...collectSyntaxErrors(model.ast, model.file, model.sourceMap));

  // Build index
  const index = buildWorkspaceIndex(workspace);

  // Partition rules by scope and dependencies
  const { entryRules, documentRules, workspaceRules } = partitionRulesByScope(
    allRules,
    config,
    invalidation,
  );

  // Run entry-scoped rules on changed entries only
  if (entryRules.length > 0 && changedEntries.length > 0) {
    const visitors = entryRules.map((rule) => createTrackedVisitor(rule, config, diagnostics));
    runVisitorsOnEntries(visitors, changedEntries, model, workspace, index, noop);
  }

  // Run document-scoped rules on the full document
  if (documentRules.length > 0) {
    const visitors = documentRules.map((rule) => createTrackedVisitor(rule, config, diagnostics));
    runVisitorsOnModel(visitors, model, workspace, index, noop);
  }

  // Run workspace-scoped rules
  if (workspaceRules.length > 0) {
    const visitors = workspaceRules.map((rule) => createTrackedVisitor(rule, config, diagnostics));
    runVisitors(visitors, workspace, index, noop);
  }

  // Filter to only diagnostics for the changed file
  return diagnostics.filter((d) => d.file === changedFile);
}

/**
 * Create a visitor that tracks diagnostics for a specific rule.
 * Assumes the rule has already been filtered to ensure severity !== "off".
 */
function createTrackedVisitor(
  rule: Rule,
  config: CheckConfig,
  diagnostics: Diagnostic[],
): RuleVisitor {
  // Safe: callers filter out rules with severity === "off" before calling this function
  const severity = getEffectiveSeverity(rule, config) as Exclude<Severity, "off">;
  const v = rule.visitor;

  const wrapCtx = <T extends object>(ctx: T) => ({
    ...ctx,
    report: (partial: PartialDiagnostic) => {
      diagnostics.push(createDiagnostic(partial, rule.code, severity));
    },
  });

  return {
    beforeCheck: v.beforeCheck ? (ctx) => v.beforeCheck!(wrapCtx(ctx)) : undefined,
    visitInstanceEntry: v.visitInstanceEntry
      ? (entry, ctx) => v.visitInstanceEntry!(entry, wrapCtx(ctx))
      : undefined,
    visitSchemaEntry: v.visitSchemaEntry
      ? (entry, ctx) => v.visitSchemaEntry!(entry, wrapCtx(ctx))
      : undefined,
    visitSynthesisEntry: v.visitSynthesisEntry
      ? (entry, ctx) => v.visitSynthesisEntry!(entry, wrapCtx(ctx))
      : undefined,
    visitActualizeEntry: v.visitActualizeEntry
      ? (entry, ctx) => v.visitActualizeEntry!(entry, wrapCtx(ctx))
      : undefined,
    afterCheck: v.afterCheck ? (ctx) => v.afterCheck!(wrapCtx(ctx)) : undefined,
  };
}

/**
 * Partition rules by scope, filtering based on invalidation.
 */
function partitionRulesByScope(
  rules: Rule[],
  config: CheckConfig,
  invalidation: InvalidationResult,
): { entryRules: Rule[]; documentRules: Rule[]; workspaceRules: Rule[] } {
  const entryRules: Rule[] = [];
  const documentRules: Rule[] = [];
  const workspaceRules: Rule[] = [];

  for (const rule of rules) {
    const severity = getEffectiveSeverity(rule, config);
    if (severity === "off") {
      continue;
    }

    const deps = rule.dependencies;
    const scope = deps.scope;

    if (scope === "workspace") {
      // Only run if relevant dependencies changed
      if (deps.schemas && invalidation.schemasChanged) {
        workspaceRules.push(rule);
      } else if (deps.links && invalidation.linksChanged) {
        workspaceRules.push(rule);
      } else if (!deps.schemas && !deps.links) {
        workspaceRules.push(rule);
      }
    } else if (scope === "document") {
      documentRules.push(rule);
    } else {
      entryRules.push(rule);
    }
  }

  return { entryRules, documentRules, workspaceRules };
}

/**
 * Convert a partial diagnostic to a full diagnostic.
 */
function createDiagnostic(
  partial: PartialDiagnostic,
  code: string,
  severity: Exclude<Severity, "off">,
): Diagnostic {
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
