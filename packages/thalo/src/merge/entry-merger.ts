import type { Entry, Metadata, Content } from "../ast/ast-types.js";
import type { EntryMatch } from "./entry-matcher.js";

/**
 * Merge a single entry match (assumes no conflicts)
 *
 * Handles various merge scenarios:
 * - Additions (one side only)
 * - Deletions (missing on one side)
 * - Single-side modifications
 * - Both-side modifications with fine-grained merge
 *
 * @param match - The entry match to merge
 * @returns Merged entry, or null if deleted
 */
export function mergeEntry(match: EntryMatch): Entry | null {
  const { base, ours, theirs } = match;

  if (!base && ours && !theirs) {
    return ours;
  }
  if (!base && !ours && theirs) {
    return theirs;
  }

  if (base && !ours && theirs) {
    return null;
  }
  if (base && ours && !theirs) {
    return null;
  }

  if (base && ours && theirs) {
    const oursChanged = !entriesEqual(base, ours);
    const theirsChanged = !entriesEqual(base, theirs);

    if (oursChanged && !theirsChanged) {
      return ours;
    }
    if (!oursChanged && theirsChanged) {
      return theirs;
    }

    if (oursChanged && theirsChanged) {
      return mergeEntryChanges(base, ours, theirs);
    }

    return base;
  }

  return ours || theirs || base;
}

/**
 * Fine-grained merge of entry changes
 *
 * For instance/synthesis entries, merge metadata and content independently
 */
function mergeEntryChanges(base: Entry, ours: Entry, theirs: Entry): Entry {
  if (ours.type === "instance_entry" && theirs.type === "instance_entry") {
    const baseMetadata =
      base.type === "instance_entry" ||
      base.type === "synthesis_entry" ||
      base.type === "actualize_entry"
        ? base.metadata
        : [];
    const baseContent =
      base.type === "instance_entry" || base.type === "synthesis_entry" ? base.content : null;

    return {
      ...ours,
      metadata: mergeMetadata(baseMetadata, ours.metadata, theirs.metadata),
      content: mergeContent(baseContent, ours.content, theirs.content),
    };
  }

  if (ours.type === "synthesis_entry" && theirs.type === "synthesis_entry") {
    const baseMetadata =
      base.type === "instance_entry" ||
      base.type === "synthesis_entry" ||
      base.type === "actualize_entry"
        ? base.metadata
        : [];
    const baseContent =
      base.type === "instance_entry" || base.type === "synthesis_entry" ? base.content : null;

    return {
      ...ours,
      metadata: mergeMetadata(baseMetadata, ours.metadata, theirs.metadata),
      content: mergeContent(baseContent, ours.content, theirs.content),
    };
  }

  if (ours.type === "actualize_entry" && theirs.type === "actualize_entry") {
    const baseMetadata =
      base.type === "instance_entry" ||
      base.type === "synthesis_entry" ||
      base.type === "actualize_entry"
        ? base.metadata
        : [];

    return {
      ...ours,
      metadata: mergeMetadata(baseMetadata, ours.metadata, theirs.metadata),
    };
  }

  return ours;
}

/**
 * Merge metadata lists (non-conflicting keys)
 *
 * Strategy: Take the changed version for each key
 */
function mergeMetadata(base: Metadata[], ours: Metadata[], theirs: Metadata[]): Metadata[] {
  const baseMap = new Map(base.map((m) => [m.key.value, m]));
  const oursMap = new Map(ours.map((m) => [m.key.value, m]));
  const theirsMap = new Map(theirs.map((m) => [m.key.value, m]));

  const allKeys = new Set([...baseMap.keys(), ...oursMap.keys(), ...theirsMap.keys()]);
  const merged: Metadata[] = [];

  for (const key of allKeys) {
    const baseVal = baseMap.get(key);
    const oursVal = oursMap.get(key);
    const theirsVal = theirsMap.get(key);

    // If key was deleted on both sides, don't resurrect it
    if (!oursVal && !theirsVal) {
      continue;
    }

    // If ours changed/added the key, use ours
    if (oursVal && (!baseVal || !metadataEquals(baseVal, oursVal))) {
      merged.push(oursVal);
    }
    // If theirs changed/added the key, and ours didn't change it, use theirs
    else if (theirsVal && (!baseVal || !metadataEquals(baseVal, theirsVal))) {
      merged.push(theirsVal);
    }
    // If both sides have the key and neither changed it, use either one
    else if (oursVal && theirsVal) {
      merged.push(oursVal);
    }
  }

  return merged;
}

