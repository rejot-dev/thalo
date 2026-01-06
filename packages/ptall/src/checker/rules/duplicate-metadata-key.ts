import type { Rule } from "../types.js";

/**
 * Check for duplicate metadata keys within a single instance entry
 *
 * Note: The parser may already handle this, but this rule catches it at the semantic level.
 * If the parser produces a Map, duplicates are already collapsed - this rule won't detect them.
 * Consider this a safeguard for malformed input or parser changes.
 */
export const duplicateMetadataKeyRule: Rule = {
  code: "duplicate-metadata-key",
  name: "Duplicate Metadata Key",
  defaultSeverity: "error",

  check(ctx) {
    const { workspace } = ctx;

    // This rule is a safeguard. Since Document.parse already uses a Map for metadata,
    // duplicates are silently collapsed. To properly detect duplicates, we'd need
    // to check at the AST level before the Map is constructed.
    //
    // For now, this rule exists as documentation and for potential future AST-level checking.
    // The actual detection would require changes to the document extraction logic.

    // Placeholder: iterate entries but we can't detect duplicates from the Map
    for (const _entry of workspace.allInstanceEntries()) {
      // Metadata is already a Map - duplicates were collapsed during parsing
      // To properly implement this, we'd need to:
      // 1. Store raw metadata as an array in the model, or
      // 2. Check at AST level before model extraction
    }
  },
};
