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
  LinkDefinition,
  LinkReference,
  LinkIndex,
} from "./model/types.js";

// AST types
export type { Location } from "./ast/types.js";

// Checker
export { check, checkDocument } from "./checker/check.js";
export { allRules, getRule } from "./checker/rules/index.js";
export type { Diagnostic, Severity, CheckConfig, CheckContext, Rule } from "./checker/types.js";

// Services
export * from "./services/index.js";
