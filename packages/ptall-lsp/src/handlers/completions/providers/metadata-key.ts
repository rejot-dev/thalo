import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace } from "@wilco/ptall";
import { TypeExpr } from "@wilco/ptall";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../types.js";

/**
 * Provider for metadata key completion in instance entries.
 */
export const metadataKeyProvider: CompletionProvider = {
  name: "metadata-key",
  contextKinds: ["metadata_key"],

  getCompletions(ctx: CompletionContext, workspace: Workspace): CompletionItem[] {
    const partial = ctx.partial.toLowerCase();
    const entity = ctx.entry.entity;
    const existingKeys = ctx.entry.existingMetadataKeys ?? [];
    const items: CompletionItem[] = [];

    // Skip if this is a schema entry (they use field_type context)
    if (ctx.entry.isSchemaEntry) {
      return items;
    }

    // Get schema for the entity
    if (!entity) {
      return items;
    }

    const schema = workspace.schemaRegistry.get(entity);
    if (!schema) {
      return items;
    }

    // Suggest fields from the schema
    for (const [fieldName, field] of schema.fields) {
      // Skip already-used keys
      if (existingKeys.includes(fieldName)) {
        continue;
      }

      // Filter by partial
      if (partial && !fieldName.toLowerCase().startsWith(partial)) {
        continue;
      }

      const typeStr = TypeExpr.toString(field.type);
      const optionalSuffix = field.optional ? " (optional)" : " (required)";

      items.push({
        label: fieldName,
        kind: 5 as CompletionItemKind, // Field
        detail: `${typeStr}${optionalSuffix}`,
        documentation: field.description
          ? {
              kind: "markdown",
              value: field.description,
            }
          : undefined,
        insertText: `${fieldName}: `,
        filterText: fieldName,
        // Sort required fields first
        sortText: field.optional ? `1${fieldName}` : `0${fieldName}`,
      });
    }

    return items;
  },
};
