import type { Hover, Position } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type {
  Workspace,
  ModelEntry,
  ModelInstanceEntry,
  ModelSchemaEntry,
  ModelSynthesisEntry,
  ModelActualizeEntry,
} from "@wilco/ptall";
import { TypeExpr, type EntitySchema, type FieldSchema, type SectionSchema } from "@wilco/ptall";

// ===================
// Word Detection
// ===================

/**
 * Get the word at a position (for link/tag detection)
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
 * Get the full line text
 */
function getLineText(document: TextDocument, lineNumber: number): string {
  const lineCount = document.lineCount;
  if (lineNumber >= lineCount) {
    return "";
  }
  return document
    .getText({
      start: { line: lineNumber, character: 0 },
      end: { line: lineNumber + 1, character: 0 },
    })
    .trimEnd();
}

// ===================
// Entry Formatting
// ===================

/**
 * Format an entry for hover display
 */
function formatEntryHover(entry: ModelEntry): string {
  if (entry.kind === "instance") {
    return formatInstanceEntry(entry);
  } else if (entry.kind === "synthesis") {
    return formatSynthesisEntry(entry);
  } else if (entry.kind === "actualize") {
    return formatActualizeEntry(entry);
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

  // Link ID
  if (entry.linkId) {
    lines.push("");
    lines.push(`Link: \`^${entry.linkId}\``);
  }

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
 * Format a synthesis entry for hover
 */
function formatSynthesisEntry(entry: ModelSynthesisEntry): string {
  const lines: string[] = [];

  // Header
  lines.push(`### ${entry.title}`);
  lines.push("");
  lines.push(`**define-synthesis** synthesis • ${entry.timestamp}`);

  // Tags
  if (entry.tags.length > 0) {
    lines.push("");
    lines.push(`Tags: ${entry.tags.map((t) => `\`#${t}\``).join(" ")}`);
  }

  // Sources
  if (entry.sources.length > 0) {
    lines.push("");
    lines.push(`**Sources:** ${entry.sources.map((q) => q.entity).join(", ")}`);
  }

  // File location
  lines.push("");
  lines.push(`*${entry.file}*`);

  return lines.join("\n");
}

/**
 * Format an actualize entry for hover
 */
function formatActualizeEntry(entry: ModelActualizeEntry): string {
  const lines: string[] = [];

  // Header
  lines.push(`### actualize-synthesis`);
  lines.push("");
  lines.push(`**actualize-synthesis** ^${entry.target} • ${entry.timestamp}`);

  // Updated timestamp
  const updated = entry.metadata.get("updated");
  if (updated) {
    lines.push("");
    lines.push(`**Updated:** ${updated.raw}`);
  }

  // File location
  lines.push("");
  lines.push(`*${entry.file}*`);

  return lines.join("\n");
}

// ===================
// Directive Documentation
// ===================

/**
 * Get documentation for a directive
 */
function getDirectiveDocumentation(directive: string): string | null {
  switch (directive) {
    case "create":
      return [
        "### `create` directive",
        "",
        "Creates a new instance entry.",
        "",
        "**Syntax:**",
        "```",
        '{timestamp} create {entity} "Title" [^link-id] [#tags...]',
        "  {key}: {value}",
        "  ...",
        "```",
        "",
        "Add an explicit `^link-id` for cross-referencing.",
        "",
        "**Entities:** `journal`, `lore`, `opinion`, `reference`",
      ].join("\n");

    case "update":
      return [
        "### `update` directive",
        "",
        "Updates an existing entry, typically to revise opinions or add information.",
        "",
        "**Syntax:**",
        "```",
        '{timestamp} update {entity} "Title" [^link-id] [#tags...]',
        "  supersedes: ^previous-entry",
        "  ...",
        "```",
        "",
        "Use `supersedes:` metadata to link to the entry being updated.",
        "",
        "**Entities:** `journal`, `lore`, `opinion`, `reference`",
      ].join("\n");

    case "define-entity":
      return [
        "### `define-entity` directive",
        "",
        "Defines a new entity schema with fields and sections.",
        "",
        "**Syntax:**",
        "```",
        '{timestamp} define-entity {name} "Description"',
        "  # Metadata",
        '  field-name: type ; "description"',
        '  optional-field?: type = default ; "description"',
        "  # Sections",
        '  SectionName ; "description"',
        '  OptionalSection? ; "description"',
        "```",
        "",
        '**Field types:** `string`, `date`, `date-range`, `link`, `"literal"`, unions (`|`), arrays (`[]`)',
      ].join("\n");

    case "alter-entity":
      return [
        "### `alter-entity` directive",
        "",
        "Modifies an existing entity schema.",
        "",
        "**Syntax:**",
        "```",
        '{timestamp} alter-entity {name} "Description of change"',
        "  # Metadata",
        '  new-field: type ; "add a field"',
        "  # Remove Metadata",
        '  old-field ; "reason for removal"',
        "  # Sections",
        '  NewSection ; "add a section"',
        "  # Remove Sections",
        '  OldSection ; "reason for removal"',
        "```",
        "",
        "All blocks are optional. Only include what you're changing.",
      ].join("\n");

    case "define-synthesis":
      return [
        "### `define-synthesis` directive",
        "",
        "Defines a synthesis operation that queries entries and generates content via LLM.",
        "",
        "**Syntax:**",
        "```",
        '{timestamp} define-synthesis "Title" ^link-id [#tags...]',
        "  sources: {entity} where {conditions}",
        "",
        "  # Prompt",
        "  Instructions for the LLM...",
        "```",
        "",
        "**Query language:**",
        "- `{entity} where {conditions}` — Query entries",
        "- Conditions: `field = value`, `#tag`, `^link`",
        "- Multiple queries: comma-separated",
        "",
        "**Example:**",
        "```",
        '2026-01-05T10:00 define-synthesis "Career Summary" ^career-summary',
        "  sources: lore where subject = ^self and #career",
        "",
        "  # Prompt",
        "  Write a professional career summary from these lore entries.",
        "```",
      ].join("\n");

    case "actualize-synthesis":
      return [
        "### `actualize-synthesis` directive",
        "",
        "Triggers a synthesis to regenerate its output based on current data.",
        "",
        "**Syntax:**",
        "```",
        "{timestamp} actualize-synthesis ^target-synthesis",
        "  updated: {timestamp}",
        "```",
        "",
        "**Required metadata:**",
        "- `updated:` — Timestamp when the synthesis was actualized",
        "",
        "**Example:**",
        "```",
        "2026-01-05T15:30 actualize-synthesis ^career-summary",
        "  updated: 2026-01-05T15:30",
        "```",
      ].join("\n");

    default:
      return null;
  }
}

// ===================
// Entity Schema Formatting
// ===================

/**
 * Format an entity schema for hover display
 */
function formatEntitySchema(schema: EntitySchema): string {
  const lines: string[] = [];

  lines.push(`### Entity: \`${schema.name}\``);
  lines.push("");
  lines.push(schema.description);
  lines.push("");

  // Fields
  if (schema.fields.size > 0) {
    lines.push("**Metadata Fields:**");
    lines.push("");
    for (const [, field] of schema.fields) {
      const typeStr = TypeExpr.toString(field.type);
      const opt = field.optional ? "?" : "";
      const desc = field.description ? ` — ${field.description}` : "";
      const def = field.defaultValue ? ` (default: \`${field.defaultValue}\`)` : "";
      lines.push(`- \`${field.name}${opt}\`: \`${typeStr}\`${def}${desc}`);
    }
    lines.push("");
  }

  // Sections
  if (schema.sections.size > 0) {
    lines.push("**Sections:**");
    lines.push("");
    for (const [, section] of schema.sections) {
      const opt = section.optional ? " (optional)" : "";
      const desc = section.description ? ` — ${section.description}` : "";
      lines.push(`- \`# ${section.name}\`${opt}${desc}`);
    }
    lines.push("");
  }

  lines.push(`*Defined at ${schema.definedAt} in ${schema.definedIn}*`);

  return lines.join("\n");
}

// ===================
// Field/Section Formatting
// ===================

/**
 * Format a field schema for hover display
 */
function formatFieldHover(field: FieldSchema, entityName: string): string {
  const lines: string[] = [];

  const typeStr = TypeExpr.toString(field.type);
  const opt = field.optional ? " (optional)" : " (required)";

  lines.push(`### Field: \`${field.name}\``);
  lines.push("");
  lines.push(`**Type:** \`${typeStr}\`${opt}`);

  if (field.defaultValue) {
    lines.push("");
    lines.push(`**Default:** \`${field.defaultValue}\``);
  }

  if (field.description) {
    lines.push("");
    lines.push(field.description);
  }

  lines.push("");
  lines.push(`*From entity \`${entityName}\`*`);

  return lines.join("\n");
}

/**
 * Format a section schema for hover display
 */
function formatSectionHover(section: SectionSchema, entityName: string): string {
  const lines: string[] = [];

  const opt = section.optional ? " (optional)" : " (required)";

  lines.push(`### Section: \`# ${section.name}\``);
  lines.push("");
  lines.push(`**Status:** ${opt.trim()}`);

  if (section.description) {
    lines.push("");
    lines.push(section.description);
  }

  lines.push("");
  lines.push(`*From entity \`${entityName}\`*`);

  return lines.join("\n");
}

// ===================
// Type Documentation
// ===================

/**
 * Get documentation for a primitive type
 */
function getPrimitiveTypeDocumentation(typeName: string): string | null {
  switch (typeName) {
    case "string":
      return [
        "### Type: `string`",
        "",
        "Any text value. Can be quoted or unquoted in metadata.",
        "",
        "**Examples:**",
        "```",
        'author: "Jane Doe"',
        "author: Jane Doe",
        "```",
      ].join("\n");

    case "date":
      return [
        "### Type: `date`",
        "",
        "A date in ISO format. Supports multiple precisions.",
        "",
        "**Formats:**",
        "- `YYYY` — year only (e.g., `2024`)",
        "- `YYYY-MM` — year and month (e.g., `2024-05`)",
        "- `YYYY-MM-DD` — full date (e.g., `2024-05-11`)",
        "",
        "**Example:**",
        "```",
        "published: 2024-05-11",
        "```",
      ].join("\n");

    case "date-range":
      return [
        "### Type: `date-range`",
        "",
        "A range between two dates, using `~` separator.",
        "",
        "**Format:** `{date} ~ {date}`",
        "",
        "**Examples:**",
        "```",
        "date: 2020 ~ 2021",
        "date: 2022-05 ~ 2024",
        "date: 2024-01-01 ~ 2024-12-31",
        "```",
      ].join("\n");

    case "link":
      return [
        "### Type: `link`",
        "",
        "A reference to another entry using its link ID.",
        "",
        "**Format:** `^{link-id}`",
        "",
        "Link IDs can be:",
        "- Timestamps (implicit): `^2026-01-05T15:30`",
        "- Explicit IDs: `^opinion-ts-enums`",
        "- Special: `^self` (reference to self/author)",
        "",
        "**Example:**",
        "```",
        "supersedes: ^2026-01-05T15:30",
        "subject: ^self",
        "```",
      ].join("\n");

    default:
      return null;
  }
}

// ===================
// Tag Hover
// ===================

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
    const title =
      entry.kind === "instance" || entry.kind === "synthesis"
        ? entry.title
        : entry.kind === "actualize"
          ? `actualize-synthesis ^${entry.target}`
          : entry.title;
    lines.push(`- ${title} *(${entry.timestamp})*`);
  }

  if (entries.length > 5) {
    lines.push(`- *...and ${entries.length - 5} more*`);
  }

  return lines.join("\n");
}

