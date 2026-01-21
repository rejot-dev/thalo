/**
 * Thalo Scripting API
 *
 * A high-level, stable API for scripting and programmatic access to Thalo workspaces.
 *
 * @example
 * ```typescript
 * import { loadThalo } from "@rejot-dev/thalo/api";
 *
 * const workspace = await loadThalo("./my-knowledge-base");
 *
 * // Iterate over entries
 * for (const entry of workspace.entries()) {
 *   console.log(`${entry.timestamp} - ${entry.title}`);
 * }
 *
 * // Query entries
 * const opinions = workspace.query("opinion where #coding");
 *
 * // Find link references (uses ^ prefix)
 * const linkRefs = workspace.findReferences("^my-note");
 *
 * // Find tag usages (uses # prefix)
 * const tagRefs = workspace.findReferences("#coding");
 *
 * // Custom visitor
 * workspace.visit({
 *   visitInstanceEntry(entry) {
 *     console.log(entry.entity, entry.title);
 *   }
 * });
 * ```
 *
 * @module @rejot-dev/thalo/api
 */

import type {
  Entry,
  InstanceEntry,
  SchemaEntry,
  SynthesisEntry,
  ActualizeEntry,
  Location,
  Tag,
} from "./ast/ast-types.js";
import type { SemanticModel } from "./semantic/analyzer.js";
import type { SourceMap } from "./source-map.js";
import { toFileLocation } from "./source-map.js";
import { loadWorkspaceFromDirectory, loadWorkspaceFromFiles } from "./files.js";
import { Workspace } from "./model/workspace.js";
import { findDefinition as findDefinitionService } from "./services/definition.js";
import { findReferences as findReferencesService } from "./services/references.js";
import type { Query } from "./services/query.js";
import { parseQueryString, executeQueries, validateQueryEntities } from "./services/query.js";
import { runCheck } from "./commands/check.js";
import { formatTimestamp } from "./formatters.js";
import {
  parseCheckpoint,
  type ChangeTracker,
  type ChangeMarker,
} from "./services/change-tracker/change-tracker.js";

// ===================
// Entry Types
// ===================

/**
 * The type of a Thalo entry.
 */
export type ThaloEntryType = "instance" | "schema" | "synthesis" | "actualize";

/**
 * A simplified, user-friendly representation of a Thalo entry.
 *
 * This wraps the raw AST entry with commonly-needed fields extracted
 * for easy access in scripts.
 *
 * @example
 * ```typescript
 * const workspace = await loadThalo("./my-kb");
 *
 * for (const entry of workspace.entries()) {
 *   console.log(`${entry.timestamp} - ${entry.title}`);
 *   if (entry.linkId) {
 *     console.log(`  Link: ^${entry.linkId}`);
 *   }
 * }
 * ```
 */
export interface ThaloEntry {
  /** The entry type: instance, schema, synthesis, or actualize */
  readonly type: ThaloEntryType;

  /** The file path containing this entry */
  readonly file: string;

  /** The entry's timestamp in ISO format (e.g., "2026-01-08T14:30Z") */
  readonly timestamp: string;

  /** The entry's title/description */
  readonly title: string;

  /** The entry's link ID (without ^ prefix), if defined */
  readonly linkId: string | undefined;

  /** Tags on this entry (without # prefix) */
  readonly tags: readonly string[];

  /** Location in the source file */
  readonly location: Location;

  /**
   * The raw AST entry for advanced use cases.
   * Use this to access fields not exposed in the simplified interface.
   */
  readonly raw: Entry;
}

/**
 * A ThaloEntry that is specifically an instance entry (create/update).
 */
export interface ThaloInstanceEntry extends ThaloEntry {
  readonly type: "instance";
  /** The entity type (e.g., "lore", "opinion") */
  readonly entity: string;
  /** The directive: "create" or "update" */
  readonly directive: "create" | "update";
  readonly raw: InstanceEntry;
}

/**
 * A ThaloEntry that is specifically a schema entry (define-entity/alter-entity).
 */
export interface ThaloSchemaEntry extends ThaloEntry {
  readonly type: "schema";
  /** The entity name being defined/altered */
  readonly entityName: string;
  /** The directive: "define-entity" or "alter-entity" */
  readonly directive: "define-entity" | "alter-entity";
  readonly raw: SchemaEntry;
}

