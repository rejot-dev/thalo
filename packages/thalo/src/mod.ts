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
export type { DocumentBlock, EditRange, EditResult } from "./model/document.js";
export type { Position as LinePosition } from "./model/line-index.js";
export type { InvalidationResult } from "./model/workspace.js";
export type {
  ModelSchemaEntry,
  ModelTypeExpression,
  ModelFieldDefinition,
  ModelSectionDefinition,
  ModelDefaultValue,
} from "./model/workspace.js";
export type {
  Query,
  QueryCondition,
  FieldCondition,
  TagCondition,
  LinkCondition,
} from "./services/query.js";

// Semantic types (new API - uses AST Entry types)
export type {
  SemanticModel,
  LinkDefinition,
  LinkReference,
  LinkIndex,
  SemanticModelDirtyFlags,
  SemanticUpdateResult,
} from "./semantic/analyzer.js";

// Schema
export { TypeExpr } from "./schema/registry.js";
export type { EntitySchema, FieldSchema, SectionSchema } from "./schema/registry.js";

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
} from "./ast/ast-types.js";
export { isSyntaxError } from "./ast/ast-types.js";

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

// Source mapping types for embedded blocks
export type { SourceMap, Position, BlockMatch } from "./source-map.js";

// Checker
export { checkDocument } from "./checker/check.js";
export { allRules, RULE_CATEGORIES } from "./checker/rules/rules.js";
export type { Rule, RuleCategory, Severity } from "./checker/rules/rules.js";
export type { Diagnostic, CheckConfig } from "./checker/check.js";

// Services
export * from "./services/definition.js";
export * from "./services/references.js";
export {
  extractSemanticTokens,
  encodeSemanticTokens,
  tokenTypes,
  tokenModifiers,
  type SemanticToken,
  type TokenType,
  type TokenModifier,
} from "./services/semantic-tokens.js";
export * from "./services/entity-navigation.js";
export * from "./services/query.js";
export * from "./services/hover.js";
export * from "./services/synthesis.js";

// Merge driver
export { mergeThaloFiles } from "./merge/driver.js";
export type { MergeResult, MergeStats } from "./merge/merge-result-builder.js";
export type {
  MergeConflict,
  ConflictType,
  ConflictContext,
  ConflictRule,
} from "./merge/conflict-detector.js";
export type { EntryMatch, EntryIdentity } from "./merge/entry-matcher.js";
export type { MergeOptions } from "./merge/driver.js";

// Constants
export * from "./constants.js";

// Commands
export { runCheck, type RunCheckOptions } from "./commands/check.js";
export type { CheckResult, DiagnosticInfo, DiagnosticSeverity } from "./commands/check.js";
export { runFormat, type RunFormatOptions, type Formatter } from "./commands/format.js";
export type {
  FormatResult,
  FormatFileResult,
  FormatFileInput,
  SyntaxErrorInfo,
} from "./commands/format.js";
export {
  runQuery,
  runQueries,
  parseQueryString,
  isQueryValidationError,
  isCheckpointError,
  isQueryError,
  isQuerySuccess,
  isQueriesSuccess,
  type RunQueryOptions,
} from "./commands/query.js";
export type {
  QueryResult,
  QueriesResult,
  QueryValidationError,
  CheckpointError,
  QueryEntryInfo,
  QueryConditionInfo,
} from "./commands/query.js";
export {
  runActualize,
  generateInstructions,
  generateTimestamp,
  DEFAULT_INSTRUCTIONS_TEMPLATE,
  type RunActualizeOptions,
  type InstructionsParams,
} from "./commands/actualize.js";
export type {
  ActualizeResult,
  SynthesisOutputInfo,
  ActualizeEntryInfo,
} from "./commands/actualize.js";
// Re-export browser-safe change tracker types and functions
export { parseCheckpoint } from "./services/change-tracker/change-tracker.js";
export type { ChangeTracker, ChangeMarker } from "./services/change-tracker/change-tracker.js";
export { formatDiagnostic, formatQueryResultRaw, type DiagnosticFormat } from "./formatters.js";
