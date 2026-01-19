import { parseDocument } from "../parser.node.js";
import { extractSourceFile } from "../ast/extract.js";
import type { MergeResult } from "./merge-result-builder.js";
import type { MergeConflict, ConflictRule } from "./conflict-detector.js";
import { matchEntries } from "./entry-matcher.js";
import { detectConflicts } from "./conflict-detector.js";
import { buildMergedResult } from "./merge-result-builder.js";

/**
 * Options for the merge driver
 */
export interface MergeOptions {
  /**
   * Conflict marker style
   * - "git": Standard Git style (ours/theirs)
   * - "diff3": Include base section
   */
  markerStyle?: "git" | "diff3";

  /**
   * Whether to include base in markers (diff3 style)
   * Deprecated: Use markerStyle: "diff3" instead
   */
  showBase?: boolean;

  /**
   * Custom conflict detection rules
   * Applied after default rules
   */
  conflictRules?: ConflictRule[];
}

/**
 * Perform three-way merge of thalo files
 *
 * This is the main entry point for the merge driver.
 * It parses all three versions, matches entries, detects conflicts,
 * and produces a merged result.
 *
 * This function is synchronous but requires the parser to be initialized first.
 * Call `await initParser()` from `@rejot-dev/thalo/node` before using this function.
 * Internally uses `parseDocument` which depends on the initialized parser.
 *
 * @param base - Base version content (common ancestor)
 * @param ours - Our version content (local changes)
 * @param theirs - Their version content (incoming changes)
 * @param options - Merge options
 * @returns MergeResult with merged content and conflict information
 * @throws Error if the parser has not been initialized
 *
 * @example
 * ```typescript
 * import { initParser } from "@rejot-dev/thalo/node";
 * import { mergeThaloFiles } from "@rejot-dev/thalo";
 *
 * // Initialize the parser first (required)
 * await initParser();
 *
 * const base = '2026-01-01T00:00Z define-entity lore "Lore"';
 * const ours = base + '\n2026-01-02T00:00Z create lore "My entry" ^entry1';
 * const theirs = base + '\n2026-01-03T00:00Z create lore "Their entry" ^entry2';
 *
 * const result = mergeThaloFiles(base, ours, theirs);
 * console.log(result.success); // true
 * console.log(result.content); // Merged content with both entries
 * ```
 */
export function mergeThaloFiles(
  base: string,
  ours: string,
  theirs: string,
  options: MergeOptions = {},
): MergeResult {
  try {
    const baseDoc = parseDocument(base, { fileType: "thalo" });
    const oursDoc = parseDocument(ours, { fileType: "thalo" });
    const theirsDoc = parseDocument(theirs, { fileType: "thalo" });

    const baseAst =
      baseDoc.blocks.length > 0
        ? extractSourceFile(baseDoc.blocks[0].tree.rootNode)
        : { entries: [], syntaxErrors: [] };
    const oursAst =
      oursDoc.blocks.length > 0
        ? extractSourceFile(oursDoc.blocks[0].tree.rootNode)
        : { entries: [], syntaxErrors: [] };
    const theirsAst =
      theirsDoc.blocks.length > 0
        ? extractSourceFile(theirsDoc.blocks[0].tree.rootNode)
        : { entries: [], syntaxErrors: [] };

    // Surface syntax errors as parse-error conflicts
    const syntaxErrorConflicts: MergeConflict[] = [];
    if (baseAst.syntaxErrors.length > 0) {
      syntaxErrorConflicts.push({
        type: "parse-error",
        message: `Parse error in base: ${baseAst.syntaxErrors.map((e) => e.message || "syntax error").join(", ")}`,
        location: 0,
        identity: { entryType: "parse-error" },
        context: { errorMessage: "base version has syntax errors" },
      });
    }
    if (oursAst.syntaxErrors.length > 0) {
      syntaxErrorConflicts.push({
        type: "parse-error",
        message: `Parse error in ours: ${oursAst.syntaxErrors.map((e) => e.message || "syntax error").join(", ")}`,
        location: 0,
        identity: { entryType: "parse-error" },
        context: { errorMessage: "ours version has syntax errors" },
      });
    }
    if (theirsAst.syntaxErrors.length > 0) {
      syntaxErrorConflicts.push({
        type: "parse-error",
        message: `Parse error in theirs: ${theirsAst.syntaxErrors.map((e) => e.message || "syntax error").join(", ")}`,
        location: 0,
        identity: { entryType: "parse-error" },
        context: { errorMessage: "theirs version has syntax errors" },
      });
    }

    if (syntaxErrorConflicts.length > 0) {
      return {
        success: false,
        content: ours,
        conflicts: syntaxErrorConflicts,
        stats: {
          totalEntries: 0,
          oursOnly: 0,
          theirsOnly: 0,
          common: 0,
          autoMerged: 0,
          conflicts: syntaxErrorConflicts.length,
        },
      };
    }

    const matches = matchEntries(baseAst.entries, oursAst.entries, theirsAst.entries);

    const conflicts = detectConflicts(matches, options);

    const result = buildMergedResult(matches, conflicts, options);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      content: ours,
      conflicts: [
        {
          type: "merge-error",
          message: `Merge failed: ${errorMessage}`,
          location: 0,
          identity: { entryType: "error" },
          context: { errorMessage },
        },
      ],
      stats: {
        totalEntries: 0,
        oursOnly: 0,
        theirsOnly: 0,
        common: 0,
        autoMerged: 0,
        conflicts: 1,
      },
    };
  }
}