// ===================
// Timestamp Hover
// ===================

/**
 * Format timestamp hover
 */
function formatTimestampHover(timestamp: string, entry: ModelEntry | undefined): string {
  const lines: string[] = [];

  lines.push(`### Timestamp: \`${timestamp}\``);
  lines.push("");

  if (entry) {
    lines.push("This timestamp identifies an entry:");
    lines.push("");
    const title =
      entry.kind === "instance" || entry.kind === "synthesis"
        ? entry.title
        : entry.kind === "actualize"
          ? `actualize-synthesis ^${entry.target}`
          : entry.title;
    lines.push(`**${title}**`);
    lines.push("");
    if (entry.kind === "instance") {
      lines.push(`\`${entry.directive}\` ${entry.entity}`);
    } else if (entry.kind === "synthesis") {
      lines.push("`define-synthesis` synthesis");
    } else if (entry.kind === "actualize") {
      lines.push(`\`actualize-synthesis\` ^${entry.target}`);
    } else {
      lines.push(`\`${entry.directive}\` ${entry.entityName}`);
    }
    lines.push("");
    lines.push(`Reference with: \`^${timestamp}\``);
  } else {
    lines.push("Entry timestamp.");
    lines.push("");
    lines.push("Add an explicit `^link-id` after the title to enable cross-referencing.");
  }

  return lines.join("\n");
}

