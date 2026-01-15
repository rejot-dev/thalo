import type { Rule, RuleCategory } from "../rules/rules.js";
import type { RuleVisitor, VisitorContext } from "../visitor.js";
import type { Entry } from "../../ast/ast-types.js";

const category: RuleCategory = "instance";

const visitor: RuleVisitor = {
  afterCheck(ctx: VisitorContext) {
    const { workspace } = ctx;

    // Check each file independently since timestamps are per-file
    for (const model of workspace.allModels()) {
      // Track entries by timestamp+type (the merge identity key)
      const entriesByIdentity = new Map<string, Entry[]>();

      for (const entry of model.ast.entries) {
        // Get timestamp
        const timestamp = getEntryTimestamp(entry);
        if (!timestamp) {
          continue;
        }

        // Check if entry has an explicit link ID
        const hasLinkId = hasExplicitLinkId(entry);
        if (hasLinkId) {
          // Entries with link IDs are always uniquely identified
          continue;
        }

        // Build identity key: timestamp|type (using | since timestamps contain :)
        const identityKey = `${timestamp}|${entry.type}`;

        const entries = entriesByIdentity.get(identityKey) ?? [];
        entries.push(entry);
        entriesByIdentity.set(identityKey, entries);
      }

      // Report duplicates
      for (const [identityKey, entries] of entriesByIdentity) {
        if (entries.length > 1) {
          const [timestamp, entryType] = identityKey.split("|");
          const entryTypeName = formatEntryType(entryType);

          for (const entry of entries) {
            ctx.report({
              message: `Duplicate timestamp '${timestamp}' for ${entryTypeName} without explicit ^link-id. Add a unique ^link-id to disambiguate entries with the same timestamp.`,
              file: model.file,
              location: getTimestampLocation(entry),
              sourceMap: model.sourceMap,
              data: { timestamp, entryType, duplicateCount: entries.length },
            });
          }
        }
      }
    }
  },
};

/**
 * Get timestamp string from an entry
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
 * Check if entry has an explicit link ID
 */
function hasExplicitLinkId(entry: Entry): boolean {
  switch (entry.type) {
    case "instance_entry":
    case "schema_entry":
      return entry.header.link !== null;
    case "synthesis_entry":
      // Synthesis entries always have a required linkId
      return true;
    case "actualize_entry":
      // Actualize entries use target, which is always present
      return true;
    default:
      return false;
  }
}

/**
 * Get the location of the timestamp in an entry (for error reporting)
 */
function getTimestampLocation(entry: Entry): import("../../ast/ast-types.js").Location {
  switch (entry.type) {
    case "instance_entry":
    case "schema_entry":
    case "synthesis_entry":
    case "actualize_entry":
      return entry.header.timestamp.location;
    default: {
      // This should never happen since all entry types have timestamps
      const _exhaustive: never = entry;
      return (_exhaustive as Entry).location;
    }
  }
}

/**
 * Format entry type for human-readable error messages
 */
function formatEntryType(entryType: string): string {
  switch (entryType) {
    case "instance_entry":
      return "instance entry";
    case "schema_entry":
      return "schema entry";
    case "synthesis_entry":
      return "synthesis entry";
    case "actualize_entry":
      return "actualize entry";
    default:
      return entryType;
  }
}

/**
 * Check for duplicate timestamps without link IDs
 *
 * When multiple entries in the same file have identical timestamps and the same
 * entry type, they must have explicit ^link-id values to be distinguished during
 * merge operations. Without link IDs, only the first entry will be used during
 * three-way merges, potentially causing data loss.
 */
export const duplicateTimestampRule: Rule = {
  code: "duplicate-timestamp",
  name: "Duplicate Timestamp Without Link ID",
  description:
    "Multiple entries with the same timestamp and type must have explicit ^link-id for merge disambiguation",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "document", links: false },
  visitor,
};