/**
 * A ThaloEntry that is specifically a synthesis entry (define-synthesis).
 */
export interface ThalaSynthesisEntry extends ThaloEntry {
  readonly type: "synthesis";
  readonly raw: SynthesisEntry;
}

/**
 * A ThaloEntry that is specifically an actualize entry (actualize-synthesis).
 */
export interface ThaloActualizeEntry extends ThaloEntry {
  readonly type: "actualize";
  /** The target synthesis link ID */
  readonly target: string;
  readonly raw: ActualizeEntry;
}

// ===================
// Navigation Types
// ===================

/**
 * Result of finding a definition.
 */
export interface DefinitionLocation {
  /** The file containing the definition */
  file: string;
  /** The link ID (without ^ prefix) */
  linkId: string;
  /** Location in the file */
  location: Location;
  /** The entry that defines this link */
  entry: ThaloEntry;
}

/**
 * A reference location for links (either definition or reference).
 */
export interface LinkReferenceLocation {
  /** The type of reference */
  kind: "link";
  /** The file containing the reference */
  file: string;
  /** Location in the file */
  location: Location;
  /** Whether this is the definition (true) or a reference (false) */
  isDefinition: boolean;
}

/**
 * A reference location for tags.
 */
export interface TagReferenceLocation {
  /** The type of reference */
  kind: "tag";
  /** The file containing the entry with this tag */
  file: string;
  /** Location of the tag in the file */
  location: Location;
  /** The entry that has this tag */
  entry: ThaloEntry;
}

/**
 * A reference location (can be link or tag).
 */
export type ReferenceLocation = LinkReferenceLocation | TagReferenceLocation;

// ===================
// Visitor Types
// ===================

/**
 * Context available when visiting entries.
 */
export interface VisitorContext {
  /** The workspace being visited */
  readonly workspace: ThaloWorkspaceInterface;
  /** The file containing the current entry */
  readonly file: string;
  /** Source map for position translation (internal use) */
  readonly sourceMap: SourceMap;
}

/**
 * Visitor interface for custom entry processing.
 *
 * Implement the methods you need - unimplemented methods are skipped.
 *
 * @example
 * ```typescript
 * const workspace = await loadThalo("./my-kb");
 *
 * // Count entries by entity type
 * const counts = new Map<string, number>();
 *
 * workspace.visit({
 *   visitInstanceEntry(entry) {
 *     const count = counts.get(entry.entity) ?? 0;
 *     counts.set(entry.entity, count + 1);
 *   }
 * });
 *
 * console.log(counts);
 * ```
 */
export interface EntryVisitor {
  /**
   * Called for each instance entry (create/update).
   */
  visitInstanceEntry?(entry: ThaloInstanceEntry, context: VisitorContext): void;

  /**
   * Called for each schema entry (define-entity/alter-entity).
   */
  visitSchemaEntry?(entry: ThaloSchemaEntry, context: VisitorContext): void;

  /**
   * Called for each synthesis entry (define-synthesis).
   */
  visitSynthesisEntry?(entry: ThalaSynthesisEntry, context: VisitorContext): void;

  /**
   * Called for each actualize entry (actualize-synthesis).
   */
  visitActualizeEntry?(entry: ThaloActualizeEntry, context: VisitorContext): void;
}

// ===================
// Check Types
// ===================

/**
 * Configuration for the check command.
 */
export interface CheckConfig {
  /** Override severity for specific rules */
  rules?: Partial<Record<string, "error" | "warning" | "info" | "off">>;
}

/**
 * A diagnostic (error, warning, or info) from validation.
 */
export interface DiagnosticInfo {
  /** File path where the diagnostic occurred */
  file: string;
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
  /** End line (1-based) */
  endLine: number;
  /** End column (1-based) */
  endColumn: number;
  /** Severity level */
  severity: "error" | "warning" | "info";
  /** Rule code (e.g., "unknown-entity", "missing-title") */
  code: string;
  /** Human-readable error message */
  message: string;
}

// ===================
// Load Options
// ===================

/**
 * Options for loading a Thalo workspace.
 */
