import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace } from "@rejot-dev/thalo";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../completions.js";

/**
 * Format a date as a thalo timestamp (YYYY-MM-DDTHH:MMZ) in UTC.
 */
function formatTimestamp(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}Z`;
}

/**
 * Provider for timestamp completion at the start of a new entry.
 */
export const timestampProvider: CompletionProvider = {
  name: "timestamp",
  contextKinds: ["line_start"],

  getCompletions(_ctx: CompletionContext, _workspace: Workspace): CompletionItem[] {
    const timestamp = formatTimestamp();

    return [
      {
        label: timestamp,
        kind: 12 as CompletionItemKind, // Value
        detail: "Current timestamp",
        documentation: {
          kind: "markdown",
          value: "Insert the current timestamp to start a new entry.",
        },
        insertText: `${timestamp} `,
        // High priority - show first
        sortText: "0",
      },
    ];
  },
};
