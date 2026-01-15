import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace } from "@rejot-dev/thalo";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../completions.js";

/**
 * Provider for section header completion in content area (# Section).
 */
export const sectionProvider: CompletionProvider = {
  name: "section",
  contextKinds: ["section_header"],

  getCompletions(ctx: CompletionContext, workspace: Workspace): CompletionItem[] {
    const partial = ctx.partial.toLowerCase();
    const entity = ctx.entry.entity;
    const items: CompletionItem[] = [];

    if (!entity) {
      return items;
    }

    const schema = workspace.schemaRegistry.get(entity);
    if (!schema) {
      return items;
    }

    // Suggest sections from the schema
    for (const [sectionName, section] of schema.sections) {
      if (partial && !sectionName.toLowerCase().startsWith(partial)) {
        continue;
      }

      const optionalSuffix = section.optional ? " (optional)" : " (required)";

      items.push({
        label: sectionName,
        kind: 22 as CompletionItemKind, // Struct
        detail: `Section${optionalSuffix}`,
        documentation: section.description
          ? {
              kind: "markdown",
              value: section.description,
            }
          : undefined,
        // Insert the full markdown header format
        insertText: ` ${sectionName}`,
        filterText: sectionName,
        // Sort required sections first
        sortText: section.optional ? `1${sectionName}` : `0${sectionName}`,
      });
    }

    return items;
  },
};
