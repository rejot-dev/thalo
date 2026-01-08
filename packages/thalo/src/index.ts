// Main entry point - parser and core types
export {
  parseDocument,
  parseThalo,
  type ParsedBlock,
  type ParsedDocument,
  type ParseOptions,
  type FileType,
} from "./parser.js";

// Fragment parsing - parse individual expressions
export { parseFragment, parseQuery, type FragmentType, type ParsedFragment } from "./fragment.js";

// Model classes
export { Document } from "./model/document.js";
export { Workspace } from "./model/workspace.js";
export type {
  ModelEntry,
  ModelInstanceEntry,
  ModelSchemaEntry,
  ModelSynthesisEntry,
  ModelActualizeEntry,
  ModelTypeExpression,
  Query,
  QueryCondition,
  LinkDefinition,
  LinkReference,
  LinkIndex,
} from "./model/types.js";

// Schema
export { TypeExpr } from "./schema/types.js";
export type { EntitySchema, FieldSchema, SectionSchema } from "./schema/types.js";

// AST types
export type { Location } from "./ast/types.js";

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
export type {
  Diagnostic,
  Severity,
  CheckConfig,
  CheckContext,
  Rule,
  RuleCategory,
} from "./checker/types.js";

// Services
export * from "./services/index.js";

// Constants
export * from "./constants.js";
