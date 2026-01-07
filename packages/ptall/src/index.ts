// Main entry point - parser and core types
export {
  parseDocument,
  parsePtall,
  type ParsedBlock,
  type ParsedDocument,
  type ParseOptions,
  type FileType,
} from "./parser.js";

// Model classes
export { Document } from "./model/document.js";
export { Workspace } from "./model/workspace.js";
export type {
  ModelEntry,
  ModelInstanceEntry,
  ModelSchemaEntry,
  ModelTypeExpression,
  LinkDefinition,
  LinkReference,
  LinkIndex,
} from "./model/types.js";

// Schema
export { TypeExpr } from "./schema/types.js";
export type { EntitySchema, FieldSchema, SectionSchema } from "./schema/types.js";

// AST types
export type { Location } from "./ast/types.js";

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
