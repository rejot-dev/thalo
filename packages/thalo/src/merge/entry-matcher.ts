import type { Entry } from "../ast/types.js";
import type { EntryMatch, EntryIdentity } from "./types.js";

/**
 * Match entries across three versions based on identity
 *
 * Algorithm:
 * 1. Build identity map for each version (link ID or timestamp)
 * 2. Compute union of all identities
 * 3. For each identity, find corresponding entry in each version
 * 4. Return matched triplets
 *
 * @param base - Entries from base version (common ancestor)
 * @param ours - Entries from ours version (local/current)
 * @param theirs - Entries from theirs version (incoming)
 * @returns Array of matched entry triplets
 */
export function matchEntries(base: Entry[], ours: Entry[], theirs: Entry[]): EntryMatch[] {
  const baseMap = buildIdentityMap(base, "base");
  const oursMap = buildIdentityMap(ours, "ours");
  const theirsMap = buildIdentityMap(theirs, "theirs");

  const allIdentities = new Set<string>();
  for (const id of baseMap.keys()) {
    allIdentities.add(id);
  }
  for (const id of oursMap.keys()) {
    allIdentities.add(id);
  }
  for (const id of theirsMap.keys()) {
    allIdentities.add(id);
  }

  const matches: EntryMatch[] = [];
  for (const idKey of allIdentities) {
    const identity = parseIdentityKey(idKey);
    matches.push({
      identity,
      base: baseMap.get(idKey) || null,
      ours: oursMap.get(idKey) || null,
      theirs: theirsMap.get(idKey) || null,
    });
  }

  return matches;
}

/**
 * Build a map from identity key to entry
 *
 * Precondition: Each version must not contain duplicate identities.
 * Callers should validate inputs via the checker module's duplicate-link-id
 * and duplicate-timestamp rules before invoking the merge driver.
 *
 * @param entries - Array of entries to map
 * @param versionName - Name of version for error messages (e.g., "base", "ours", "theirs")
 * @returns Map from serialized identity to entry
 * @throws Error if duplicate identity is found within the version
 */
function buildIdentityMap(entries: Entry[], versionName: string): Map<string, Entry> {
  const map = new Map<string, Entry>();

  for (const entry of entries) {
    const identity = getEntryIdentity(entry);
    const key = serializeIdentity(identity);

    if (map.has(key)) {
      throw new Error(
        `Duplicate identity '${key}' found in ${versionName} version. ` +
          `Ensure inputs are validated via checker rules before merging.`,
      );
    }

    map.set(key, entry);
  }

  return map;
}

/**
 * Extract identity from an entry
 *
 * Priority:
 * 1. Explicit link ID (^link-id) from header
 * 2. Timestamp for entries without link IDs
 *
 * @param entry - Entry to extract identity from
 * @returns Entry identity
 */
export function getEntryIdentity(entry: Entry): EntryIdentity {
  if (entry.type === "instance_entry" && entry.header.link) {
    return {
      linkId: entry.header.link.id,
      entryType: entry.type,
    };
  }

  if (entry.type === "schema_entry" && entry.header.link) {
    return {
      linkId: entry.header.link.id,
      entryType: entry.type,
    };
  }

  if (entry.type === "synthesis_entry") {
    return {
      linkId: entry.header.linkId.id,
      entryType: entry.type,
    };
  }

  if (entry.type === "actualize_entry") {
    return {
      linkId: entry.header.target.id,
      entryType: entry.type,
    };
  }

  const timestamp = getEntryTimestamp(entry);
  return {
    timestamp: timestamp || undefined,
    entryType: entry.type,
  };
}

/**
 * Get timestamp string from an entry
 *
 * @param entry - Entry to extract timestamp from
 * @returns Timestamp string or null
 */
function getEntryTimestamp(entry: Entry): string | null {
  switch (entry.type) {
    case "instance_entry":
    case "schema_entry":
    case "synthesis_entry":
    case "actualize_entry":
      return entry.header.timestamp.value;
    default:
      return null;
  }
}

/**
 * Serialize identity to a unique key string
 *
 * @param identity - Identity to serialize
 * @returns Unique key string
 */
export function serializeIdentity(identity: EntryIdentity): string {
  if (identity.linkId) {
    return `link:${identity.linkId}`;
  }

  if (identity.timestamp) {
    return `ts:${identity.timestamp}:${identity.entryType}`;
  }

  // Fallback for synthetic identities (e.g., error conflicts)
  return `type:${identity.entryType}`;
}

/**
 * Parse identity key back to EntryIdentity
 *
 * @param key - Serialized identity key
 * @returns Parsed identity
 */
function parseIdentityKey(key: string): EntryIdentity {
  if (key.startsWith("link:")) {
    const linkId = key.slice(5);
    return {
      linkId,
      entryType: "unknown",
    };
  }

  if (key.startsWith("ts:")) {
    const withoutPrefix = key.slice(3);
    const lastColonIndex = withoutPrefix.lastIndexOf(":");
    if (lastColonIndex === -1) {
      throw new Error(`Invalid timestamp identity key: ${key}`);
    }
    const timestamp = withoutPrefix.slice(0, lastColonIndex);
    const entryType = withoutPrefix.slice(lastColonIndex + 1);
    return {
      timestamp,
      entryType,
    };
  }

  if (key.startsWith("type:")) {
    const entryType = key.slice(5);
    return {
      entryType,
    };
  }

  throw new Error(`Invalid identity key: ${key}`);
}