// ===================
// Context Detection for Hover
// ===================

interface HoverContext {
  kind:
    | "link"
    | "tag"
    | "directive"
    | "entity"
    | "metadata_key"
    | "timestamp"
    | "type"
    | "section_header"
    | "unknown";
  value: string;
  entityContext?: string; // Current entity name (for metadata key lookups)
}

/** Timestamp pattern */
const TIMESTAMP_PATTERN = /^[12]\d{3}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d$/;
const TIMESTAMP_LINE_PATTERN = /^([12]\d{3}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d)\s+/;

/**
 * Find the entry header by scanning backwards from a line
 */
function findEntryHeader(
  document: TextDocument,
  fromLine: number,
): { line: number; text: string; entity?: string } | undefined {
  for (let i = fromLine; i >= 0; i--) {
    const lineText = getLineText(document, i);
    const match = lineText.match(TIMESTAMP_LINE_PATTERN);
    if (match) {
      // Parse to extract entity
      const parts = lineText.slice(match[0].length).split(/\s+/);
      const entity = parts.length >= 2 ? parts[1] : undefined;
      return { line: i, text: lineText, entity };
    }
    // Stop at non-indented non-empty non-timestamp line
    if (lineText.trim() && !lineText.startsWith(" ") && !lineText.startsWith("\t")) {
      break;
    }
  }
  return undefined;
}

