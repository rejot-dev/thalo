import type { Workspace } from "../model/workspace.js";
import type {
  SynthesisEntry,
  ActualizeEntry,
  InstanceEntry,
  Timestamp,
  Query as AstQuery,
  QueryCondition as AstQueryCondition,
} from "../ast/types.js";
import { isSyntaxError } from "../ast/types.js";
import type { Query, QueryCondition } from "../model/types.js";

/**
 * Information about a synthesis definition including file context
 */
export interface SynthesisInfo {
  /** The synthesis entry */
  entry: SynthesisEntry;
  /** File containing this synthesis */
  file: string;
  /** The link ID for this synthesis */
  linkId: string;
  /** Title of the synthesis */
  title: string;
  /** Source queries for this synthesis */
  sources: Query[];
  /** The prompt text (if defined) */
  prompt: string | null;
}

/**
 * Information about an actualize entry including file context
 */
export interface ActualizeInfo {
  /** The actualize entry */
  entry: ActualizeEntry;
  /** File containing this actualize */
  file: string;
  /** Target synthesis link ID */
  target: string;
  /** Formatted timestamp of the actualize entry */
  timestamp: string;
}

/**
 * Format a timestamp to ISO-like string for comparisons and display.
 * Example: "2026-01-07T12:00Z" or "2026-01-07T12:00+05:30"
 */
export function formatTimestamp(ts: Timestamp): string {
  const date = `${ts.date.year}-${String(ts.date.month).padStart(2, "0")}-${String(ts.date.day).padStart(2, "0")}`;
  const time = `${String(ts.time.hour).padStart(2, "0")}:${String(ts.time.minute).padStart(2, "0")}`;
  const tz = isSyntaxError(ts.timezone) ? "" : ts.timezone.value;
  return `${date}T${time}${tz}`;
}

/**
 * Convert an AST Query to a Model Query.
 * The AST Query comes from parsing, while Model Query is used for execution.
 */
export function astQueryToModelQuery(astQuery: AstQuery): Query {
  return {
    entity: astQuery.entity,
    conditions: astQuery.conditions.map((c: AstQueryCondition): QueryCondition => {
      switch (c.type) {
        case "field_condition":
          return { kind: "field", field: c.field, value: c.value };
        case "tag_condition":
          return { kind: "tag", tag: c.tag };
        case "link_condition":
          return { kind: "link", link: c.linkId };
      }
    }),
  };
}

/**
 * Extract source queries from a synthesis entry's metadata.
 * Sources can be a single query or an array of queries.
 */
export function getSynthesisSources(synthesis: SynthesisEntry): Query[] {
  const sourcesMeta = synthesis.metadata.find((m) => m.key.value === "sources");
  if (!sourcesMeta) {
    return [];
  }

  const content = sourcesMeta.value.content;
  if (content.type === "query_value") {
    return [astQueryToModelQuery(content.query)];
  }
  if (content.type === "value_array") {
    return content.elements
      .filter((e): e is AstQuery => e.type === "query")
      .map(astQueryToModelQuery);
  }
  return [];
}

/**
 * Extract the prompt text from a synthesis entry's content.
 * Looks for content under a "# Prompt" header.
 */
export function getSynthesisPrompt(synthesis: SynthesisEntry): string | null {
  if (!synthesis.content) {
    return null;
  }

  let inPrompt = false;
  const promptLines: string[] = [];

  for (const child of synthesis.content.children) {
    if (child.type === "markdown_header") {
      const headerText = child.text.toLowerCase();
      if (headerText.includes("prompt")) {
        inPrompt = true;
      } else {
        inPrompt = false;
      }
    } else if (child.type === "content_line" && inPrompt) {
      promptLines.push(child.text);
    }
  }

  return promptLines.length > 0 ? promptLines.join("\n").trim() : null;
}

/**
 * Find all synthesis definitions in a workspace.
 *
 * @param workspace - The workspace to search
 * @returns Array of synthesis info objects with file context
 */
export function findAllSyntheses(workspace: Workspace): SynthesisInfo[] {
  const syntheses: SynthesisInfo[] = [];

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (entry.type === "synthesis_entry") {
        syntheses.push({
          entry,
          file: model.file,
          linkId: entry.header.linkId.id,
          title: entry.header.title?.value ?? "(no title)",
          sources: getSynthesisSources(entry),
          prompt: getSynthesisPrompt(entry),
        });
      }
    }
  }

  return syntheses;
}

/**
 * Find the latest actualize entry for a given synthesis by link ID.
 * Searches across all files in the workspace.
 *
 * @param workspace - The workspace to search
 * @param synthesisLinkId - The link ID of the synthesis to find actualizes for
 * @returns The latest actualize info, or null if none found
 */
export function findLatestActualize(
  workspace: Workspace,
  synthesisLinkId: string,
): ActualizeInfo | null {
  let latest: ActualizeInfo | null = null;

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (entry.type !== "actualize_entry") {
        continue;
      }
      if (entry.header.target.id !== synthesisLinkId) {
        continue;
      }

      const ts = formatTimestamp(entry.header.timestamp);
      if (!latest || ts > latest.timestamp) {
        latest = {
          entry,
          file: model.file,
          target: entry.header.target.id,
          timestamp: ts,
        };
      }
    }
  }

  return latest;
}

/**
 * Get the 'updated' timestamp from an actualize entry's metadata.
 *
 * @param actualize - The actualize info (or null)
 * @returns The updated timestamp string, or null if not found
 */
export function getActualizeUpdatedTimestamp(actualize: ActualizeInfo | null): string | null {
  if (!actualize) {
    return null;
  }
  const updated = actualize.entry.metadata.find((m) => m.key.value === "updated");
  return updated?.value.raw ?? null;
}

/**
 * Find which file and model contain a specific entry.
 * Uses object identity first, then falls back to location matching.
 *
 * @param workspace - The workspace to search
 * @param entry - The entry to find
 * @returns The file path, or undefined if not found
 */
export function findEntryFile(workspace: Workspace, entry: InstanceEntry): string | undefined {
  // First try object identity (fast path when entry came from this workspace)
  for (const model of workspace.allModels()) {
    for (const e of model.ast.entries) {
      if (e === entry) {
        return model.file;
      }
    }
  }

  // Fallback: match by location and timestamp (for entries that may have been cloned)
  const entryTs = formatTimestamp(entry.header.timestamp);
  for (const model of workspace.allModels()) {
    for (const e of model.ast.entries) {
      if (e.type !== "instance_entry") {
        continue;
      }
      // Match by timestamp and location for uniqueness
      const eTs = formatTimestamp(e.header.timestamp);
      if (
        eTs === entryTs &&
        e.location.startIndex === entry.location.startIndex &&
        e.location.endIndex === entry.location.endIndex
      ) {
        return model.file;
      }
    }
  }

  return undefined;
}

/**
 * Get the raw source text for an entry from its file.
 * Requires providing a function to read file contents (to avoid filesystem dependency).
 *
 * @param entry - The entry to get text for
 * @param source - The source text of the file containing the entry
 * @returns The raw entry text
 */
export function getEntrySourceText(entry: InstanceEntry, source: string): string {
  const start = entry.location.startIndex;
  const end = entry.location.endIndex;
  return source.slice(start, end).trim();
}
