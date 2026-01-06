import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace } from "@wilco/ptall";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../types.js";

/**
 * Format a date as a ptall timestamp (YYYY-MM-DDTHH:MM).
 */
function formatTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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
