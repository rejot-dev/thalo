/**
 * Actualize command - finds syntheses and returns information about pending updates.
 */

import type { Workspace } from "../model/workspace.js";
import type { InstanceEntry } from "../ast/types.js";
import {
  findAllSyntheses,
  findLatestActualize,
  getActualizeUpdatedTimestamp,
  findEntryFile,
  getEntrySourceText,
  type SynthesisInfo,
} from "../services/synthesis.js";
import { executeQueries, formatQuery } from "../services/query.js";
import { formatTimestamp } from "../formatters.js";

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
  /** Last actualize timestamp, or null if never actualized */
  lastUpdated: string | null;
  /** The prompt text for the LLM */
  prompt: string | null;
  /** Entries that match the query and are newer than lastUpdated */
  entries: ActualizeEntryInfo[];
  /** Whether the synthesis is up to date (no new entries) */
  isUpToDate: boolean;
}

/**
 * Result of running the actualize command.
 */
export interface ActualizeResult {
  /** Information about each synthesis in the workspace */
  syntheses: SynthesisOutputInfo[];
}

/**
 * Options for running the actualize command.
 */
export interface RunActualizeOptions {
  /** Only process synthesis with this link ID */
  targetLinkId?: string;
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
 * Convert a SynthesisInfo to SynthesisOutputInfo.
 */
function toSynthesisOutputInfo(
  synthesis: SynthesisInfo,
  workspace: Workspace,
): SynthesisOutputInfo {
  // Find latest actualize entry
  const lastActualize = findLatestActualize(workspace, synthesis.linkId);
  const lastUpdated = getActualizeUpdatedTimestamp(lastActualize);

  // Query for new entries (after last update)
  const newEntries = executeQueries(workspace, synthesis.sources, {
    afterTimestamp: lastUpdated ?? undefined,
  });

  // Convert entries to ActualizeEntryInfo
  const entries: ActualizeEntryInfo[] = [];
  for (const entry of newEntries) {
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
    lastUpdated,
    prompt: synthesis.prompt,
    entries,
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
export function runActualize(
  workspace: Workspace,
  options: RunActualizeOptions = {},
): ActualizeResult {
  const { targetLinkId } = options;

  // Find all synthesis definitions
  let syntheses = findAllSyntheses(workspace);

  // Filter to target if specified
  if (targetLinkId) {
    syntheses = syntheses.filter((s) => s.linkId === targetLinkId);
  }

  // Convert to output format
  const synthesisOutputs: SynthesisOutputInfo[] = syntheses.map((s) =>
    toSynthesisOutputInfo(s, workspace),
  );

  return {
    syntheses: synthesisOutputs,
  };
}