/**
 * Detect what element is at the hover position
 */
function detectHoverContext(document: TextDocument, position: Position): HoverContext {
  const lineText = getLineText(document, position.line);
  const char = position.character;

  // Get word at position for link/tag/general detection
  const word = getWordAtPosition(document, position);

  // Check for link (^link-id)
  if (word?.startsWith("^")) {
    return { kind: "link", value: word.slice(1) };
  }

  // Check for tag (#tag) - but not section headers
  const trimmed = lineText.trimStart();
  if (word?.startsWith("#") && !trimmed.startsWith("#")) {
    return { kind: "tag", value: word.slice(1) };
  }

  // Check if on header line (starts with timestamp)
  const timestampMatch = lineText.match(TIMESTAMP_LINE_PATTERN);
  if (timestampMatch) {
    const timestampEnd = timestampMatch[1].length;

    // Hovering over timestamp itself?
    if (char <= timestampEnd) {
      return { kind: "timestamp", value: timestampMatch[1] };
    }

    // Parse rest of header
    const afterTimestamp = lineText.slice(timestampMatch[0].length);
    const relativeChar = char - timestampMatch[0].length;

    // Find what token we're on
    const tokens = tokenizeHeader(afterTimestamp);
    let offset = 0;

    for (const token of tokens) {
      const tokenStart = offset;
      const tokenEnd = offset + token.text.length;

      if (relativeChar >= tokenStart && relativeChar <= tokenEnd) {
        if (token.type === "directive") {
          return { kind: "directive", value: token.text };
        }
        if (token.type === "entity") {
          return { kind: "entity", value: token.text };
        }
      }

      offset = tokenEnd;
      // Skip whitespace
      const rest = afterTimestamp.slice(offset);
      const ws = rest.match(/^\s*/);
      if (ws) {
        offset += ws[0].length;
      }
    }
  }

  // Check for indented lines (metadata or content)
  const indentMatch = lineText.match(/^([\t ]+)/);
  if (indentMatch) {
    const afterIndent = lineText.slice(indentMatch[0].length);
    const relativeChar = char - indentMatch[0].length;

    // Section header in content (# SectionName)
    // Only show hover if cursor is on actual content (not in indentation)
    if (relativeChar >= 0) {
      const sectionMatch = afterIndent.match(/^#\s*([A-Z][a-zA-Z0-9]*)/);
      if (sectionMatch) {
        const header = findEntryHeader(document, position.line);
        return {
          kind: "section_header",
          value: sectionMatch[1],
          entityContext: header?.entity,
        };
      }
    }

    // Metadata line (key: value)
    const metadataMatch = afterIndent.match(/^([a-z][a-zA-Z0-9\-_]*)\s*:/);
    if (metadataMatch) {
      const keyEnd = metadataMatch[1].length;

      // Hovering over the key? (relativeChar must be >= 0 to be on actual content)
      if (relativeChar >= 0 && relativeChar <= keyEnd) {
        const header = findEntryHeader(document, position.line);
        return {
          kind: "metadata_key",
          value: metadataMatch[1],
          entityContext: header?.entity,
        };
      }
    }

    // Type expression in schema definition (after key:)
    // Check if we're in a schema entry and hovering over a type
    const header = findEntryHeader(document, position.line);
    if (header?.text.includes("define-entity") || header?.text.includes("alter-entity")) {
      // Check for primitive types
      const primitiveMatch = afterIndent.match(/:\s*(string|date-range|date|link)/);
      if (primitiveMatch && word) {
        const typeNames = ["string", "date", "date-range", "link"];
        if (typeNames.includes(word)) {
          return { kind: "type", value: word };
        }
      }
    }
  }

  // Check for standalone timestamp (might be referenced timestamp)
  if (word && TIMESTAMP_PATTERN.test(word)) {
    return { kind: "timestamp", value: word };
  }

  return { kind: "unknown", value: word ?? "" };
}

interface HeaderToken {
  type: "directive" | "entity" | "title" | "link" | "tag" | "unknown";
  text: string;
}

/**
 * Tokenize header content after timestamp
 */
function tokenizeHeader(text: string): HeaderToken[] {
  const tokens: HeaderToken[] = [];
  const directives = [
    "create",
    "update",
    "define-entity",
    "alter-entity",
    "define-synthesis",
    "actualize-synthesis",
  ];

  // Simple regex-based tokenization
  const parts = text.match(/(?:"[^"]*"|[\^#]?[\w\-:.]+)/g) || [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (i === 0 && directives.includes(part)) {
      tokens.push({ type: "directive", text: part });
    } else if (i === 1 && !part.startsWith('"') && !part.startsWith("^") && !part.startsWith("#")) {
      // For actualize-synthesis, the second token is a link (^target)
      if (parts[0] === "actualize-synthesis" && part.startsWith("^")) {
        tokens.push({ type: "link", text: part });
      } else {
        tokens.push({ type: "entity", text: part });
      }
    } else if (part.startsWith('"')) {
      tokens.push({ type: "title", text: part });
    } else if (part.startsWith("^")) {
      tokens.push({ type: "link", text: part });
    } else if (part.startsWith("#")) {
      tokens.push({ type: "tag", text: part });
    } else {
      tokens.push({ type: "unknown", text: part });
    }
  }

  return tokens;
}

