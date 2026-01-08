import type { Workspace } from "../model/workspace.js";
import type {
  ModelEntry,
  ModelInstanceEntry,
  ModelSchemaEntry,
  ModelSynthesisEntry,
  ModelActualizeEntry,
} from "../model/types.js";
import type { EntitySchema, FieldSchema, SectionSchema } from "../schema/types.js";
import { TypeExpr } from "../schema/types.js";
import type { Location } from "../ast/types.js";
import type { NodeContext } from "../ast/node-at-position.js";
import { toFileLocation } from "../source-map.js";

// ===================
// Types
// ===================

/**
 * Result of a hover lookup
 */
export interface HoverResult {
  /** Markdown content to display */
  content: string;
  /** Optional range to highlight (file-absolute) */
  range?: Location;
}

// ===================
// Entry Formatting
// ===================

/**
 * Format an entry for hover display
 */
export function formatEntryHover(entry: ModelEntry): string {
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
export function formatInstanceEntry(entry: ModelInstanceEntry): string {
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
export function formatSchemaEntry(entry: ModelSchemaEntry): string {
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
export function formatSynthesisEntry(entry: ModelSynthesisEntry): string {
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
export function formatActualizeEntry(entry: ModelActualizeEntry): string {
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
export function getDirectiveDocumentation(directive: string): string | null {
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
export function formatEntitySchema(schema: EntitySchema): string {
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
export function formatFieldHover(field: FieldSchema, entityName: string): string {
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
export function formatSectionHover(section: SectionSchema, entityName: string): string {
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
export function getPrimitiveTypeDocumentation(typeName: string): string | null {
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

    case "datetime":
      return [
        "### Type: `datetime`",
        "",
        "A date in ISO format (YYYY-MM-DD).",
        "",
        "**Format:** `YYYY-MM-DD`",
        "",
        "**Example:**",
        "```",
        "published: 2024-05-11",
        "```",
        "",
        "Note: For partial dates (YYYY or YYYY-MM), use `date-range` type.",
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
export function formatTagHover(tag: string, entries: ModelEntry[]): string {
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
export function formatTimestampHover(timestamp: string, entry: ModelEntry | undefined): string {
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
// Main Hover Service
// ===================

/**
 * Get hover information for a node context.
 *
 * This function takes a semantic node context (from findNodeAtPosition) and
 * returns hover information including markdown content and an optional range.
 *
 * @param workspace - The workspace to look up entries, schemas, etc.
 * @param context - The node context from findNodeAtPosition
 * @returns Hover result with markdown content, or null if no hover info
 */
export function getHoverInfo(workspace: Workspace, context: NodeContext): HoverResult | null {
  switch (context.kind) {
    // Link reference (^link-id)
    case "link": {
      const definition = workspace.getLinkDefinition(context.linkId);
      if (definition) {
        return {
          content: formatEntryHover(definition.entry),
          range: toFileLocation(context.sourceMap, context.node.location),
        };
      }
      return {
        content: `⚠️ **Unknown link:** \`^${context.linkId}\`\n\nNo entry found with this ID.`,
        range: toFileLocation(context.sourceMap, context.node.location),
      };
    }

    // Tag (#tag)
    case "tag": {
      const entries = workspace.allEntries().filter((e) => e.tags.includes(context.tagName));
      if (entries.length > 0) {
        return {
          content: formatTagHover(context.tagName, entries),
          range: toFileLocation(context.sourceMap, context.node.location),
        };
      }
      return null;
    }

    // Directive (create, update, define-entity, alter-entity)
    case "directive": {
      const doc = getDirectiveDocumentation(context.directive);
      if (doc) {
        return {
          content: doc,
          range: toFileLocation(context.sourceMap, context.location),
        };
      }
      return null;
    }

    // Entity name in instance entries
    case "entity": {
      const schema = workspace.schemaRegistry.get(context.entityName);
      if (schema) {
        return {
          content: formatEntitySchema(schema),
          range: toFileLocation(context.sourceMap, context.location),
        };
      }
      return {
        content: `⚠️ **Unknown entity:** \`${context.entityName}\`\n\nNo schema found. Define with \`define-entity\`.`,
        range: toFileLocation(context.sourceMap, context.location),
      };
    }

    // Entity name in schema entries
    case "schema_entity": {
      const schema = workspace.schemaRegistry.get(context.entityName);
      if (schema) {
        return {
          content: formatEntitySchema(schema),
          range: toFileLocation(context.sourceMap, context.node.location),
        };
      }
      return {
        content: `**Entity:** \`${context.entityName}\`\n\n*Being defined in this entry*`,
        range: toFileLocation(context.sourceMap, context.node.location),
      };
    }

    // Metadata key (field name)
    case "metadata_key": {
      if (context.entityContext) {
        const schema = workspace.schemaRegistry.get(context.entityContext);
        if (schema) {
          const field = schema.fields.get(context.key);
          if (field) {
            return {
              content: formatFieldHover(field, context.entityContext),
              range: toFileLocation(context.sourceMap, context.node.location),
            };
          }
        }
      }
      // Field not found in schema
      return {
        content: `**Field:** \`${context.key}\`\n\n*Not defined in entity schema*`,
        range: toFileLocation(context.sourceMap, context.node.location),
      };
    }

    // Timestamp
    case "timestamp": {
      const entry = workspace.findEntry(context.value);
      return {
        content: formatTimestampHover(context.value, entry),
        range: toFileLocation(context.sourceMap, context.node.location),
      };
    }

    // Type expression (string, date, date-range, link)
    case "type": {
      const doc = getPrimitiveTypeDocumentation(context.typeName);
      if (doc) {
        return {
          content: doc,
          range: toFileLocation(context.sourceMap, context.node.location),
        };
      }
      return null;
    }

    // Section header in content (# SectionName)
    case "section_header": {
      if (context.entityContext) {
        const schema = workspace.schemaRegistry.get(context.entityContext);
        if (schema) {
          const section = schema.sections.get(context.sectionName);
          if (section) {
            return {
              content: formatSectionHover(section, context.entityContext),
              range: toFileLocation(context.sourceMap, context.location),
            };
          }
        }
      }
      // Section not found in schema
      return {
        content: `**Section:** \`# ${context.sectionName}\`\n\n*Not defined in entity schema*`,
        range: toFileLocation(context.sourceMap, context.location),
      };
    }

    // Field name in schema definition
    case "field_name": {
      if (context.entityContext) {
        const schema = workspace.schemaRegistry.get(context.entityContext);
        if (schema) {
          const field = schema.fields.get(context.fieldName);
          if (field) {
            return {
              content: formatFieldHover(field, context.entityContext),
              range: toFileLocation(context.sourceMap, context.node.location),
            };
          }
        }
      }
      return {
        content: `**Field:** \`${context.fieldName}\`\n\n*Being defined in this schema*`,
        range: toFileLocation(context.sourceMap, context.node.location),
      };
    }

    // Section name in schema definition
    case "section_name": {
      if (context.entityContext) {
        const schema = workspace.schemaRegistry.get(context.entityContext);
        if (schema) {
          const section = schema.sections.get(context.sectionName);
          if (section) {
            return {
              content: formatSectionHover(section, context.entityContext),
              range: toFileLocation(context.sourceMap, context.node.location),
            };
          }
        }
      }
      return {
        content: `**Section:** \`# ${context.sectionName}\`\n\n*Being defined in this schema*`,
        range: toFileLocation(context.sourceMap, context.node.location),
      };
    }

    // Title
    case "title": {
      return {
        content: `**Title:** "${context.title}"`,
        range: toFileLocation(context.sourceMap, context.location),
      };
    }

    default:
      return null;
  }
}