export interface LoadOptions {
  /**
   * File extensions to include (default: [".thalo", ".md"])
   */
  extensions?: string[];
}

/**
 * Options for filtering a workspace by checkpoint.
 */
export interface FilteredSinceOptions {
  /**
   * Change tracker for git-based checkpoints.
   * Required when using git checkpoints (git:...).
   */
  tracker?: ChangeTracker;
}

// ===================
// Workspace Interface
// ===================

/**
 * Interface for a loaded Thalo workspace.
 *
 * Provides methods for iterating entries, navigation, querying, and validation.
 */
export interface ThaloWorkspaceInterface {
  // ===================
  // Iteration
  // ===================

  /**
   * Get all entries in the workspace.
   */
  entries(): ThaloEntry[];

  /**
   * Get all entries in a specific file.
   *
   * @param path - The file path (can be relative or absolute)
   */
  entriesInFile(path: string): ThaloEntry[];

  /**
   * Get all instance entries (create/update).
   */
  instanceEntries(): ThaloInstanceEntry[];

  /**
   * Get all schema entries (define-entity/alter-entity).
   */
  schemaEntries(): ThaloSchemaEntry[];

  /**
   * Get all synthesis entries (define-synthesis).
   */
  synthesisEntries(): ThalaSynthesisEntry[];

  /**
   * Get all actualize entries (actualize-synthesis).
   */
  actualizeEntries(): ThaloActualizeEntry[];

  /**
   * Get all file paths in the workspace.
   */
  files(): string[];

  /**
   * Create a filtered workspace view containing entries since a checkpoint.
   *
   * - Timestamp checkpoints (ts:...) filter all entries by timestamp.
   * - Git checkpoints (git:...) filter instance entries using a change tracker.
   *
   * @param checkpoint - Checkpoint string (e.g., "ts:2026-01-10T15:00Z" or "git:abc123")
   * @param options - Filter options
   */
  filteredSince(
    checkpoint: string,
    options?: FilteredSinceOptions,
  ): Promise<ThaloWorkspaceInterface>;

  // ===================
  // Navigation
  // ===================

  /**
   * Find the definition for a link.
   *
   * @param identifier - The link identifier with ^ prefix (e.g., "^my-opinion")
   * @returns The definition location, or undefined if not found
   * @throws Error if the identifier doesn't start with ^ or if it starts with #
   *
   * @example
   * ```typescript
   * const def = workspace.findDefinition("^my-opinion");
   * if (def) {
   *   console.log(`Found in ${def.file} at line ${def.location.startPosition.row + 1}`);
   * }
   * ```
   */
  findDefinition(identifier: string): DefinitionLocation | undefined;

  /**
   * Find all references to a link (^) or tag (#).
   *
   * - For links (^link-id): Returns all places where the link is used/defined
   * - For tags (#tag-name): Returns all entries that have this tag
   *
   * @param identifier - The identifier with prefix (e.g., "^my-link" or "#my-tag")
   * @param includeDefinition - For links: whether to include the definition in results (default: true). Ignored for tags.
   * @returns Array of reference locations
   * @throws Error if the identifier doesn't start with ^ or #
   *
   * @example
   * ```typescript
   * // Find link references
   * const linkRefs = workspace.findReferences("^my-opinion");
   * for (const ref of linkRefs) {
   *   if (ref.kind === "link") {
   *     const label = ref.isDefinition ? "definition" : "reference";
   *     console.log(`  ${label} in ${ref.file}`);
   *   }
   * }
   *
   * // Find all entries with a tag
   * const tagRefs = workspace.findReferences("#coding");
   * for (const ref of tagRefs) {
   *   if (ref.kind === "tag") {
   *     console.log(`  ${ref.entry.title} in ${ref.file}`);
   *   }
   * }
   * ```
   */
  findReferences(identifier: string, includeDefinition?: boolean): ReferenceLocation[];

  // ===================
  // Querying
  // ===================

  /**
   * Query entries using the Thalo query syntax.
   *
   * @param queryString - The query string (e.g., "lore where #career")
   * @returns Matching entries
   * @throws Error if the query syntax is invalid or references unknown entities
   *
   * @example
   * ```typescript
   * // All lore entries with #career tag
   * const entries = workspace.query("lore where #career");
   *
   * // Multiple queries (OR)
   * const entries = workspace.query("lore, opinion");
   *
   * // With field condition
   * const entries = workspace.query('lore where type = "fact"');
   * ```
   */
  query(queryString: string): ThaloEntry[];