/**
 * Merge content (best effort)
 *
 * If both sides modified content, take ours for now
 * More sophisticated merging could be added later
 */
function mergeContent(
  base: Content | null,
  ours: Content | null,
  theirs: Content | null,
): Content | null {
  if (base === null && ours === null && theirs === null) {
    return null;
  }

  // If both sides deleted content, don't resurrect base
  if (ours === null && theirs === null) {
    return null;
  }

  if (ours && theirs) {
    const oursChanged = !contentEquals(base, ours);
    const theirsChanged = !contentEquals(base, theirs);

    if (oursChanged && !theirsChanged) {
      return ours;
    }
    if (!oursChanged && theirsChanged) {
      return theirs;
    }

    return ours;
  }

  return ours || theirs || base;
}

/**
 * Check if two entries are deeply equal
 */
export function entriesEqual(a: Entry, b: Entry): boolean {
  if (a.type !== b.type) {
    return false;
  }

  switch (a.type) {
    case "instance_entry":
      if (b.type !== "instance_entry") {
        return false;
      }
      return (
        headersEqual(a.header, b.header) &&
        metadataListsEqual(a.metadata, b.metadata) &&
        contentEquals(a.content, b.content)
      );

    case "schema_entry":
      if (b.type !== "schema_entry") {
        return false;
      }
      return headersEqual(a.header, b.header) && schemaBlocksEqual(a, b);

    case "synthesis_entry":
      if (b.type !== "synthesis_entry") {
        return false;
      }
      return (
        headersEqual(a.header, b.header) &&
        metadataListsEqual(a.metadata, b.metadata) &&
        contentEquals(a.content, b.content)
      );

    case "actualize_entry":
      if (b.type !== "actualize_entry") {
        return false;
      }
      return headersEqual(a.header, b.header) && metadataListsEqual(a.metadata, b.metadata);

    default:
      return false;
  }
}

/**
 * Strip non-semantic fields (syntaxNode, location) for comparison.
 * This avoids circular reference issues with tree-sitter nodes.
 */
function stripForComparison(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripForComparison);
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip non-semantic fields that may have circular refs
      if (key === "syntaxNode" || key === "location") {
        continue;
      }
      result[key] = stripForComparison(value);
    }
    return result;
  }
  return obj;
}

/**
 * Check if two headers are equal (comparing semantic fields only)
 */
function headersEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(stripForComparison(a)) === JSON.stringify(stripForComparison(b));
}

/**
 * Check if two metadata lists are equal
 */
function metadataListsEqual(a: Metadata[], b: Metadata[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const aMap = new Map(a.map((m) => [m.key.value, m.value.raw]));
  const bMap = new Map(b.map((m) => [m.key.value, m.value.raw]));

  if (aMap.size !== bMap.size) {
    return false;
  }

  for (const [key, value] of aMap) {
    if (bMap.get(key) !== value) {
      return false;
    }
  }

  return true;
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
 * Check if schema blocks are equal (comparing semantic fields only)
 */
function schemaBlocksEqual(a: unknown, b: unknown): boolean {
  const aObj = a as {
    metadataBlock?: unknown;
    sectionsBlock?: unknown;
    removeMetadataBlock?: unknown;
    removeSectionsBlock?: unknown;
  };
  const bObj = b as {
    metadataBlock?: unknown;
    sectionsBlock?: unknown;
    removeMetadataBlock?: unknown;
    removeSectionsBlock?: unknown;
  };

  return (
    JSON.stringify(stripForComparison(aObj.metadataBlock)) ===
      JSON.stringify(stripForComparison(bObj.metadataBlock)) &&
    JSON.stringify(stripForComparison(aObj.sectionsBlock)) ===
      JSON.stringify(stripForComparison(bObj.sectionsBlock)) &&
    JSON.stringify(stripForComparison(aObj.removeMetadataBlock)) ===
      JSON.stringify(stripForComparison(bObj.removeMetadataBlock)) &&
    JSON.stringify(stripForComparison(aObj.removeSectionsBlock)) ===
      JSON.stringify(stripForComparison(bObj.removeSectionsBlock))
  );
}

/**
 * Check if two metadata items are equal
 */
function metadataEquals(a: Metadata, b: Metadata): boolean {
  return a.key.value === b.key.value && a.value.raw === b.value.raw;
}
