import type { CompletionItem } from "vscode-languageserver";
import type { Workspace } from "@rejot-dev/thalo";
import type { CompletionContext, CompletionContextKind } from "./context.js";

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
