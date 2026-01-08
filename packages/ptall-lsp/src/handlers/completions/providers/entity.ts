import type { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { Workspace } from "@rejot-dev/ptall";
import { isInstanceDirective } from "@rejot-dev/ptall";
import type { CompletionContext } from "../context.js";
import type { CompletionProvider } from "../types.js";

/**
 * Provider for entity type completion after directive.
 *
 * Entity types are defined via `define-entity` and stored in the SchemaRegistry.
 */
export const entityProvider: CompletionProvider = {
  name: "entity",
  contextKinds: ["after_directive"],

  getCompletions(ctx: CompletionContext, workspace: Workspace): CompletionItem[] {
    const partial = ctx.partial.toLowerCase();
    const directive = ctx.entry.directive;
    const items: CompletionItem[] = [];

    // For instance directives (create/update), suggest entities from schema registry
    if (directive && isInstanceDirective(directive)) {
      for (const entityName of workspace.schemaRegistry.entityNames()) {
        if (partial && !entityName.toLowerCase().startsWith(partial)) {
          continue;
        }
        const schema = workspace.schemaRegistry.get(entityName);
        items.push({
          label: entityName,
          kind: 7 as CompletionItemKind, // Class
          detail: "Entity type",
          documentation: schema
            ? {
                kind: "markdown",
                value: `**${schema.description}**\n\nDefined at ${schema.definedAt}`,
              }
            : undefined,
          insertText: `${entityName} `,
          filterText: entityName,
        });
      }
    }

    // For alter-entity, only suggest entities that exist in the schema registry
    if (directive === "alter-entity") {
      for (const entityName of workspace.schemaRegistry.entityNames()) {
        if (partial && !entityName.toLowerCase().startsWith(partial)) {
          continue;
        }
        const schema = workspace.schemaRegistry.get(entityName);
        items.push({
          label: entityName,
          kind: 7 as CompletionItemKind, // Class
          detail: "Existing entity",
          documentation: schema
            ? {
                kind: "markdown",
                value: `**${schema.description}**\n\nDefined at ${schema.definedAt}`,
              }
            : undefined,
          insertText: `${entityName} `,
          filterText: entityName,
        });
      }
    }

    // For define-entity, no suggestions (user creates new name)

    return items;
  },
};
