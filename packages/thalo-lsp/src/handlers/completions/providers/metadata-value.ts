import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace, ModelTypeExpression } from "@rejot-dev/thalo";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../types.js";

/**
 * Extract literal values from a type expression.
 */
function extractLiteralValues(type: ModelTypeExpression): string[] {
  switch (type.kind) {
    case "literal":
      return [type.value];
    case "union":
      return type.members.flatMap((m) => extractLiteralValues(m));
    default:
      return [];
  }
}

/**
 * Check if a type accepts links.
 */
function acceptsLinks(type: ModelTypeExpression): boolean {
  switch (type.kind) {
    case "primitive":
      return type.name === "link";
    case "array":
      return acceptsLinks(type.elementType);
    case "union":
      return type.members.some((m) => acceptsLinks(m));
    default:
      return false;
  }
}

/**
 * Provider for metadata value completion.
 */
export const metadataValueProvider: CompletionProvider = {
  name: "metadata-value",
  contextKinds: ["metadata_value"],

  getCompletions(ctx: CompletionContext, workspace: Workspace): CompletionItem[] {
    const partial = ctx.partial.toLowerCase();
    const entity = ctx.entry.entity;
    const metadataKey = ctx.metadataKey;
    const items: CompletionItem[] = [];

    // Skip if this is a schema entry
    if (ctx.entry.isSchemaEntry) {
      return items;
    }

    if (!entity || !metadataKey) {
      return items;
    }

    const schema = workspace.schemaRegistry.get(entity);
    if (!schema) {
      return items;
    }

    const field = schema.fields.get(metadataKey);
    if (!field) {
      return items;
    }

    // Get literal values from the type
    const literals = extractLiteralValues(field.type);
    for (const value of literals) {
      if (partial && !value.toLowerCase().startsWith(partial)) {
        continue;
      }
      items.push({
        label: value,
        kind: 12 as CompletionItemKind, // Value
        detail: `Valid value for ${metadataKey}`,
        insertText: value,
        filterText: value,
      });
    }

    // If the field accepts links and we have a partial that starts with ^, provide link completions
    // (but link completions are primarily handled by the link provider via "link" context)

    // Special case: subject field often uses ^self
    if (metadataKey === "subject" && acceptsLinks(field.type)) {
      if (!partial || "self".startsWith(partial) || "^self".startsWith(partial)) {
        items.push({
          label: "^self",
          kind: 18 as CompletionItemKind, // Reference
          detail: "Reference to yourself",
          documentation: {
            kind: "markdown",
            value: "Use `^self` for personal lore entries about yourself.",
          },
          insertText: "^self",
          filterText: "self",
          sortText: "0", // High priority
        });
      }
    }

    return items;
  },
};
