/**
 * CodeMirror 6 extension for Thalo syntax highlighting.
 *
 * Uses decorations to apply semantic token highlighting from the Thalo parser.
 * This reuses the same semantic token extraction as the LSP and other highlighting.
 */

import {
  EditorView,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { StateField, StateEffect, type Extension } from "@codemirror/state";
import type { ThaloParser, Tree } from "@rejot-dev/thalo/web";
import {
  extractSemanticTokens,
  tokenTypes,
  type SemanticToken,
} from "@rejot-dev/thalo/services/semantic-tokens";
import type { ParsedDocument as NativeParsedDocument } from "@rejot-dev/thalo";

/**
 * Map semantic token types to CSS class names.
 * These classes should be defined in your CSS/Tailwind.
 */
const tokenTypeToClass: Record<string, string> = {
  namespace: "thalo-tok-timestamp",
  type: "thalo-tok-entity",
  class: "thalo-tok-class",
  function: "thalo-tok-link",
  property: "thalo-tok-property",
  string: "thalo-tok-string",
  keyword: "thalo-tok-keyword",
  comment: "thalo-tok-comment",
  variable: "thalo-tok-tag",
  number: "thalo-tok-number",
  operator: "thalo-tok-operator",
  macro: "thalo-tok-macro",
};

/**
 * Create decoration marks for each token class.
 */
const tokenDecorations: Record<string, Decoration> = {};
for (const [tokenType, className] of Object.entries(tokenTypeToClass)) {
  tokenDecorations[tokenType] = Decoration.mark({ class: className });
}

/**
 * Effect to set decorations from semantic tokens.
 */
const setDecorations = StateEffect.define<DecorationSet>();

/**
 * State field that holds the current decorations.
 */
const decorationsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDecorations)) {
        return effect.value;
      }
    }
    // Map decorations through document changes
    return decorations.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * Parse document and extract semantic tokens.
 */
function parseAndExtractTokens(parser: ThaloParser<Tree>, code: string): SemanticToken[] {
  const doc = parser.parseDocument(code, { fileType: "thalo" });
  // Safe cast: Web and native parsers produce structurally identical ParsedDocument objects
  return extractSemanticTokens(doc as unknown as NativeParsedDocument);
}

/**
 * Build decorations from semantic tokens using the document for position calculation.
 */
function buildDecorationsFromTokens(
  tokens: SemanticToken[],
  doc: { line: (n: number) => { from: number; to: number; text: string }; length: number },
): DecorationSet {
  const ranges: Array<{ from: number; to: number; value: Decoration }> = [];

  for (const token of tokens) {
    const tokenTypeName = tokenTypes[token.tokenType];
    const decoration = tokenDecorations[tokenTypeName];
    if (!decoration) {
      continue;
    }

    // Get line info (CodeMirror uses 1-based line numbers)
    const lineNum = token.line + 1;
    try {
      const line = doc.line(lineNum);
      const from = line.from + token.startChar;
      const to = Math.min(from + token.length, line.to);

      if (from >= 0 && to <= doc.length && from < to) {
        ranges.push({ from, to, value: decoration });
      }
    } catch {
      // Line doesn't exist, skip
    }
  }

  // Sort by from position (required by RangeSet)
  ranges.sort((a, b) => a.from - b.from);

  return Decoration.set(ranges.map((r) => r.value.range(r.from, r.to)));
}

/**
 * Create the Thalo highlighting ViewPlugin.
 *
 * @param getParser - Async function that returns the initialized parser
 */
function createThaloPlugin(getParser: () => Promise<ThaloParser<Tree>>) {
  let parserPromise: Promise<ThaloParser<Tree>> | null = null;
  let parser: ThaloParser<Tree> | null = null;
  let pendingUpdate = false;

  return ViewPlugin.fromClass(
    class {
      constructor(private view: EditorView) {
        this.scheduleHighlight();
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.scheduleHighlight();
        }
      }

      private scheduleHighlight() {
        if (pendingUpdate) {
          return;
        }
        pendingUpdate = true;

        // Debounce highlighting
        setTimeout(() => {
          pendingUpdate = false;
          this.highlight();
        }, 50);
      }

      private async highlight() {
        try {
          // Get or initialize parser
          if (!parser) {
            if (!parserPromise) {
              parserPromise = getParser();
            }
            parser = await parserPromise;
          }

          const code = this.view.state.doc.toString();
          const tokens = parseAndExtractTokens(parser, code);
          const decorations = buildDecorationsFromTokens(tokens, this.view.state.doc);

          this.view.dispatch({
            effects: setDecorations.of(decorations),
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[thalo-codemirror] Highlighting error:", err);
        }
      }
    },
  );
}

/**
 * CSS styles for Thalo syntax highlighting.
 * Uses the same color palette as thalo-highlighter.ts (One Dark theme).
 */
export const thaloHighlightStyles = EditorView.baseTheme({
  ".thalo-tok-timestamp": { color: "#e67e22" },
  ".thalo-tok-entity": { color: "#c678dd" },
  ".thalo-tok-class": { color: "#c678dd" },
  ".thalo-tok-link": { color: "#61afef" },
  ".thalo-tok-property": { color: "#e5c07b" },
  ".thalo-tok-string": { color: "#98c379" },
  ".thalo-tok-keyword": { color: "#c678dd" },
  ".thalo-tok-comment": { color: "#7f848e" },
  ".thalo-tok-tag": { color: "#56b6c2" },
  ".thalo-tok-number": { color: "#e67e22" },
  ".thalo-tok-operator": { color: "#abb2bf" },
  ".thalo-tok-macro": { color: "#c678dd" },
});

/**
 * Editor theme for the Thalo playground.
 * Dark theme with comfortable editing colors.
 */
export const thaloEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "#1e1e2e",
    color: "#cdd6f4",
    fontSize: "14px",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
  },
  ".cm-content": {
    caretColor: "#f5e0dc",
    padding: "12px 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#f5e0dc",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "#45475a",
  },
  ".cm-activeLine": {
    backgroundColor: "#313244",
  },
  ".cm-gutters": {
    backgroundColor: "#1e1e2e",
    color: "#6c7086",
    border: "none",
    paddingRight: "8px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#313244",
    color: "#cdd6f4",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 16px",
    minWidth: "40px",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-line": {
    padding: "0 16px",
  },
});

/**
 * Create the complete Thalo CodeMirror extension.
 *
 * @param getParser - Async function that returns the initialized Thalo parser
 * @returns CodeMirror extension array
 */
export function thaloExtension(getParser: () => Promise<ThaloParser<Tree>>): Extension {
  return [decorationsField, createThaloPlugin(getParser), thaloHighlightStyles, thaloEditorTheme];
}