  // ===================
  // Validation
  // ===================

  /**
   * Check the workspace for errors and warnings.
   *
   * @param config - Optional configuration for which rules to run
   * @returns Array of diagnostics
   *
   * @example
   * ```typescript
   * const diagnostics = workspace.check();
   *
   * for (const d of diagnostics) {
   *   console.log(`${d.severity}: ${d.message} (${d.file}:${d.line})`);
   * }
   * ```
   */
  check(config?: CheckConfig): DiagnosticInfo[];

  // ===================
  // Visitor
  // ===================

  /**
   * Visit all entries with a custom visitor.
   *
   * @param visitor - The visitor to use
   *
   * @example
   * ```typescript
   * // Find all entries without titles
   * const untitled: ThaloEntry[] = [];
   *
   * workspace.visit({
   *   visitInstanceEntry(entry) {
   *     if (!entry.title) {
   *       untitled.push(entry);
   *     }
   *   }
   * });
   * ```
   */
  visit(visitor: EntryVisitor): void;

  // ===================
  // Internal
  // ===================

  /**
   * Get the underlying Workspace instance for advanced use cases.
   * @internal
   */
  readonly _internal: Workspace;
}

// ===================
// Identifier Parsing
// ===================

type ParsedIdentifier = { kind: "link"; id: string } | { kind: "tag"; id: string };

/**
 * Parse an identifier with prefix.
 * @throws Error if the identifier doesn't have a valid prefix (^ or #)
 */
function parseIdentifier(identifier: string): ParsedIdentifier {
  if (identifier.startsWith("^")) {
    const id = identifier.slice(1);
    if (!id) {
      throw new Error('Invalid identifier: "^" must be followed by a link ID');
    }
    return { kind: "link", id };
  }

  if (identifier.startsWith("#")) {
    const id = identifier.slice(1);
    if (!id) {
      throw new Error('Invalid identifier: "#" must be followed by a tag name');
    }
    return { kind: "tag", id };
  }

  throw new Error(
    `Invalid identifier: "${identifier}". Must start with "^" for links or "#" for tags.`,
  );
}

/**
 * Get the tags from an entry (works for all entry types that have tags).
 */
function getEntryTags(entry: Entry): Tag[] {
  switch (entry.type) {
    case "instance_entry":
      return entry.header.tags;
    case "schema_entry":
      return entry.header.tags;
    case "synthesis_entry":
      return entry.header.tags;
    case "actualize_entry":
      // Actualize entries don't have tags
      return [];
  }
}

// ===================
// Entry Wrappers
// ===================

/**
 * Create a ThaloEntry wrapper from a raw AST entry.
 */
function wrapEntry(entry: Entry, file: string): ThaloEntry {
  switch (entry.type) {
    case "instance_entry":
      return wrapInstanceEntry(entry, file);
    case "schema_entry":
      return wrapSchemaEntry(entry, file);
    case "synthesis_entry":
      return wrapSynthesisEntry(entry, file);
    case "actualize_entry":
      return wrapActualizeEntry(entry, file);
  }
}

function wrapInstanceEntry(entry: InstanceEntry, file: string): ThaloInstanceEntry {
  return {
    type: "instance",
    file,
    timestamp: formatTimestamp(entry.header.timestamp),
    title: entry.header.title?.value ?? "",
    linkId: entry.header.link?.id,
    tags: entry.header.tags.map((t) => t.name),
    location: entry.location,
    entity: entry.header.entity,
    directive: entry.header.directive,
    raw: entry,
  };
}

function wrapSchemaEntry(entry: SchemaEntry, file: string): ThaloSchemaEntry {
  return {
    type: "schema",
    file,
    timestamp: formatTimestamp(entry.header.timestamp),
    title: entry.header.title?.value ?? "",
    linkId: entry.header.link?.id,
    tags: entry.header.tags.map((t) => t.name),
    location: entry.location,
    entityName: entry.header.entityName.value,
    directive: entry.header.directive,
    raw: entry,
  };
}

