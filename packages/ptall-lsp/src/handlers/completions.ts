import type {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  Position,
} from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Workspace, ModelEntry, LinkDefinition } from "@wilco/ptall";

/**
 * Get the text before the cursor on the current line
 */
function getTextBeforeCursor(document: TextDocument, position: Position): string {
  const line = document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  });
  return line;
}

/**
 * Check if we're in a context where link completion is appropriate
 */
function isLinkContext(textBefore: string): boolean {
  // Check for ^ character
  return textBefore.endsWith("^") || /\^[\w\-:]*$/.test(textBefore);
}

/**
 * Check if we're in a context where tag completion is appropriate
 */
function isTagContext(textBefore: string): boolean {
  // Check for # character (but not in markdown headers)
  const trimmed = textBefore.trimStart();
  // Skip markdown headers (##, ###, etc.)
  if (/^#+\s/.test(trimmed)) {
    return false;
  }
  return textBefore.endsWith("#") || /#[\w-]*$/.test(textBefore);
}

/**
 * Get the partial text being typed (for filtering)
 */
function getPartialText(textBefore: string, prefix: string): string {
  const match = textBefore.match(new RegExp(`\\${prefix}([\\w\\-:]*)$`));
  return match ? match[1] : "";
}

/**
 * Format a link completion item
 */
function formatLinkCompletion(linkId: string, definition: LinkDefinition): CompletionItem {
  const entry = definition.entry;
  const title = entry.kind === "instance" ? entry.title : entry.title;
  const entity = entry.kind === "instance" ? entry.entity : entry.entityName;

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
 * Get sort text for an entry (prefer recent entries)
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
 * Format a tag completion item
 */
function formatTagCompletion(tag: string, count: number): CompletionItem {
  return {
    label: `#${tag}`,
    kind: 20 as CompletionItemKind, // Keyword
    detail: `${count} ${count === 1 ? "entry" : "entries"}`,
    insertText: tag,
    filterText: tag,
  };
}

/**
 * Get all unique tags from the workspace with counts
 */
function getTagsWithCounts(workspace: Workspace): Map<string, number> {
  const tagCounts = new Map<string, number>();

  for (const entry of workspace.allEntries()) {
    for (const tag of entry.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return tagCounts;
}

/**
 * Handle textDocument/completion request
 *
 * Provides completions for:
 * - ^link-ids (timestamps and explicit link IDs)
 * - #tags
 *
 * @param workspace - The ptall workspace
 * @param document - The text document
 * @param params - Completion parameters
 * @returns Array of completion items
 */
export function handleCompletion(
  workspace: Workspace,
  document: TextDocument,
  params: CompletionParams,
): CompletionItem[] {
  const textBefore = getTextBeforeCursor(document, params.position);
  const items: CompletionItem[] = [];

  // Link completions (^)
  if (isLinkContext(textBefore)) {
    const partial = getPartialText(textBefore, "^").toLowerCase();
    const linkIndex = workspace.linkIndex;

    for (const [linkId, definition] of linkIndex.definitions) {
      // Filter by partial text
      if (partial && !linkId.toLowerCase().includes(partial)) {
        // Also check title
        const title =
          definition.entry.kind === "instance" ? definition.entry.title : definition.entry.title;
        if (!title.toLowerCase().includes(partial)) {
          continue;
        }
      }

      items.push(formatLinkCompletion(linkId, definition));
    }
  }

  // Tag completions (#)
  if (isTagContext(textBefore)) {
    const partial = getPartialText(textBefore, "#").toLowerCase();
    const tagCounts = getTagsWithCounts(workspace);

    for (const [tag, count] of tagCounts) {
      // Filter by partial text
      if (partial && !tag.toLowerCase().includes(partial)) {
        continue;
      }

      items.push(formatTagCompletion(tag, count));
    }
  }

  return items;
}

/**
 * Handle completionItem/resolve request
 *
 * Provides additional details for a completion item.
 *
 * @param item - The completion item to resolve
 * @returns The resolved completion item
 */
export function handleCompletionResolve(item: CompletionItem): CompletionItem {
  // For now, all details are included in the initial response
  return item;
}
