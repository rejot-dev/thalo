import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace, ModelEntry, LinkDefinition } from "@wilco/ptall";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../types.js";

/**
 * Get sort text for an entry (prefer recent entries).
 */
function getSortText(entry: ModelEntry): string {
  // Sort by timestamp descending (recent first)
  // Timestamps are ISO format, so we can invert them for sorting
  return entry.timestamp
    .split("")
    .map((c) => String.fromCharCode(126 - c.charCodeAt(0)))
    .join("");
}

/**
 * Format a link completion item.
 */
function formatLinkCompletion(linkId: string, definition: LinkDefinition): CompletionItem {
  const entry = definition.entry;
  const title =
    entry.kind === "instance" || entry.kind === "synthesis"
      ? entry.title
      : entry.kind === "actualize"
        ? `actualize-synthesis ^${entry.target}`
        : entry.title;
  const entity =
    entry.kind === "instance"
      ? entry.entity
      : entry.kind === "synthesis"
        ? "synthesis"
        : entry.kind === "actualize"
          ? "actualize"
          : entry.entityName;

  return {
    label: `^${linkId}`,
    kind: 18 as CompletionItemKind, // Reference
    detail: title,
    documentation: {
      kind: "markdown",
      value: `**${title}**\n\n${entry.timestamp} • ${entity}\n\n*${definition.file}*`,
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
        const title =
          entry.kind === "instance" || entry.kind === "synthesis"
            ? entry.title
            : entry.kind === "actualize"
              ? `actualize-synthesis ^${entry.target}`
              : entry.title;
        if (!title.toLowerCase().includes(partial)) {
          continue;
        }
      }

      items.push(formatLinkCompletion(linkId, definition));
    }

    return items;
  },
};