function wrapSynthesisEntry(entry: SynthesisEntry, file: string): ThalaSynthesisEntry {
  return {
    type: "synthesis",
    file,
    timestamp: formatTimestamp(entry.header.timestamp),
    title: entry.header.title.value,
    linkId: entry.header.linkId.id,
    tags: entry.header.tags.map((t) => t.name),
    location: entry.location,
    raw: entry,
  };
}

function wrapActualizeEntry(entry: ActualizeEntry, file: string): ThaloActualizeEntry {
  return {
    type: "actualize",
    file,
    timestamp: formatTimestamp(entry.header.timestamp),
    title: "", // Actualize entries don't have titles
    linkId: undefined,
    tags: [],
    location: entry.location,
    target: entry.header.target.id,
    raw: entry,
  };
}

// ===================
// ThaloWorkspace Implementation
// ===================

function buildAllEntityQueries(entries: ThaloInstanceEntry[]): Query[] {
  const entities = new Set<string>();

  for (const entry of entries) {
    if (entry.entity) {
      entities.add(entry.entity);
    }
  }

  return Array.from(entities).map((entity) => ({
    entity,
    conditions: [],
  }));
}

function parseCheckpointOrThrow(checkpoint: string): ChangeMarker {
  const marker = parseCheckpoint(checkpoint);
  if (!marker) {
    throw new Error(
      `Invalid checkpoint format: "${checkpoint}". Use "ts:2026-01-10T15:00Z" for timestamps or "git:abc123" for git commits.`,
    );
  }
  return marker;
}

class FilteredThaloWorkspace implements ThaloWorkspaceInterface {
  private readonly base: ThaloWorkspaceInterface;
  private readonly entryFilter: (entry: ThaloEntry) => boolean;
  private readonly instanceFilter: (entry: ThaloInstanceEntry) => boolean;

  constructor(
    base: ThaloWorkspaceInterface,
    entryFilter: (entry: ThaloEntry) => boolean,
    instanceFilter: (entry: ThaloInstanceEntry) => boolean,
  ) {
    this.base = base;
    this.entryFilter = entryFilter;
    this.instanceFilter = instanceFilter;
  }

  get _internal(): Workspace {
    return this.base._internal;
  }

  entries(): ThaloEntry[] {
    return this.base.entries().filter((entry) => this.entryFilter(entry));
  }

  entriesInFile(path: string): ThaloEntry[] {
    return this.base.entriesInFile(path).filter((entry) => this.entryFilter(entry));
  }

  instanceEntries(): ThaloInstanceEntry[] {
    return this.base.instanceEntries().filter((entry) => this.instanceFilter(entry));
  }

  schemaEntries(): ThaloSchemaEntry[] {
    return this.base.schemaEntries().filter((entry) => this.entryFilter(entry));
  }

  synthesisEntries(): ThalaSynthesisEntry[] {
    return this.base.synthesisEntries().filter((entry) => this.entryFilter(entry));
  }

  actualizeEntries(): ThaloActualizeEntry[] {
    return this.base.actualizeEntries().filter((entry) => this.entryFilter(entry));
  }

  files(): string[] {
    return this.base.files();
  }

  findDefinition(identifier: string): DefinitionLocation | undefined {
    return this.base.findDefinition(identifier);
  }

  findReferences(identifier: string, includeDefinition?: boolean): ReferenceLocation[] {
    return this.base.findReferences(identifier, includeDefinition);
  }

  query(queryString: string): ThaloEntry[] {
    return this.base
      .query(queryString)
      .filter((entry) => this.instanceFilter(entry as ThaloInstanceEntry));
  }

  async filteredSince(
    checkpoint: string,
    options: FilteredSinceOptions = {},
  ): Promise<ThaloWorkspaceInterface> {
    const next = await this.base.filteredSince(checkpoint, options);
    return new FilteredThaloWorkspace(
      next,
      (entry) => this.entryFilter(entry),
      (entry) => this.instanceFilter(entry),
    );
  }

  check(config?: CheckConfig): DiagnosticInfo[] {
    return this.base.check(config);
  }

