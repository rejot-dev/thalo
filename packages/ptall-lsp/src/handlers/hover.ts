import type { Hover, Position } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Workspace, ModelEntry, ModelInstanceEntry, ModelSchemaEntry } from "@wilco/ptall";

/**
 * Get the word at a position (for link detection)
 */
function getWordAtPosition(document: TextDocument, position: Position): string | null {
  const line = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  });

  // Find word boundaries around cursor
  const lineText = line.trimEnd();
  let start = position.character;
  let end = position.character;

  // Expand backwards
  while (start > 0 && /[\w\-:^#]/.test(lineText[start - 1])) {
    start--;
  }

  // Expand forwards
  while (end < lineText.length && /[\w\-:]/.test(lineText[end])) {
    end++;
  }

  if (start >= end) {
    return null;
  }

  return lineText.slice(start, end);
}

/**
 * Format an entry for hover display
 */
function formatEntryHover(entry: ModelEntry): string {
  if (entry.kind === "instance") {
    return formatInstanceEntry(entry);
  } else {
    return formatSchemaEntry(entry);
  }
}

/**
 * Format an instance entry for hover
 */
function formatInstanceEntry(entry: ModelInstanceEntry): string {
  const lines: string[] = [];

  // Header
  lines.push(`### ${entry.title}`);
  lines.push("");
  lines.push(`**${entry.directive}** ${entry.entity} • ${entry.timestamp}`);

  // Tags
  if (entry.tags.length > 0) {
    lines.push("");
    lines.push(`Tags: ${entry.tags.map((t) => `\`#${t}\``).join(" ")}`);
  }

  // Link IDs
  const linkIds: string[] = [`\`^${entry.timestamp}\``];
  if (entry.linkId) {
    linkIds.push(`\`^${entry.linkId}\``);
  }
  lines.push("");
  lines.push(`Links: ${linkIds.join(", ")}`);

  // Key metadata
  const metadataToShow = ["subject", "type", "confidence", "status", "ref-type"];
  const shownMetadata: string[] = [];

  for (const key of metadataToShow) {
    const value = entry.metadata.get(key);
    if (value) {
      shownMetadata.push(`**${key}:** ${value.raw}`);
    }
  }

  if (shownMetadata.length > 0) {
    lines.push("");
    lines.push(shownMetadata.join(" • "));
  }

  // File location
  lines.push("");
  lines.push(`*${entry.file}*`);

  return lines.join("\n");
}

/**
 * Format a schema entry for hover
 */
function formatSchemaEntry(entry: ModelSchemaEntry): string {
  const lines: string[] = [];

  // Header
  lines.push(`### ${entry.title}`);
  lines.push("");
  lines.push(`**${entry.directive}** \`${entry.entityName}\` • ${entry.timestamp}`);

  // Tags
  if (entry.tags.length > 0) {
    lines.push("");
    lines.push(`Tags: ${entry.tags.map((t) => `\`#${t}\``).join(" ")}`);
  }

  // Fields summary
  if (entry.fields.length > 0) {
    lines.push("");
    lines.push(`**Fields:** ${entry.fields.map((f) => `\`${f.name}\``).join(", ")}`);
  }

  // Sections summary
  if (entry.sections.length > 0) {
    lines.push("");
    lines.push(`**Sections:** ${entry.sections.map((s) => `\`${s.name}\``).join(", ")}`);
  }

  // File location
  lines.push("");
  lines.push(`*${entry.file}*`);

  return lines.join("\n");
}

/**
 * Format tag hover information
 */
function formatTagHover(tag: string, entries: ModelEntry[]): string {
  const lines: string[] = [];

  lines.push(`### Tag: \`#${tag}\``);
  lines.push("");
  lines.push(`Used in **${entries.length}** ${entries.length === 1 ? "entry" : "entries"}:`);
  lines.push("");

  // Show first few entries
  const toShow = entries.slice(0, 5);
  for (const entry of toShow) {
    const title = entry.kind === "instance" ? entry.title : entry.title;
    lines.push(`- ${title} *(${entry.timestamp})*`);
  }

  if (entries.length > 5) {
    lines.push(`- *...and ${entries.length - 5} more*`);
  }

  return lines.join("\n");
}

/**
 * Handle textDocument/hover request
 *
 * Shows details about ^link-id targets or #tags on hover.
 *
 * @param workspace - The ptall workspace
 * @param document - The text document
 * @param position - The hover position
 * @returns Hover information, or null if nothing to show
 */
export function handleHover(
  workspace: Workspace,
  document: TextDocument,
  position: Position,
): Hover | null {
  const word = getWordAtPosition(document, position);

  if (!word) {
    return null;
  }

  // Check if it's a link reference (^link-id)
  if (word.startsWith("^")) {
    const linkId = word.slice(1);
    const definition = workspace.getLinkDefinition(linkId);

    if (definition) {
      return {
        contents: {
          kind: "markdown",
          value: formatEntryHover(definition.entry),
        },
      };
    }

    // Link not found
    return {
      contents: {
        kind: "markdown",
        value: `⚠️ **Unknown link:** \`${word}\`\n\nNo entry found with this ID.`,
      },
    };
  }

  // Check if it's a tag (#tag)
  if (word.startsWith("#")) {
    const tagName = word.slice(1);
    const entries = workspace.allEntries().filter((e) => e.tags.includes(tagName));

    if (entries.length > 0) {
      return {
        contents: {
          kind: "markdown",
          value: formatTagHover(tagName, entries),
        },
      };
    }
  }

  return null;
}
