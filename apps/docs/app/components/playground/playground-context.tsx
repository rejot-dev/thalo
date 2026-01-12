"use client";

/**
 * PlaygroundContext - Shared state for the Thalo playground.
 *
 * Manages editor content for all three panels (entities, entries, synthesis)
 * and tracks the active tab for small screen layouts.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type PanelType = "entities" | "entries" | "synthesis";

export interface PlaygroundState {
  entities: string;
  entries: string;
  synthesis: string;
  activeTab: PanelType;
}

export interface PlaygroundContextValue extends PlaygroundState {
  setContent: (panel: PanelType, content: string) => void;
  setActiveTab: (tab: PanelType) => void;
  resetToDefaults: () => void;
}

const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

// Default content for each panel
const DEFAULT_ENTITIES = `2026-01-12T10:00Z define-entity opinion "Formed stances on topics"
  # Metadata
  confidence: "high" | "medium" | "low"
  related?: link[]

  # Sections
  Claim ; "Core opinion in 1-2 sentences"
  Reasoning ; "Bullet points supporting the claim"

2026-01-12T10:05Z define-entity reference "External sources and materials"
  # Metadata
  source: string
  date?: datetime

  # Sections
  Summary ; "Key takeaways"
  Notes? ; "Personal annotations"`;

const DEFAULT_ENTRIES = `2026-01-12T11:30Z create opinion "Premature abstraction is worse than duplication" ^opinion-premature-abstraction #programming
  confidence: "high"
  related: ^no-abstraction, ^pragmatic-programmer

  # Claim
  Abstracting too early creates rigid, hard-to-change code.

  # Reasoning
  - Early abstractions often encode the wrong assumptions
  - The Rule of Three exists for a reason
  - Duplication is easier to refactor than wrong abstractions

2026-01-12T14:45Z create opinion "Simple code beats clever code" ^simple-beats-clever #programming
  confidence: "high"

  # Claim
  The best code is boring code that anyone can understand.

  # Reasoning
  - Debugging clever code at 3 AM is painful
  - Junior developers should be able to modify it
  - Code is read 10x more than it's written`;

const DEFAULT_SYNTHESIS = `2026-01-12T15:00Z define-synthesis "Programming Philosophy" ^prog-philosophy #programming
  sources: opinion where #programming

  # Prompt
  Synthesize my programming opinions into a cohesive
  philosophy document. Focus on practical principles
  that guide day-to-day coding decisions.

  Include:
  - Core beliefs about code quality
  - When to abstract vs duplicate
  - How to balance simplicity with functionality`;

const DEFAULT_STATE: PlaygroundState = {
  entities: DEFAULT_ENTITIES,
  entries: DEFAULT_ENTRIES,
  synthesis: DEFAULT_SYNTHESIS,
  activeTab: "entities",
};

export interface PlaygroundProviderProps {
  children: ReactNode;
  initialState?: Partial<PlaygroundState>;
}

export function PlaygroundProvider({ children, initialState }: PlaygroundProviderProps) {
  const [state, setState] = useState<PlaygroundState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setContent = useCallback((panel: PanelType, content: string) => {
    setState((prev) => ({ ...prev, [panel]: content }));
  }, []);

  const setActiveTab = useCallback((tab: PanelType) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const value: PlaygroundContextValue = {
    ...state,
    setContent,
    setActiveTab,
    resetToDefaults,
  };

  return <PlaygroundContext.Provider value={value}>{children}</PlaygroundContext.Provider>;
}

export function usePlayground(): PlaygroundContextValue {
  const context = useContext(PlaygroundContext);
  if (!context) {
    throw new Error("usePlayground must be used within a PlaygroundProvider");
  }
  return context;
}

/**
 * Hook to get panel metadata (title, icon color, filename).
 */
export function getPanelMeta(panel: PanelType) {
  switch (panel) {
    case "entities":
      return {
        title: "Entities",
        filename: "entities.thalo",
        iconColor: "text-amber-500",
        description: "Define the structure of your knowledge",
      };
    case "entries":
      return {
        title: "Entries",
        filename: "entries.thalo",
        iconColor: "text-blue-500",
        description: "Create typed entries with metadata",
      };
    case "synthesis":
      return {
        title: "Synthesis",
        filename: "syntheses.thalo",
        iconColor: "text-violet-500",
        description: "Query and synthesize your knowledge",
      };
  }
}