  visit(visitor: EntryVisitor): void {
    this.base.visit({
      visitInstanceEntry: visitor.visitInstanceEntry
        ? (entry, context) => {
            if (this.instanceFilter(entry)) {
              visitor.visitInstanceEntry?.(entry, context);
            }
          }
        : undefined,
      visitSchemaEntry: visitor.visitSchemaEntry
        ? (entry, context) => {
            if (this.entryFilter(entry)) {
              visitor.visitSchemaEntry?.(entry, context);
            }
          }
        : undefined,
      visitSynthesisEntry: visitor.visitSynthesisEntry
        ? (entry, context) => {
            if (this.entryFilter(entry)) {
              visitor.visitSynthesisEntry?.(entry, context);
            }
          }
        : undefined,
      visitActualizeEntry: visitor.visitActualizeEntry
        ? (entry, context) => {
            if (this.entryFilter(entry)) {
              visitor.visitActualizeEntry?.(entry, context);
            }
          }
        : undefined,
    });
  }
}

/**
 * Implementation of the ThaloWorkspace interface.
 */
class ThaloWorkspace implements ThaloWorkspaceInterface {
  private readonly workspace: Workspace;

  constructor(workspace: Workspace) {
    this.workspace = workspace;
  }

  get _internal(): Workspace {
    return this.workspace;
  }

  // ===================
  // Iteration
  // ===================

  entries(): ThaloEntry[] {
    const result: ThaloEntry[] = [];
    for (const model of this.workspace.allModels()) {
      for (const entry of model.ast.entries) {
        result.push(wrapEntry(entry, model.file));
      }
    }
    return result;
  }

  entriesInFile(path: string): ThaloEntry[] {
    const model = this.workspace.getModel(path);
    if (!model) {
      return [];
    }
    return model.ast.entries.map((entry) => wrapEntry(entry, model.file));
  }

