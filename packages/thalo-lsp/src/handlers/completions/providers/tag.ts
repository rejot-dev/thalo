import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace, Entry } from "@rejot-dev/thalo";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../types.js";

/**
 * Get tags from an entry
 */
function getEntryTags(entry: Entry): string[] {
  switch (entry.type) {
    case "instance_entry":
      return entry.header.tags.map((t) => t.name);
    case "schema_entry":
      return entry.header.tags.map((t) => t.name);
    case "synthesis_entry":
      return entry.header.tags.map((t) => t.name);
    case "actualize_entry":
      // Actualize entries don't have tags
      return [];
  }
}

/**
 * Get all unique tags from the workspace with counts.
 */
function getTagsWithCounts(workspace: Workspace): Map<string, number> {
  const tagCounts = new Map<string, number>();

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      for (const tag of getEntryTags(entry)) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
  }

  return tagCounts;
}

/**
 * Format a tag completion item.
 */
function formatTagCompletion(tag: string, count: number): CompletionItem {
  return {
    label: `#${tag}`,
    kind: 20 as CompletionItemKind, // Keyword
    detail: `${count} ${count === 1 ? "entry" : "entries"}`,
    insertText: tag,
    filterText: tag,
    // Sort by count (most used first)
    sortText: String(1000000 - count).padStart(7, "0"),
  };
}

/**
 * Provider for tag completion (#tag).
 */
export const tagProvider: CompletionProvider = {
  name: "tag",
  contextKinds: ["tag", "header_suffix"],

  getCompletions(ctx: CompletionContext, workspace: Workspace): CompletionItem[] {
    // For header_suffix, only provide if we're at a # position
    if (ctx.kind === "header_suffix" && !ctx.partial.includes("#")) {
      return [];
    }

    const partial =
      ctx.kind === "tag" ? ctx.partial.toLowerCase() : ctx.partial.replace(/.*#/, "").toLowerCase();

    const items: CompletionItem[] = [];
    const tagCounts = getTagsWithCounts(workspace);

    for (const [tag, count] of tagCounts) {
      // Filter by partial text
      if (partial && !tag.toLowerCase().includes(partial)) {
        continue;
      }

      items.push(formatTagCompletion(tag, count));
    }

    return items;
  },
};
