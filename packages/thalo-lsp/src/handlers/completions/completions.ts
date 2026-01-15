/**
 * Completions handler for the thalo LSP.
 *
 * Provides intelligent completions for:
 * - Timestamps at line start
 * - Directives (create, update, define-entity, alter-entity)
 * - Entity types (built-in and schema-defined)
 * - Metadata keys and values (schema-aware)
 * - Links (^link-id) and tags (#tag)
 * - Content sections (schema-aware)
 * - Schema field types
 */

import type { CompletionItem, CompletionParams } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Workspace } from "@rejot-dev/thalo";
import { detectContext } from "./context.js";
import type { CompletionContext, CompletionContextKind } from "./context.js";
import { allProviders } from "./providers/providers.js";

/**
 * A completion provider that handles one or more context kinds.
 */
export interface CompletionProvider {
  /** Human-readable name for debugging */
  readonly name: string;

  /** Which context kinds this provider handles */
  readonly contextKinds: readonly CompletionContextKind[];

  /**
   * Get completions for the given context.
   *
   * @param ctx - The completion context (cursor position, partial text, etc.)
   * @param workspace - The thalo workspace for schema/link lookups
   * @returns Array of completion items
   */
  getCompletions(ctx: CompletionContext, workspace: Workspace): CompletionItem[];
}

/**
 * Handle textDocument/completion request.
 *
 * @param workspace - The thalo workspace for schema/link lookups
 * @param document - The text document
 * @param params - Completion parameters
 * @returns Array of completion items
 */
export function handleCompletion(
  workspace: Workspace,
  document: TextDocument,
  params: CompletionParams,
): CompletionItem[] {
  const ctx = detectContext(document, params.position);
  const items: CompletionItem[] = [];

  for (const provider of allProviders) {
    if (provider.contextKinds.includes(ctx.kind)) {
      items.push(...provider.getCompletions(ctx, workspace));
    }
  }

  return items;
}

/**
 * Handle completionItem/resolve request.
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

// Re-export types and utilities for testing
export { detectContext, type CompletionContext, type CompletionContextKind } from "./context.js";
export { allProviders } from "./providers/providers.js";