  instanceEntries(): ThaloInstanceEntry[] {
    const result: ThaloInstanceEntry[] = [];
    for (const model of this.workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type === "instance_entry") {
          result.push(wrapInstanceEntry(entry, model.file));
        }
      }
    }
    return result;
  }

  schemaEntries(): ThaloSchemaEntry[] {
    const result: ThaloSchemaEntry[] = [];
    for (const model of this.workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type === "schema_entry") {
          result.push(wrapSchemaEntry(entry, model.file));
        }
      }
    }
    return result;
  }

  synthesisEntries(): ThalaSynthesisEntry[] {
    const result: ThalaSynthesisEntry[] = [];
    for (const model of this.workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type === "synthesis_entry") {
          result.push(wrapSynthesisEntry(entry, model.file));
        }
      }
    }
    return result;
  }

  actualizeEntries(): ThaloActualizeEntry[] {
    const result: ThaloActualizeEntry[] = [];
    for (const model of this.workspace.allModels()) {
      for (const entry of model.ast.entries) {
        if (entry.type === "actualize_entry") {
          result.push(wrapActualizeEntry(entry, model.file));
        }
      }
    }
    return result;
  }

  files(): string[] {
    return this.workspace.files();
  }

  async filteredSince(
    checkpoint: string,
    options: FilteredSinceOptions = {},
  ): Promise<ThaloWorkspaceInterface> {
    const marker = parseCheckpointOrThrow(checkpoint);

    if (marker.type === "git" && !options.tracker) {
      throw new Error(
        `Git checkpoints require a change tracker. Provide a tracker option or use timestamp checkpoints (ts:...).`,
      );
    }

    if (marker.type === "ts") {
      const sinceEpoch = Date.parse(marker.value);
      if (Number.isNaN(sinceEpoch)) {
        throw new Error(
          `Invalid timestamp checkpoint: "${checkpoint}". Expected ISO format like "ts:2026-01-10T15:00Z".`,
        );
      }

      const entryFilter = (entry: ThaloEntry): boolean => Date.parse(entry.timestamp) > sinceEpoch;
      const instanceFilter = (entry: ThaloInstanceEntry): boolean =>
        Date.parse(entry.timestamp) > sinceEpoch;

      return new FilteredThaloWorkspace(this, entryFilter, instanceFilter);
    }

    const tracker = options.tracker!;
    const queries = buildAllEntityQueries(this.instanceEntries());
    const changedResult = await tracker.getChangedEntries(this.workspace, queries, marker);
    const changedEntries = new Set<InstanceEntry>(changedResult.entries);
    const changedSchemas = tracker.getChangedSchemaEntries
      ? new Set<SchemaEntry>(await tracker.getChangedSchemaEntries(this.workspace, marker))
      : null;

    const entryFilter = (entry: ThaloEntry): boolean => {
      if (entry.type !== "instance") {
        if (entry.type === "schema") {
          return changedSchemas ? changedSchemas.has(entry.raw as SchemaEntry) : true;
        }
        return true;
      }
      return changedEntries.has(entry.raw as InstanceEntry);
    };

    const instanceFilter = (entry: ThaloInstanceEntry): boolean =>
      changedEntries.has(entry.raw as InstanceEntry);

    return new FilteredThaloWorkspace(this, entryFilter, instanceFilter);
  }

  // ===================
  // Navigation
  // ===================

  findDefinition(identifier: string): DefinitionLocation | undefined {
    const parsed = parseIdentifier(identifier);

    if (parsed.kind === "tag") {
      throw new Error(
        `Cannot find definition for tag "#${parsed.id}". Tags are not defined; use findReferences("#${parsed.id}") to find entries with this tag.`,
      );
    }

    const linkId = parsed.id;
    const result = findDefinitionService(this.workspace, linkId);
    if (!result) {
      return undefined;
    }

    // Find the entry that defines this link
    const model = this.workspace.getModel(result.file);
    if (!model) {
      return undefined;
    }

    // Find the entry containing this definition
    const entry = this.findEntryAtLocation(model, result.location);
    if (!entry) {
      return undefined;
    }

    return {
      file: result.file,
      linkId,
      location: result.location,
      entry: wrapEntry(entry, result.file),
    };
  }

  findReferences(identifier: string, includeDefinition = true): ReferenceLocation[] {
    const parsed = parseIdentifier(identifier);

    if (parsed.kind === "link") {
      const result = findReferencesService(this.workspace, parsed.id, includeDefinition);
      return result.locations.map((loc) => ({
        kind: "link" as const,
        file: loc.file,
        location: loc.location,
        isDefinition: loc.isDefinition,
      }));
    }

    // For tags, find all entries that have this tag
    return this.findTagReferences(parsed.id);
  }

  private findTagReferences(tagName: string): TagReferenceLocation[] {
    const results: TagReferenceLocation[] = [];

    for (const model of this.workspace.allModels()) {
      for (const entry of model.ast.entries) {
        const tags = getEntryTags(entry);
        const matchingTag = tags.find((t) => t.name === tagName);
        if (matchingTag) {
          const fileLocation = toFileLocation(model.sourceMap, matchingTag.location);
          results.push({
            kind: "tag",
            file: model.file,
            location: fileLocation,
            entry: wrapEntry(entry, model.file),
          });
        }
      }
    }

    return results;
  }

  private findEntryAtLocation(
    model: SemanticModel,
    location: { startIndex: number },
  ): Entry | undefined {
    for (const entry of model.ast.entries) {
      // Check if the location is within this entry
      if (
        location.startIndex >= entry.location.startIndex &&
        location.startIndex <= entry.location.endIndex
      ) {
        return entry;
      }
    }
    return undefined;
  }

  // ===================
  // Querying
  // ===================

  query(queryString: string): ThaloEntry[] {
    // Parse the query
    const queries = parseQueryString(queryString);
    if (!queries) {
      throw new Error(`Invalid query syntax: "${queryString}"`);
    }

    // Validate entity names
    const unknownEntities = validateQueryEntities(this.workspace, queries);
    if (unknownEntities.length > 0) {
      throw new Error(
        `Unknown entity type${unknownEntities.length > 1 ? "s" : ""}: ${unknownEntities.map((e) => `'${e}'`).join(", ")}. Define ${unknownEntities.length > 1 ? "them" : "it"} using 'define-entity'.`,
      );
    }

    // Execute queries
    const results = executeQueries(this.workspace, queries);

    // Wrap results
    return results.map((entry) => {
      const file = this.findEntryFile(entry);
      return wrapEntry(entry, file ?? "");
    });
  }

  private findEntryFile(entry: Entry): string | undefined {
    for (const model of this.workspace.allModels()) {
      if (model.ast.entries.includes(entry)) {
        return model.file;
      }
    }
    return undefined;
  }

  // ===================
  // Validation
  // ===================

  check(config?: CheckConfig): DiagnosticInfo[] {
    const result = runCheck(this.workspace, { config });

    const diagnostics: DiagnosticInfo[] = [];
    for (const [, fileDiagnostics] of result.diagnosticsByFile) {
      diagnostics.push(...fileDiagnostics);
    }

    return diagnostics;
  }

  // ===================
  // Visitor
  // ===================

  visit(visitor: EntryVisitor): void {
    for (const model of this.workspace.allModels()) {
      const context: VisitorContext = {
        workspace: this,
        file: model.file,
        sourceMap: model.sourceMap,
      };

      for (const entry of model.ast.entries) {
        switch (entry.type) {
          case "instance_entry":
            visitor.visitInstanceEntry?.(wrapInstanceEntry(entry, model.file), context);
            break;
          case "schema_entry":
            visitor.visitSchemaEntry?.(wrapSchemaEntry(entry, model.file), context);
            break;
          case "synthesis_entry":
            visitor.visitSynthesisEntry?.(wrapSynthesisEntry(entry, model.file), context);
            break;
          case "actualize_entry":
            visitor.visitActualizeEntry?.(wrapActualizeEntry(entry, model.file), context);
            break;
        }
      }
    }
  }
}

