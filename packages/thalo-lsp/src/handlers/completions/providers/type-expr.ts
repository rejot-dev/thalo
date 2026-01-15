import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace } from "@rejot-dev/thalo";
import { PRIMITIVE_TYPES, type PrimitiveType } from "@rejot-dev/thalo";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../completions.js";

/**
 * Get description for a primitive type.
 */
function getPrimitiveTypeDescription(type: PrimitiveType): string {
  switch (type) {
    case "string":
      return "Any text value";
    case "datetime":
      return "Date value (YYYY-MM-DD)";
    case "daterange":
      return "Date range (YYYY ~ YYYY, YYYY-MM, YYYY Q1, etc.)";
    case "link":
      return "Reference to another entry (^link-id)";
    case "number":
      return "Numeric value (integer or float)";
  }
}

/**
 * Provider for type expression completion in schema field definitions.
 */
export const typeExprProvider: CompletionProvider = {
  name: "type-expr",
  contextKinds: ["field_type"],

  getCompletions(ctx: CompletionContext, _workspace: Workspace): CompletionItem[] {
    const partial = ctx.partial.toLowerCase();
    const items: CompletionItem[] = [];

    // Suggest primitive types
    for (const type of PRIMITIVE_TYPES) {
      if (partial && !type.toLowerCase().startsWith(partial)) {
        continue;
      }

      items.push({
        label: type,
        kind: 25 as CompletionItemKind, // TypeParameter
        detail: "Primitive type",
        documentation: {
          kind: "markdown",
          value: getPrimitiveTypeDescription(type),
        },
        insertText: type,
        filterText: type,
      });
    }

    // Suggest starting a literal type with quote
    if (!partial || '"'.startsWith(partial)) {
      items.push({
        label: '"..."',
        kind: 12 as CompletionItemKind, // Value
        detail: "Literal type",
        documentation: {
          kind: "markdown",
          value: 'Define a literal value type (e.g., "article" | "video")',
        },
        insertText: '"',
        filterText: '"',
      });
    }

    return items;
  },
};
