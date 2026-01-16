/**
 * Actualize command - finds syntheses and returns information about pending updates.
 * Uses git-based or timestamp-based change tracking to identify modified entries.
 */

import type { Workspace } from "../model/workspace.js";
import type { InstanceEntry } from "../ast/ast-types.js";
import {
  findAllSyntheses,
  findLatestActualize,
  findEntryFile,
  getEntrySourceText,
  type SynthesisInfo,
  type ActualizeInfo,
} from "../services/synthesis.js";
import { formatQuery } from "../services/query.js";
import { formatTimestamp } from "../formatters.js";
// Import only browser-safe parts - types and timestamp tracker
// The git tracker must be passed in from the caller (CLI) to avoid Node.js deps
import {
  parseCheckpoint,
  type ChangeTracker,
  type ChangeMarker,
} from "../services/change-tracker/change-tracker.js";
import { TimestampChangeTracker } from "../services/change-tracker/timestamp-tracker.js";

/**
 * Default instructions template for actualization.
 * Uses placeholders: {file}, {linkId}, {checkpoint}, {timestamp}
 */
export const DEFAULT_INSTRUCTIONS_TEMPLATE = `1. Update only the synthesis content directly below the \`\`\`thalo block in {file}
2. Do NOT modify the \`\`\`thalo block or the define-synthesis entry; the only change inside the block is appending the actualize entry in step 4
3. Place output BEFORE any subsequent \`\`\`thalo blocks
4. Append to the thalo block: {timestamp} actualize-synthesis ^{linkId}
   with metadata: checkpoint: "{checkpoint}"`;

/**
 * Parameters for generating instructions.
 */
export interface InstructionsParams {
  /** Relative file path */
  file: string;
  /** Link ID for the synthesis */
  linkId: string;
  /** Checkpoint value */
  checkpoint: string;
  /** Current timestamp for the actualize entry */
  timestamp: string;
}

/**
 * Generate instructions from a template with placeholder substitution.
 */
export function generateInstructions(template: string, params: InstructionsParams): string {
  return template
    .replace(/\{file\}/g, params.file)
    .replace(/\{linkId\}/g, params.linkId)
    .replace(/\{checkpoint\}/g, params.checkpoint)
    .replace(/\{timestamp\}/g, params.timestamp);
}

/**
 * Generate a timestamp string suitable for thalo entries.
 * Format: ISO 8601 with minute precision (e.g., "2026-01-13T10:30Z")
 */
export function generateTimestamp(date: Date = new Date()): string {
  return date.toISOString().slice(0, 16) + "Z";
}

// ===================
// Types
// ===================

/**
 * Information about a matching entry for a synthesis.
 */
export interface ActualizeEntryInfo {
  /** File path containing the entry */
  file: string;
  /** Formatted timestamp string */
  timestamp: string;
  /** Entity type */
  entity: string;
  /** Entry title */
  title: string;
  /** Link ID if present */
  linkId: string | null;
  /** Tags on the entry */
  tags: string[];
  /** Raw source text of the entry */
  rawText: string;
}

/**
 * Information about a synthesis and its pending updates.
 */
export interface SynthesisOutputInfo {
  /** File path containing the synthesis definition */
  file: string;
  /** Title of the synthesis */
  title: string;
  /** Link ID for the synthesis */
  linkId: string;
  /** Source queries as formatted strings */
  sources: string[];
  /** Last checkpoint marker, or null if never actualized */
  lastCheckpoint: ChangeMarker | null;
  /** The prompt text for the LLM */
  prompt: string | null;
  /** Entries that have changed since last checkpoint */
  entries: ActualizeEntryInfo[];
  /** Current checkpoint marker to store */
  currentCheckpoint: ChangeMarker;
  /** Whether the synthesis is up to date (no new entries) */
  isUpToDate: boolean;
}

/**
 * Result of running the actualize command.
 */
export interface ActualizeResult {
  /** Information about each synthesis in the workspace */
  syntheses: SynthesisOutputInfo[];
  /** Type of change tracker used */
  trackerType: "git" | "ts";
  /** Link IDs that were not found (when filtering) */
  notFoundLinkIds: string[];
}

/**
 * Options for running the actualize command.
 */
