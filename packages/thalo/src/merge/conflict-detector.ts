import type { Entry, Content, FieldDefinition } from "../ast/types.js";
import type { EntryMatch, MergeConflict, ConflictRule, MergeOptions } from "./types.js";

/**
 * Detect conflicts in matched entries
 *
 * @param matches - Array of matched entry triplets
 * @param options - Merge options (for custom rules)
 * @returns Array of detected conflicts
 */
export function detectConflicts(
  matches: EntryMatch[],
  options: MergeOptions = {},
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];

  const rules: ConflictRule[] = [...DEFAULT_CONFLICT_RULES, ...(options.conflictRules || [])];

  for (const match of matches) {
    for (const rule of rules) {
      const conflict = rule.detect(match);
      if (conflict) {
        conflicts.push(conflict);
        break;
      }
    }
  }

  return conflicts;
}

/**
 * Default conflict detection rules
 *
 * Rules are applied in order, stopping at first match
 */
const DEFAULT_CONFLICT_RULES: ConflictRule[] = [
  {
    name: "duplicate-link-id",
    detect: (match) => {
      if (!match.base && match.ours && match.theirs && match.identity.linkId) {
        return {
          type: "duplicate-link-id",
          message: `Both sides created entry with link ID '^${match.identity.linkId}'`,
          location: 0,
          identity: match.identity,
          ours: match.ours,
          theirs: match.theirs,
          context: { linkId: match.identity.linkId },
        };
      }
      return null;
    },
  },

  {
    name: "concurrent-metadata-update",
    detect: (match) => {
      if (!match.base || !match.ours || !match.theirs) {
        return null;
      }

      if (
        match.ours.type !== "instance_entry" &&
        match.ours.type !== "synthesis_entry" &&
        match.ours.type !== "actualize_entry"
      ) {
        return null;
      }
      if (
        match.theirs.type !== "instance_entry" &&
        match.theirs.type !== "synthesis_entry" &&
        match.theirs.type !== "actualize_entry"
      ) {
        return null;
      }

      const baseMetadata = getMetadataMap(match.base);
      const oursMetadata = getMetadataMap(match.ours);
      const theirsMetadata = getMetadataMap(match.theirs);

      // Iterate over union of all keys to catch delete-vs-edit conflicts
      const allKeys = new Set([
        ...baseMetadata.keys(),
        ...oursMetadata.keys(),
        ...theirsMetadata.keys(),
      ]);

      for (const key of allKeys) {
        const baseValue = baseMetadata.get(key);
        const oursValue = oursMetadata.get(key);
        const theirsValue = theirsMetadata.get(key);

        // Conflict if both sides changed from base differently
        if (oursValue !== baseValue && theirsValue !== baseValue && oursValue !== theirsValue) {
          return {
            type: "concurrent-metadata-update",
            message: `Both sides modified metadata key '${key}'`,
            location: 0,
            identity: match.identity,
            base: match.base,
            ours: match.ours,
            theirs: match.theirs,
            context: { metadataKey: key },
          };
        }
      }

      return null;
    },
  },

  {
    name: "concurrent-content-edit",
    detect: (match) => {
      if (!match.base || !match.ours || !match.theirs) {
        return null;
      }

      const baseContent = getEntryContent(match.base);
      const oursContent = getEntryContent(match.ours);
      const theirsContent = getEntryContent(match.theirs);

      if (!baseContent) {
        return null;
      }

      const oursChanged = !contentEquals(baseContent, oursContent);
      const theirsChanged = !contentEquals(baseContent, theirsContent);
      const different = !contentEquals(oursContent, theirsContent);

      if (oursChanged && theirsChanged && different) {
        return {
          type: "concurrent-content-edit",
          message: "Both sides modified content",
          location: 0,
          identity: match.identity,
          base: match.base,
          ours: match.ours,
          theirs: match.theirs,
        };
      }

      return null;
    },
  },

  {
    name: "incompatible-schema-change",
    detect: (match) => {
      if (match.ours?.type !== "schema_entry" || match.theirs?.type !== "schema_entry") {
        return null;
      }

      if (!match.base) {
        if (!schemaEntriesEqual(match.ours, match.theirs)) {
          return {
            type: "incompatible-schema-change",
            message: "Both sides defined same entity with different schemas",
            location: 0,
            identity: match.identity,
            ours: match.ours,
            theirs: match.theirs,
          };
        }
        return null;
      }

      if (match.base.type !== "schema_entry") {
        return null;
      }

      // Check metadata fields
      const oursFields = getSchemaFields(match.ours);
      const theirsFields = getSchemaFields(match.theirs);
      const baseFields = getSchemaFields(match.base);

      for (const [fieldName, oursField] of oursFields) {
        const baseField = baseFields.get(fieldName);
        const theirsField = theirsFields.get(fieldName);

        if (oursField !== baseField && theirsField !== baseField && oursField !== theirsField) {
          return {
            type: "incompatible-schema-change",
            message: `Both sides modified schema field '${fieldName}' differently`,
            location: 0,
            identity: match.identity,
            base: match.base,
            ours: match.ours,
            theirs: match.theirs,
            context: { fieldName },
          };
        }
      }

      // Check section definitions
      const oursSections = getSchemaSections(match.ours);
      const theirsSections = getSchemaSections(match.theirs);
      const baseSections = getSchemaSections(match.base);

      const allSectionNames = new Set([
        ...baseSections.keys(),
        ...oursSections.keys(),
        ...theirsSections.keys(),
      ]);

      for (const sectionName of allSectionNames) {
        const baseSection = baseSections.get(sectionName);
        const oursSection = oursSections.get(sectionName);
        const theirsSection = theirsSections.get(sectionName);

        if (
          oursSection !== baseSection &&
          theirsSection !== baseSection &&
          oursSection !== theirsSection
        ) {
          return {
            type: "incompatible-schema-change",
            message: `Both sides modified section '${sectionName}' differently`,
            location: 0,
            identity: match.identity,
            base: match.base,
            ours: match.ours,
            theirs: match.theirs,
            context: { fieldName: sectionName },
          };
        }
      }

      // Check removed fields
      const oursRemovedFields = getRemovedFields(match.ours);
      const theirsRemovedFields = getRemovedFields(match.theirs);
      const baseRemovedFields = getRemovedFields(match.base);

      const allRemovedFieldNames = new Set([
        ...baseRemovedFields.keys(),
        ...oursRemovedFields.keys(),
        ...theirsRemovedFields.keys(),
      ]);

      for (const fieldName of allRemovedFieldNames) {
        const baseRemoved = baseRemovedFields.get(fieldName);
        const oursRemoved = oursRemovedFields.get(fieldName);
        const theirsRemoved = theirsRemovedFields.get(fieldName);

        if (
          oursRemoved !== baseRemoved &&
          theirsRemoved !== baseRemoved &&
          oursRemoved !== theirsRemoved
        ) {
          return {
            type: "incompatible-schema-change",
            message: `Both sides modified field removal '${fieldName}' differently`,
            location: 0,
            identity: match.identity,
            base: match.base,
            ours: match.ours,
            theirs: match.theirs,
            context: { fieldName },
          };
        }
      }

      // Check removed sections
      const oursRemovedSections = getRemovedSections(match.ours);
      const theirsRemovedSections = getRemovedSections(match.theirs);
      const baseRemovedSections = getRemovedSections(match.base);

      const allRemovedSectionNames = new Set([
        ...baseRemovedSections.keys(),
        ...oursRemovedSections.keys(),
        ...theirsRemovedSections.keys(),
      ]);

      for (const sectionName of allRemovedSectionNames) {
        const baseRemoved = baseRemovedSections.get(sectionName);
        const oursRemoved = oursRemovedSections.get(sectionName);
        const theirsRemoved = theirsRemovedSections.get(sectionName);

        if (
          oursRemoved !== baseRemoved &&
          theirsRemoved !== baseRemoved &&
          oursRemoved !== theirsRemoved
        ) {
          return {
            type: "incompatible-schema-change",
            message: `Both sides modified section removal '${sectionName}' differently`,
            location: 0,
            identity: match.identity,
            base: match.base,
            ours: match.ours,
            theirs: match.theirs,
            context: { fieldName: sectionName },
          };
        }
      }

      return null;
    },
  },

  {
    name: "concurrent-title-change",
    detect: (match) => {
      if (!match.base || !match.ours || !match.theirs) {
        return null;
      }

      const baseTitle = getEntryTitle(match.base);
      const oursTitle = getEntryTitle(match.ours);
      const theirsTitle = getEntryTitle(match.theirs);

      if (baseTitle !== oursTitle && baseTitle !== theirsTitle && oursTitle !== theirsTitle) {
        return {
          type: "concurrent-title-change",
          message: "Both sides changed entry title",
          location: 0,
          identity: match.identity,
          base: match.base,
          ours: match.ours,
          theirs: match.theirs,
        };
      }

      return null;
    },
  },
];

