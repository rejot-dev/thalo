import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace } from "@rejot-dev/thalo";
import { SCHEMA_BLOCK_HEADERS, type SchemaBlockHeader } from "@rejot-dev/thalo";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../completions.js";

/**
 * Get description for a schema block header.
 */
function getBlockDescription(header: SchemaBlockHeader): string {
  switch (header) {
    case "# Metadata":
      return "Define metadata fields for this entity";
    case "# Sections":
      return "Define content sections for this entity";
    case "# Remove Metadata":
      return "Remove metadata fields (alter-entity only)";
    case "# Remove Sections":
      return "Remove sections (alter-entity only)";
  }
}

/**
 * Provider for schema block header completion (# Metadata, # Sections, etc.)
 */
export const schemaBlockProvider: CompletionProvider = {
  name: "schema-block",
  contextKinds: ["schema_block_header"],

  getCompletions(ctx: CompletionContext, _workspace: Workspace): CompletionItem[] {
    const partial = ctx.partial.toLowerCase();
    const directive = ctx.entry.directive;
    const items: CompletionItem[] = [];

    for (const header of SCHEMA_BLOCK_HEADERS) {
      // Remove Metadata/Sections only for alter-entity
      if (
        (header === "# Remove Metadata" || header === "# Remove Sections") &&
        directive !== "alter-entity"
      ) {
        continue;
      }

      // Filter by partial (partial includes the #)
      if (partial && !header.toLowerCase().startsWith(partial)) {
        continue;
      }

      items.push({
        label: header,
        kind: 22 as CompletionItemKind, // Struct
        detail: "Schema block",
        documentation: {
          kind: "markdown",
          value: getBlockDescription(header),
        },
        // Remove the # prefix since we're completing after #
        insertText: header.slice(1), // Remove leading #
        filterText: header,
      });
    }

    return items;
  },
};
