"use client";

/**
 * ThaloEditor - CodeMirror 6 editor with Thalo syntax highlighting.
 *
 * This component provides a fully-featured code editor for .thalo files
 * with semantic token-based syntax highlighting.
 */

import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { thaloExtension } from "./thalo-codemirror-extension";
import { getParser } from "@/lib/thalo-parser.client";

export interface ThaloEditorProps {
  /** Initial content for the editor */
  value: string;
  /** Callback when content changes */
  onChange?: (value: string) => void;
  /** Optional CSS class for the container */
  className?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
}

export function ThaloEditor({
  value,
  onChange,
  className = "",
  readOnly = false,
}: ThaloEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref updated
  onChangeRef.current = onChange;

  // Create update listener
  const updateListener = useCallback(() => {
    return EditorView.updateListener.of((update) => {
      if (update.docChanged && onChangeRef.current) {
        onChangeRef.current(update.state.doc.toString());
      }
    });
  }, []);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      thaloExtension(getParser),
      updateListener(),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update content when value prop changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`thalo-editor flex flex-col overflow-hidden rounded-b-xl [&_.cm-editor]:flex-1 [&_.cm-editor]:flex [&_.cm-editor]:flex-col [&_.cm-scroller]:flex-1 ${className}`}
      data-thalo-editor
    />
  );
}