/**
 * Get metadata as a map from key to raw value
 */
function getMetadataMap(entry: Entry): Map<string, string> {
  const map = new Map<string, string>();

  if (
    entry.type === "instance_entry" ||
    entry.type === "synthesis_entry" ||
    entry.type === "actualize_entry"
  ) {
    for (const meta of entry.metadata) {
      map.set(meta.key.value, meta.value.raw);
    }
  }

  return map;
}

/**
 * Get content from an entry
 */
function getEntryContent(entry: Entry): Content | null {
  if (entry.type === "instance_entry" || entry.type === "synthesis_entry") {
    return entry.content;
  }
  return null;
}

/**
 * Check if two content nodes are equal
 */
function contentEquals(a: Content | null, b: Content | null): boolean {
  if (a === null && b === null) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }

  if (a.children.length !== b.children.length) {
    return false;
  }

  for (let i = 0; i < a.children.length; i++) {
    const childA = a.children[i];
    const childB = b.children[i];

    if (childA.type !== childB.type) {
      return false;
    }
    if (childA.text !== childB.text) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two schema entries are equal
 */
function schemaEntriesEqual(a: Entry, b: Entry): boolean {
  if (a.type !== "schema_entry" || b.type !== "schema_entry") {
    return false;
  }

  // Check metadata fields
  const aFields = getSchemaFields(a);
  const bFields = getSchemaFields(b);

  if (aFields.size !== bFields.size) {
    return false;
  }

  for (const [key, value] of aFields) {
    if (bFields.get(key) !== value) {
      return false;
    }
  }

  // Check sections
  const aSections = getSchemaSections(a);
  const bSections = getSchemaSections(b);

  if (aSections.size !== bSections.size) {
    return false;
  }

  for (const [key, value] of aSections) {
    if (bSections.get(key) !== value) {
      return false;
    }
  }

  // Check removed fields
  const aRemovedFields = getRemovedFields(a);
  const bRemovedFields = getRemovedFields(b);

  if (aRemovedFields.size !== bRemovedFields.size) {
    return false;
  }

  for (const [key, value] of aRemovedFields) {
    if (bRemovedFields.get(key) !== value) {
      return false;
    }
  }

  // Check removed sections
  const aRemovedSections = getRemovedSections(a);
  const bRemovedSections = getRemovedSections(b);

  if (aRemovedSections.size !== bRemovedSections.size) {
    return false;
  }

  for (const [key, value] of aRemovedSections) {
    if (bRemovedSections.get(key) !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Get schema fields as a map from field name to serialized definition
 */
function getSchemaFields(entry: Entry): Map<string, string> {
  const map = new Map<string, string>();

  if (entry.type !== "schema_entry") {
    return map;
  }

  if (entry.metadataBlock) {
    for (const field of entry.metadataBlock.fields) {
      map.set(`field:${field.name.value}`, serializeFieldDef(field));
    }
  }

  return map;
}

/**
 * Get schema sections as a map from section name to serialized definition
 */
function getSchemaSections(entry: Entry): Map<string, string> {
  const map = new Map<string, string>();

  if (entry.type !== "schema_entry") {
    return map;
  }

  if (entry.sectionsBlock) {
    for (const section of entry.sectionsBlock.sections) {
      map.set(
        section.name.value,
        JSON.stringify({
          optional: section.optional,
          description: section.description?.value ?? null,
        }),
      );
    }
  }

  return map;
}

/**
 * Get removed schema fields as a map
 */
function getRemovedFields(entry: Entry): Map<string, string> {
  const map = new Map<string, string>();

  if (entry.type !== "schema_entry") {
    return map;
  }

  if (entry.removeMetadataBlock) {
    for (const removal of entry.removeMetadataBlock.fields) {
      map.set(removal.name.value, removal.reason?.value ?? "");
    }
  }

  return map;
}

/**
 * Get removed schema sections as a map
 */
function getRemovedSections(entry: Entry): Map<string, string> {
  const map = new Map<string, string>();

  if (entry.type !== "schema_entry") {
    return map;
  }

  if (entry.removeSectionsBlock) {
    for (const removal of entry.removeSectionsBlock.sections) {
      map.set(removal.name.value, removal.reason?.value ?? "");
    }
  }

  return map;
}

/**
 * Serialize a field definition to a string for comparison
 */
function serializeFieldDef(field: FieldDefinition): string {
  return JSON.stringify({
    optional: field.optional,
    type: serializeTypeExpr(field.typeExpr),
    defaultValue: field.defaultValue ? field.defaultValue.raw : null,
    description: field.description ? field.description.value : null,
  });
}

/**
 * Serialize a type expression to a string
 */
function serializeTypeExpr(typeExpr: FieldDefinition["typeExpr"]): string {
  switch (typeExpr.type) {
    case "primitive_type":
      return typeExpr.name;
    case "literal_type":
      return `"${typeExpr.value}"`;
    case "array_type":
      return `${serializeTypeExpr(typeExpr.elementType)}[]`;
    case "union_type":
      return typeExpr.members.map((m) => serializeTypeExpr(m)).join(" | ");
    default:
      return "unknown";
  }
}

/**
 * Get entry title
 */
function getEntryTitle(entry: Entry): string {
  switch (entry.type) {
    case "instance_entry":
    case "schema_entry":
    case "synthesis_entry":
      return entry.header.title.value;
    case "actualize_entry":
      return "";
    default:
      return "";
  }
}