export interface RunActualizeOptions {
  /** Only process syntheses with these link IDs (optional ^ prefix is stripped) */
  targetLinkIds?: string[];
  /**
   * Pre-created change tracker to use.
   * If not provided, a browser-safe TimestampChangeTracker is used.
   * CLI should pass a GitChangeTracker for proper git-based tracking.
   */
  tracker?: ChangeTracker;
}

/**
 * Parse link IDs, stripping optional ^ prefix.
 */
export function parseLinkIds(ids: string[]): string[] {
  return ids.map((id) => (id.startsWith("^") ? id.slice(1) : id));
}

/**
 * Get the change marker from an actualize entry.
 * Reads from the checkpoint metadata field.
 */
function getActualizeMarker(actualize: ActualizeInfo | null): ChangeMarker | null {
  if (!actualize) {
    return null;
  }
  const checkpoint = actualize.entry.metadata.find((m) => m.key.value === "checkpoint");
  return parseCheckpoint(checkpoint?.value.raw);
}

/**
 * Convert an InstanceEntry to ActualizeEntryInfo.
 */
function toActualizeEntryInfo(
  entry: InstanceEntry,
  file: string,
  workspace: Workspace,
): ActualizeEntryInfo {
  const model = workspace.getModel(file);
  const rawText = model ? getEntrySourceText(entry, model.source) : "";

  return {
    file,
    timestamp: formatTimestamp(entry.header.timestamp),
    entity: entry.header.entity,
    title: entry.header.title.value,
    linkId: entry.header.link?.id ?? null,
    tags: entry.header.tags.map((t) => t.name),
    rawText,
  };
}

/**
 * Process a single synthesis and get its output info.
 */
async function processSynthesis(
  synthesis: SynthesisInfo,
  workspace: Workspace,
  tracker: ChangeTracker,
): Promise<SynthesisOutputInfo> {
  // Find latest actualize entry and its checkpoint
  const lastActualize = findLatestActualize(workspace, synthesis.linkId);
  const lastCheckpoint = getActualizeMarker(lastActualize);

  // Get changed entries using the tracker
  const { entries: changedEntries, currentMarker } = await tracker.getChangedEntries(
    workspace,
    synthesis.sources,
    lastCheckpoint,
  );

  // Convert entries to ActualizeEntryInfo
  const entries: ActualizeEntryInfo[] = [];
  for (const entry of changedEntries) {
    const file = findEntryFile(workspace, entry);
    if (file) {
      entries.push(toActualizeEntryInfo(entry, file, workspace));
    }
  }

  return {
    file: synthesis.file,
    title: synthesis.title,
    linkId: synthesis.linkId,
    sources: synthesis.sources.map(formatQuery),
    lastCheckpoint,
    prompt: synthesis.prompt,
    entries,
    currentCheckpoint: currentMarker,
    isUpToDate: entries.length === 0,
  };
}

/**
 * Run the actualize command on a workspace.
 *
 * @param workspace - The workspace containing synthesis definitions
 * @param options - Actualize options
 * @returns Structured actualize results
 */
export async function runActualize(
  workspace: Workspace,
  options: RunActualizeOptions = {},
): Promise<ActualizeResult> {
  const { targetLinkIds, tracker: providedTracker } = options;

  // Use provided tracker or fall back to browser-safe timestamp tracker
  const tracker = providedTracker ?? new TimestampChangeTracker();

  // Find all synthesis definitions
  let syntheses = findAllSyntheses(workspace);
  const notFoundLinkIds: string[] = [];

  // Filter to targets if specified
  if (targetLinkIds && targetLinkIds.length > 0) {
    const normalizedIds = parseLinkIds(targetLinkIds);
    const filtered = syntheses.filter((s) => normalizedIds.includes(s.linkId));

    // Track which IDs weren't found
    const foundIds = new Set(filtered.map((s) => s.linkId));
    for (const id of normalizedIds) {
      if (!foundIds.has(id)) {
        notFoundLinkIds.push(id);
      }
    }

    syntheses = filtered;
  }

  // Process each synthesis
  const synthesisOutputs: SynthesisOutputInfo[] = await Promise.all(
    syntheses.map((s) => processSynthesis(s, workspace, tracker)),
  );

  return {
    syntheses: synthesisOutputs,
    trackerType: tracker.type,
    notFoundLinkIds,
  };
}
