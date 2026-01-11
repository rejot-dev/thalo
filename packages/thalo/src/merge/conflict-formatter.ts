import type { Entry } from "../ast/types.js";
import type { MergeConflict, MergeOptions } from "./types.js";

/**
 * Format a conflict with Git-style markers
 *
 * @param conflict - The conflict to format
 * @param options - Merge options (for marker style)
 * @returns Array of lines representing the conflict
 */
export function formatConflict(conflict: MergeConflict, options: MergeOptions = {}): string[] {
  const lines: string[] = [];
  const showBase = options.showBase || options.markerStyle === "diff3";

  lines.push("<<<<<<< ours");
  if (conflict.ours) {
    lines.push(...formatEntry(conflict.ours));
  }

  if (showBase && conflict.base) {
    lines.push("||||||| base");
    lines.push(...formatEntry(conflict.base));
  }

  lines.push("=======");
  if (conflict.theirs) {
    lines.push(...formatEntry(conflict.theirs));
  }
  lines.push(">>>>>>> theirs");

  return lines;
}

/**
 * Format an entry back to source text
 *
 * Reconstructs source from AST nodes
 *
 * @param entry - Entry to format
 * @returns Array of source lines
 */
export function formatEntry(entry: Entry): string[] {
  const lines: string[] = [];

  lines.push(formatHeader(entry));

  if (
    entry.type === "instance_entry" ||
    entry.type === "synthesis_entry" ||
    entry.type === "actualize_entry"
  ) {
    for (const meta of entry.metadata) {
      lines.push(`  ${meta.key.value}: ${meta.value.raw}`);
    }
  }

  if (entry.type === "instance_entry" || entry.type === "synthesis_entry") {
    if (entry.content) {
      lines.push("");
      for (const child of entry.content.children) {
        lines.push(`  ${child.text}`);
      }
    }
  }

  if (entry.type === "schema_entry") {
    if (entry.metadataBlock) {
      lines.push("  # Metadata");
      for (const field of entry.metadataBlock.fields) {
        lines.push(`  ${formatFieldDefinition(field)}`);
      }
    }

    if (entry.sectionsBlock) {
      lines.push("  # Sections");
      for (const section of entry.sectionsBlock.sections) {
        lines.push(`  ${formatSectionDefinition(section)}`);
      }
    }

    if (entry.removeMetadataBlock) {
      lines.push("  # Remove Metadata");
      for (const removal of entry.removeMetadataBlock.fields) {
        lines.push(`  ${removal.name.value}`);
      }
    }

    if (entry.removeSectionsBlock) {
      lines.push("  # Remove Sections");
      for (const removal of entry.removeSectionsBlock.sections) {
        lines.push(`  ${removal.name.value}`);
      }
    }
  }

  return lines;
}

/**
 * Format entry header
 */
function formatHeader(entry: Entry): string {
  switch (entry.type) {
    case "instance_entry": {
      const h = entry.header;
      const parts = [h.timestamp.value, h.directive, h.entity, `"${h.title.value}"`];
      if (h.link) {
        parts.push(`^${h.link.id}`);
      }
      for (const tag of h.tags) {
        parts.push(`#${tag.name}`);
      }
      return parts.join(" ");
    }

    case "schema_entry": {
      const h = entry.header;
      const parts = [h.timestamp.value, h.directive, h.entityName.value, `"${h.title.value}"`];
      if (h.link) {
        parts.push(`^${h.link.id}`);
      }
      for (const tag of h.tags) {
        parts.push(`#${tag.name}`);
      }
      return parts.join(" ");
    }

    case "synthesis_entry": {
      const h = entry.header;
      const parts = [
        h.timestamp.value,
        "define-synthesis",
        `"${h.title.value}"`,
        `^${h.linkId.id}`,
      ];
      for (const tag of h.tags) {
        parts.push(`#${tag.name}`);
      }
      return parts.join(" ");
    }

    case "actualize_entry": {
      const h = entry.header;
      return `${h.timestamp.value} actualize-synthesis ^${h.target.id}`;
    }

    default:
      return "";
  }
}

/**
 * Format a field definition
 */
function formatFieldDefinition(field: {
  name: { value: string };
  optional: boolean;
  typeExpr: {
    type: string;
    name?: string;
    value?: string;
    elementType?: unknown;
    members?: unknown[];
  };
  defaultValue?: { raw: string } | null;
  description?: { value: string } | null;
}): string {
  let result = field.name.value;
  if (field.optional) {
    result += "?";
  }
  result += `: ${formatTypeExpr(field.typeExpr)}`;
  if (field.defaultValue) {
    result += ` = ${field.defaultValue.raw}`;
  }
  if (field.description) {
    result += ` ; ${field.description.value}`;
  }
  return result;
}

/**
 * Format a section definition
 */
function formatSectionDefinition(section: {
  name: { value: string };
  optional: boolean;
  description?: { value: string } | null;
}): string {
  let result = section.name.value;
  if (section.optional) {
    result += "?";
  }
  if (section.description) {
    result += ` ; ${section.description.value}`;
  }
  return result;
}

/**
 * Format a type expression
 */
function formatTypeExpr(typeExpr: {
  type: string;
  name?: string;
  value?: string;
  elementType?: unknown;
  members?: unknown[];
}): string {
  switch (typeExpr.type) {
    case "primitive_type":
      return typeExpr.name ?? "unknown";

    case "literal_type":
      return `"${typeExpr.value}"`;

    case "array_type":
      return typeExpr.elementType
        ? `${formatTypeExpr(typeExpr.elementType as typeof typeExpr)}[]`
        : "unknown[]";

    case "union_type":
      return typeExpr.members
        ? (typeExpr.members as (typeof typeExpr)[]).map((m) => formatTypeExpr(m)).join(" | ")
        : "unknown";

    default:
      return "unknown";
  }
}
