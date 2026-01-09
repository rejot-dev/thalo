import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace, Entry, Timestamp } from "@rejot-dev/thalo";
import { isSyntaxError } from "@rejot-dev/thalo";
import type { LinkDefinition } from "@rejot-dev/thalo";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../types.js";

/**
 * Format a timestamp to string
 */
function formatTimestamp(ts: Timestamp): string {
  const date = `${ts.date.year}-${String(ts.date.month).padStart(2, "0")}-${String(ts.date.day).padStart(2, "0")}`;
  const time = `${String(ts.time.hour).padStart(2, "0")}:${String(ts.time.minute).padStart(2, "0")}`;
  const tz = isSyntaxError(ts.timezone) ? "" : ts.timezone.value;
  return `${date}T${time}${tz}`;
}

/**
 * Get sort text for an entry (prefer recent entries).
 */
function getSortText(entry: Entry): string {
  // Sort by timestamp descending (recent first)
  let ts: Timestamp;
  switch (entry.type) {
    case "instance_entry":
      ts = entry.header.timestamp;
      break;
    case "schema_entry":
      ts = entry.header.timestamp;
      break;
    case "synthesis_entry":
      ts = entry.header.timestamp;
      break;
    case "actualize_entry":
      ts = entry.header.timestamp;
      break;
  }
  const timestamp = formatTimestamp(ts);
  // Invert for sorting
  return timestamp
    .split("")
    .map((c) => String.fromCharCode(126 - c.charCodeAt(0)))
    .join("");
}

/**
 * Get title from an entry
 */
function getEntryTitle(entry: Entry): string {
  switch (entry.type) {
    case "instance_entry":
      return entry.header.title?.value ?? "(no title)";
    case "synthesis_entry":
      return entry.header.title?.value ?? "(no title)";
    case "actualize_entry":
      return `actualize-synthesis ^${entry.header.target.id}`;
    case "schema_entry":
      return entry.header.title?.value ?? "(no title)";
  }
}

/**
 * Get entity description from an entry
 */
function getEntryEntity(entry: Entry): string {
  switch (entry.type) {
    case "instance_entry":
      return entry.header.entity;
    case "synthesis_entry":
      return "synthesis";
    case "actualize_entry":
      return "actualize";
    case "schema_entry":
      return entry.header.entityName.value;
  }
}

/**
 * Format a link completion item.
 */
function formatLinkCompletion(linkId: string, definition: LinkDefinition): CompletionItem {
  const entry = definition.entry;
  const title = getEntryTitle(entry);
  const entity = getEntryEntity(entry);
  let ts: Timestamp;
  switch (entry.type) {
    case "instance_entry":
      ts = entry.header.timestamp;
      break;
    case "schema_entry":
      ts = entry.header.timestamp;
      break;
    case "synthesis_entry":
      ts = entry.header.timestamp;
      break;
    case "actualize_entry":
      ts = entry.header.timestamp;
      break;
  }
  const timestamp = formatTimestamp(ts);

  return {
    label: `^${linkId}`,
    kind: 18 as CompletionItemKind, // Reference
    detail: title,
    documentation: {
      kind: "markdown",
      value: `**${title}**\n\n${timestamp} • ${entity}\n\n*${definition.file}*`,
    },
    insertText: linkId,
    sortText: getSortText(entry),
    filterText: linkId,
  };
}

/**
 * Provider for link completion (^link-id).
 */
export const linkProvider: CompletionProvider = {
  name: "link",
  contextKinds: ["link", "header_suffix"],

  getCompletions(ctx: CompletionContext, workspace: Workspace): CompletionItem[] {
    // For header_suffix, only provide if we're at a ^ position
    if (ctx.kind === "header_suffix" && !ctx.partial.includes("^")) {
      return [];
    }

    const partial =
      ctx.kind === "link"
        ? ctx.partial.toLowerCase()
        : ctx.partial.replace(/.*\^/, "").toLowerCase();

    const items: CompletionItem[] = [];
    const linkIndex = workspace.linkIndex;

    for (const [linkId, definition] of linkIndex.definitions) {
      // Filter by partial text
      if (partial && !linkId.toLowerCase().includes(partial)) {
        // Also check title
        const entry = definition.entry;
        const title = getEntryTitle(entry);
        if (!title.toLowerCase().includes(partial)) {
          continue;
        }
      }

      items.push(formatLinkCompletion(linkId, definition));
    }

    return items;
  },
};
