export * from "./types.js";
export { check, checkDocument, checkIncremental } from "./check.js";
export { allRules } from "./rules/index.js";
export {
  buildWorkspaceIndex,
  getInstancesForEntity,
  getDefineEntriesForEntity,
  getAlterEntriesForEntity,
  getEntriesReferencingLink,
  type WorkspaceIndex,
  type IndexedEntry,
} from "./workspace-index.js";
export {
  dispatchToVisitor,
  runVisitors,
  runVisitorsOnModel,
  runVisitorsOnEntries,
  type RuleVisitor,
  type VisitorContext,
  type EntryContext,
} from "./visitor.js";