// ===================
// Public API
// ===================

/**
 * Load a Thalo workspace from a directory.
 *
 * Discovers all .thalo and .md files in the directory and loads them
 * into a workspace for scripting.
 *
 * @param path - Path to the directory containing Thalo files
 * @param options - Optional configuration
 * @returns A loaded ThaloWorkspace
 * @throws Error if directory doesn't exist or no files found
 *
 * @example
 * ```typescript
 * import { loadThalo } from "@rejot-dev/thalo/api";
 *
 * // Load from current directory
 * const workspace = await loadThalo(".");
 *
 * // Load from specific path
 * const workspace = await loadThalo("./my-knowledge-base");
 *
 * // Only load .thalo files
 * const workspace = await loadThalo("./kb", { extensions: [".thalo"] });
 * ```
 */
export async function loadThalo(
  path: string,
  options: LoadOptions = {},
): Promise<ThaloWorkspaceInterface> {
  const extensions = options.extensions ?? [".thalo", ".md"];
  const workspace = await loadWorkspaceFromDirectory(path, extensions);
  return new ThaloWorkspace(workspace);
}

/**
 * Load a Thalo workspace from specific files.
 *
 * @param files - Array of file paths to load
 * @returns A loaded ThaloWorkspace
 *
 * @example
 * ```typescript
 * import { loadThaloFiles } from "@rejot-dev/thalo/api";
 *
 * const workspace = await loadThaloFiles([
 *   "./entries.thalo",
 *   "./syntheses.thalo",
 * ]);
 * ```
 */
export async function loadThaloFiles(files: string[]): Promise<ThaloWorkspaceInterface> {
  const workspace = await loadWorkspaceFromFiles(files);
  return new ThaloWorkspace(workspace);
}

/**
 * Create an empty Thalo workspace.
 *
 * Useful for building workspaces programmatically.
 *
 * @example
 * ```typescript
 * import { createThaloWorkspace } from "@rejot-dev/thalo/api";
 *
 * const workspace = await createThaloWorkspace();
 * // Add documents programmatically via workspace._internal
 * ```
 */
export async function createThaloWorkspace(): Promise<ThaloWorkspaceInterface> {
  const { createWorkspace } = await import("./parser.native.js");
  return new ThaloWorkspace(createWorkspace());
}

/**
 * Create a ThaloWorkspace from an existing internal Workspace.
 *
 * This is useful for testing or when you already have a Workspace instance.
 *
 * @param workspace - An existing Workspace instance
 * @returns A ThaloWorkspace wrapping the given Workspace
 * @internal
 */
export function wrapWorkspace(workspace: Workspace): ThaloWorkspaceInterface {
  return new ThaloWorkspace(workspace);
}
