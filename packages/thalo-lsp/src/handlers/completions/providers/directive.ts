import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace } from "@rejot-dev/thalo";
import {
  ALL_DIRECTIVES,
  INSTANCE_DIRECTIVES,
  SCHEMA_DIRECTIVES,
  type Directive,
} from "@rejot-dev/thalo";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../types.js";

/**
 * Get description for a directive.
 */
function getDirectiveDescription(directive: Directive): string {
  switch (directive) {
    case "create":
      return "Create a new instance entry (lore, opinion, reference, journal)";
    case "update":
      return "Update an existing entry (reference a previous entry with supersedes:)";
    case "define-entity":
      return "Define a new entity schema with fields and sections";
    case "alter-entity":
      return "Modify an existing entity schema (add/remove fields or sections)";
    case "define-synthesis":
      return "Define a synthesis operation that queries entries and generates content via LLM";
    case "actualize-synthesis":
      return "Trigger a synthesis to regenerate its output based on current data";
  }
}

/**
 * Get detail text for a directive.
 */
function getDirectiveDetail(directive: Directive): string {
  if ((INSTANCE_DIRECTIVES as readonly string[]).includes(directive)) {
    return "Instance directive";
  }
  if ((SCHEMA_DIRECTIVES as readonly string[]).includes(directive)) {
    return "Schema directive";
  }
  return "Synthesis directive";
}

/**
 * Provider for directive completion after timestamp.
 */
export const directiveProvider: CompletionProvider = {
  name: "directive",
  contextKinds: ["after_timestamp"],

  getCompletions(ctx: CompletionContext, _workspace: Workspace): CompletionItem[] {
    const partial = ctx.partial.toLowerCase();

    return ALL_DIRECTIVES.filter((d) => !partial || d.toLowerCase().startsWith(partial)).map(
      (directive, index) => ({
        label: directive,
        kind: 14 as CompletionItemKind, // Keyword
        detail: getDirectiveDetail(directive),
        documentation: {
          kind: "markdown",
          value: getDirectiveDescription(directive),
        },
        insertText: `${directive} `,
        // Sort instance directives before schema directives
        sortText: String(index),
        filterText: directive,
      }),
    );
  },
};
