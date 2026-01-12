// Parser types - browser-compatible types only
// NOTE: For parseDocument/parseThalo functions, use @rejot-dev/thalo/native (Node.js) or @rejot-dev/thalo/web (browser)
export type {
  ParsedBlock,
  ParsedDocument,
  ParseOptions,
  FileType,
  ThaloParser,
  GenericTree,
} from "./parser.shared.js";

// Fragment parsing - Node.js only (uses native parser)
// NOTE: For fragment parsing, import directly from @rejot-dev/thalo/native
export type { FragmentType, ParsedFragment } from "./fragment.js";

// Model classes
export { Workspace } from "./model/workspace.js";
export { Document, LineIndex, computeEdit } from "./model/index.js";
export type { DocumentBlock, EditRange, EditResult } from "./model/document.js";
export type { Position as LinePosition } from "./model/line-index.js";
export type { InvalidationResult } from "./model/workspace.js";
export type {
  ModelSchemaEntry,
  ModelTypeExpression,
  Query,
  QueryCondition,
} from "./model/types.js";

// Semantic types (new API - uses AST Entry types)
export { updateSemanticModel } from "./semantic/analyzer.js";
export type {
  SemanticModel,
  LinkDefinition,
  LinkReference,
  LinkIndex,
  SemanticModelDirtyFlags,
  SemanticUpdateResult,
} from "./semantic/types.js";

// Schema
export { TypeExpr } from "./schema/types.js";
export type { EntitySchema, FieldSchema, SectionSchema } from "./schema/types.js";

// AST types
export type {
  Location,
  Entry,
  InstanceEntry,
  SchemaEntry,
  SynthesisEntry,
  ActualizeEntry,
  Timestamp,
  Query as AstQuery,
  QueryCondition as AstQueryCondition,
} from "./ast/types.js";
export { isSyntaxError, isValidResult } from "./ast/types.js";

// AST node-at-position utility
export { findNodeAtPosition } from "./ast/node-at-position.js";
export type {
  NodeContext,
  LinkContext,
  TagContext,
  TimestampContext,
  DirectiveContext,
  EntityContext,
  SchemaEntityContext,
  MetadataKeyContext,
  SectionHeaderContext,
  TypeContext,
  FieldNameContext,
  SectionNameContext,
  TitleContext,
  UnknownContext,
} from "./ast/node-at-position.js";

// Source mapping for embedded blocks
export {
  identitySourceMap,
  isIdentityMap,
  createSourceMap,
  toFilePosition,
  toBlockPosition,
  toFileLocation,
  toBlockLocation,
  pointToPosition,
  positionToPoint,
  positionFromOffset,
  findBlockAtPosition,
  type SourceMap,
  type Position,
  type BlockMatch,
} from "./source-map.js";

// Checker
export { check, checkDocument } from "./checker/check.js";
export { allRules, getRule } from "./checker/rules/index.js";
export { RULE_CATEGORIES } from "./checker/types.js";
export type { Diagnostic, Severity, CheckConfig, Rule, RuleCategory } from "./checker/types.js";

// Services
export * from "./services/index.js";

// Merge driver
export { mergeThaloFiles } from "./merge/driver.js";
export type {
  MergeResult,
  MergeConflict,
  ConflictType,
  MergeOptions,
  MergeStats,
} from "./merge/types.js";

// Constants
export * from "./constants.js";

// Commands
export { runCheck, type RunCheckOptions } from "./commands/check.js";
export type { CheckResult, DiagnosticInfo, DiagnosticSeverity } from "./commands/check.js";
export { runQuery, parseQueryString, type RunQueryOptions } from "./commands/query.js";
export type { QueryResult, QueryEntryInfo, QueryConditionInfo } from "./commands/query.js";
export { runActualize, type RunActualizeOptions } from "./commands/actualize.js";
export type {
  ActualizeResult,
  SynthesisOutputInfo,
  ActualizeEntryInfo,
} from "./commands/actualize.js";
export {
  formatDiagnostic,
  formatCheckResult,
  formatQueryResult,
  formatQueryResultRaw,
  formatActualizeResult,
  type DiagnosticFormat,
} from "./formatters.js";