// ===================
// Main Handler
// ===================

/**
 * Handle textDocument/hover request
 *
 * Provides hover information for various syntax elements:
 * - ^link-id: Shows target entry details
 * - #tag: Shows tag usage statistics
 * - Directives: Shows documentation
 * - Entity names: Shows schema with fields and sections
 * - Metadata keys: Shows field type and description
 * - Type expressions: Shows type documentation
 * - Section headers: Shows section description
 * - Timestamps: Shows entry info or link reference hint
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
  const ctx = detectHoverContext(document, position);

  switch (ctx.kind) {
    // Link reference (^link-id)
    case "link": {
      const definition = workspace.getLinkDefinition(ctx.value);
      if (definition) {
        return {
          contents: {
            kind: "markdown",
            value: formatEntryHover(definition.entry),
          },
        };
      }
      return {
        contents: {
          kind: "markdown",
          value: `⚠️ **Unknown link:** \`^${ctx.value}\`\n\nNo entry found with this ID.`,
        },
      };
    }

    // Tag (#tag)
    case "tag": {
      const entries = workspace.allEntries().filter((e) => e.tags.includes(ctx.value));
      if (entries.length > 0) {
        return {
          contents: {
            kind: "markdown",
            value: formatTagHover(ctx.value, entries),
          },
        };
      }
      return null;
    }

    // Directive (create, update, define-entity, alter-entity)
    case "directive": {
      const doc = getDirectiveDocumentation(ctx.value);
      if (doc) {
        return {
          contents: {
            kind: "markdown",
            value: doc,
          },
        };
      }
      return null;
    }

    // Entity name (lore, opinion, reference, journal, or custom)
    case "entity": {
      const schema = workspace.schemaRegistry.get(ctx.value);
      if (schema) {
        return {
          contents: {
            kind: "markdown",
            value: formatEntitySchema(schema),
          },
        };
      }
      // Unknown entity
      return {
        contents: {
          kind: "markdown",
          value: `⚠️ **Unknown entity:** \`${ctx.value}\`\n\nNo schema found. Define with \`define-entity\`.`,
        },
      };
    }

    // Metadata key (field name)
    case "metadata_key": {
      if (ctx.entityContext) {
        const schema = workspace.schemaRegistry.get(ctx.entityContext);
        if (schema) {
          const field = schema.fields.get(ctx.value);
          if (field) {
            return {
              contents: {
                kind: "markdown",
                value: formatFieldHover(field, ctx.entityContext),
              },
            };
          }
        }
      }
      // Field not found in schema
      return {
        contents: {
          kind: "markdown",
          value: `**Field:** \`${ctx.value}\`\n\n*Not defined in entity schema*`,
        },
      };
    }

    // Timestamp
    case "timestamp": {
      const entry = workspace.findEntry(ctx.value);
      return {
        contents: {
          kind: "markdown",
          value: formatTimestampHover(ctx.value, entry),
        },
      };
    }

    // Type expression (string, date, date-range, link)
    case "type": {
      const doc = getPrimitiveTypeDocumentation(ctx.value);
      if (doc) {
        return {
          contents: {
            kind: "markdown",
            value: doc,
          },
        };
      }
      return null;
    }

    // Section header (# SectionName)
    case "section_header": {
      if (ctx.entityContext) {
        const schema = workspace.schemaRegistry.get(ctx.entityContext);
        if (schema) {
          const section = schema.sections.get(ctx.value);
          if (section) {
            return {
              contents: {
                kind: "markdown",
                value: formatSectionHover(section, ctx.entityContext),
              },
            };
          }
        }
      }
      // Section not found in schema
      return {
        contents: {
          kind: "markdown",
          value: `**Section:** \`# ${ctx.value}\`\n\n*Not defined in entity schema*`,
        },
      };
    }

    default:
      return null;
  }
}
