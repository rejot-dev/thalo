import type { Entry } from "../ast/ast-types.js";

/**
 * Result of a three-way merge operation
 */
export interface MergeResult {
  /**
   * Whether the merge completed without conflicts
   * - `true`: Clean merge, all changes reconciled
   * - `false`: Conflicts detected, manual resolution required
   */
  success: boolean;

  /**
   * The merged content as a string
   * - On success: Clean merged entries
   * - On failure: Includes conflict markers
   */
  content: string;

  /**
   * List of conflicts detected during merge
   * Empty array if success is true
   */
  conflicts: MergeConflict[];

  /**
   * Statistics about the merge operation
   */
  stats: MergeStats;
}

/**
 * A conflict detected during merging
 */
export interface MergeConflict {
  /**
   * Type of conflict detected
   */
  type: ConflictType;

  /**
   * Human-readable description of the conflict
   */
  message: string;

  /**
   * Line number in the merged output where conflict appears
   * (Computed during result building)
   */
  location: number;

  /**
   * Identity of the conflicting entry (for unique keying)
   */
  identity: EntryIdentity;

  /**
   * The base entry (common ancestor), if applicable
   */
  base?: Entry;

  /**
   * The ours entry (local/current version)
   */
  ours?: Entry;

  /**
   * The theirs entry (incoming version)
   */
  theirs?: Entry;

  /**
   * Additional context about the conflict
   */
  context?: ConflictContext;
}

/**
 * Types of conflicts that can be detected
 */
export type ConflictType =
  | "duplicate-link-id" // Both sides created entry with same ^link-id
  | "concurrent-metadata-update" // Both modified same metadata key
  | "incompatible-schema-change" // Conflicting schema modifications
  | "concurrent-content-edit" // Both modified content of same entry
  | "concurrent-title-change" // Both changed title of same entry
  | "parse-error" // Failed to parse one or more versions
  | "merge-error"; // Internal merge failure

/**
 * Additional context for conflicts
 */
export interface ConflictContext {
  /**
   * The metadata key involved (for metadata conflicts)
   */
  metadataKey?: string;

  /**
   * The link ID involved (for link conflicts)
   */
  linkId?: string;

  /**
   * The entity name involved (for schema conflicts)
   */
  entityName?: string;

  /**
   * The field name involved (for schema field conflicts)
   */
  fieldName?: string;

  /**
   * Error message (for parse-error and merge-error conflicts)
   */
  errorMessage?: string;
}

/**
 * Statistics about a merge operation
 */
export interface MergeStats {
  /**
   * Total entries in merged result
   */
  totalEntries: number;

  /**
   * Entries present only in ours (additions)
   */
  oursOnly: number;

  /**
   * Entries present only in theirs (additions)
   */
  theirsOnly: number;

  /**
   * Entries present in all three versions unchanged
   */
  common: number;

  /**
   * Entries successfully auto-merged
   */
  autoMerged: number;

  /**
   * Number of conflicts detected
   */
  conflicts: number;
}

/**
 * A matched set of entries across three versions
 */
export interface EntryMatch {
  /**
   * Identity used to match this entry across versions
   */
  identity: EntryIdentity;

  /**
   * Entry from base version (common ancestor)
   * null if entry was added in ours or theirs
   */
  base: Entry | null;

  /**
   * Entry from ours version (local/current)
   * null if entry was deleted in ours
   */
  ours: Entry | null;

  /**
   * Entry from theirs version (incoming)
   * null if entry was deleted in theirs
   */
  theirs: Entry | null;
}

/**
 * Identity used to match entries across versions
 */
export interface EntryIdentity {
  /**
   * Primary identity: Explicit link ID (^link-id)
   * Used when available for matching
   */
  linkId?: string;

  /**
   * Fallback identity: Timestamp for entries without explicit links
   * Combined with entryType for uniqueness
   */
  timestamp?: string;

  /**
   * Entry type (for validation and fallback matching)
   */
  entryType: string;
}

/**
 * Options for the merge driver
 */
export interface MergeOptions {
  /**
   * Conflict marker style
   * - "git": Standard Git style (ours/theirs)
   * - "diff3": Include base section
   */
  markerStyle?: "git" | "diff3";

  /**
   * Whether to include base in markers (diff3 style)
   * Deprecated: Use markerStyle: "diff3" instead
   */
  showBase?: boolean;

  /**
   * Custom conflict detection rules
   * Applied after default rules
   */
  conflictRules?: ConflictRule[];
}

/**
 * A conflict detection rule
 */
export interface ConflictRule {
  /**
   * Rule identifier
   */
  name: string;

  /**
   * Check if this rule applies to a match
   * @returns MergeConflict if conflict detected, null otherwise
   */
  detect: (match: EntryMatch) => MergeConflict | null;
}
