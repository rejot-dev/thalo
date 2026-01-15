import type {
  Entry,
  InstanceEntry,
  SchemaEntry,
  SynthesisEntry,
  ActualizeEntry,
} from "../ast/ast-types.js";
import type { SemanticModel } from "../semantic/analyzer.js";
import type { SourceMap } from "../source-map.js";
import type { Workspace } from "../model/workspace.js";
import type { WorkspaceIndex } from "./workspace-index.js";
import type { PartialDiagnostic } from "./check.js";

/**
 * Context available to visitors during the check phase.
 */
export interface VisitorContext {
  /** The workspace being checked */
  workspace: Workspace;
  /** Pre-computed indices for efficient queries */
  index: WorkspaceIndex;
  /** Report a diagnostic */
  report(diagnostic: PartialDiagnostic): void;
}

/**
 * Context available when visiting a specific entry.
 */
export interface EntryContext extends VisitorContext {
  /** The semantic model containing the entry */
  model: SemanticModel;
  /** The file path */
  file: string;
  /** Source map for position translation */
  sourceMap: SourceMap;
}

/**
 * Visitor interface for rule implementations.
 *
 * Rules implement this interface to receive callbacks during the check phase.
 * Instead of each rule iterating over all entries, a single pass dispatches
 * to all registered visitors.
 */
export interface RuleVisitor {
  /**
   * Called once before visiting any entries.
   * Use this for initialization or pre-processing.
   */
  beforeCheck?(ctx: VisitorContext): void;

  /**
   * Called for each instance entry (create/update).
   */
  visitInstanceEntry?(entry: InstanceEntry, ctx: EntryContext): void;

  /**
   * Called for each schema entry (define-entity/alter-entity).
   */
  visitSchemaEntry?(entry: SchemaEntry, ctx: EntryContext): void;

  /**
   * Called for each synthesis entry (define-synthesis).
   */
  visitSynthesisEntry?(entry: SynthesisEntry, ctx: EntryContext): void;

  /**
   * Called for each actualize entry (actualize-synthesis).
   */
  visitActualizeEntry?(entry: ActualizeEntry, ctx: EntryContext): void;

  /**
   * Called once after visiting all entries.
   * Use this for cross-entry checks that need all data collected first.
   */
  afterCheck?(ctx: VisitorContext): void;
}

/**
 * Dispatch an entry to the appropriate visitor method.
 */
export function dispatchToVisitor(visitor: RuleVisitor, entry: Entry, ctx: EntryContext): void {
  switch (entry.type) {
    case "instance_entry":
      visitor.visitInstanceEntry?.(entry, ctx);
      break;
    case "schema_entry":
      visitor.visitSchemaEntry?.(entry, ctx);
      break;
    case "synthesis_entry":
      visitor.visitSynthesisEntry?.(entry, ctx);
      break;
    case "actualize_entry":
      visitor.visitActualizeEntry?.(entry, ctx);
      break;
  }
}

/**
 * Run a single pass over all entries, dispatching to all visitors.
 *
 * This is more efficient than each rule iterating independently.
 */
export function runVisitors(
  visitors: RuleVisitor[],
  workspace: Workspace,
  index: WorkspaceIndex,
  report: (diagnostic: PartialDiagnostic) => void,
): void {
  const visitorCtx: VisitorContext = {
    workspace,
    index,
    report,
  };

  // Call beforeCheck on all visitors
  for (const visitor of visitors) {
    visitor.beforeCheck?.(visitorCtx);
  }

  // Single pass over all models and entries
  for (const model of workspace.allModels()) {
    const entryCtx: EntryContext = {
      ...visitorCtx,
      model,
      file: model.file,
      sourceMap: model.sourceMap,
    };

    for (const entry of model.ast.entries) {
      // Dispatch to all visitors
      for (const visitor of visitors) {
        dispatchToVisitor(visitor, entry, entryCtx);
      }
    }
  }

  // Call afterCheck on all visitors
  for (const visitor of visitors) {
    visitor.afterCheck?.(visitorCtx);
  }
}

/**
 * Run visitors on a single model only.
 * Useful for document-scoped checks.
 */
export function runVisitorsOnModel(
  visitors: RuleVisitor[],
  model: SemanticModel,
  workspace: Workspace,
  index: WorkspaceIndex,
  report: (diagnostic: PartialDiagnostic) => void,
): void {
  const visitorCtx: VisitorContext = {
    workspace,
    index,
    report,
  };

  const entryCtx: EntryContext = {
    ...visitorCtx,
    model,
    file: model.file,
    sourceMap: model.sourceMap,
  };

  // Call beforeCheck on all visitors
  for (const visitor of visitors) {
    visitor.beforeCheck?.(visitorCtx);
  }

  // Iterate over entries in this model only
  for (const entry of model.ast.entries) {
    for (const visitor of visitors) {
      dispatchToVisitor(visitor, entry, entryCtx);
    }
  }

  // Call afterCheck on all visitors
  for (const visitor of visitors) {
    visitor.afterCheck?.(visitorCtx);
  }
}

/**
 * Run visitors on specific entries only.
 * Useful for incremental checks on changed entries.
 */
export function runVisitorsOnEntries(
  visitors: RuleVisitor[],
  entries: Entry[],
  model: SemanticModel,
  workspace: Workspace,
  index: WorkspaceIndex,
  report: (diagnostic: PartialDiagnostic) => void,
): void {
  const visitorCtx: VisitorContext = {
    workspace,
    index,
    report,
  };

  const entryCtx: EntryContext = {
    ...visitorCtx,
    model,
    file: model.file,
    sourceMap: model.sourceMap,
  };

  // Note: We don't call beforeCheck/afterCheck for incremental checks
  // as they typically need full workspace data

  for (const entry of entries) {
    for (const visitor of visitors) {
      dispatchToVisitor(visitor, entry, entryCtx);
    }
  }
}
