"use client";

/**
 * PlaygroundTabs - Tabbed panel for the playground.
 *
 * Can show all three panels or a subset (e.g., entities+entries only).
 */

import { useState, useEffect } from "react";
import { FileCode, BookOpen, Wand2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePlayground, getPanelMeta, type PanelType } from "./playground-context";
import { ThaloEditor } from "./thalo-editor";

const PANEL_ICONS: Record<PanelType, LucideIcon> = {
  entities: FileCode,
  entries: BookOpen,
  synthesis: Wand2,
};

export interface PlaygroundTabsProps {
  /** Which panels to show as tabs */
  panels?: PanelType[];
  /** Optional additional class name */
  className?: string;
}

export function PlaygroundTabs({
  panels = ["entities", "entries", "synthesis"],
  className,
}: PlaygroundTabsProps) {
  const { entities, entries, synthesis, activeTab, setActiveTab, setContent } = usePlayground();

  // If activeTab is not in the panels list, default to first panel
  const effectiveTab = panels.includes(activeTab) ? activeTab : panels[0];

  // Track local active tab for this tab group
  const [localTab, setLocalTab] = useState<PanelType>(effectiveTab);

  // Sync with global state when this panel group contains the active tab
  useEffect(() => {
    if (panels.includes(activeTab)) {
      setLocalTab(activeTab);
    }
  }, [activeTab, panels]);

  const handleTabChange = (panel: PanelType) => {
    setLocalTab(panel);
    setActiveTab(panel);
  };

  // Get content for a panel
  const getContent = (panel: PanelType) => {
    switch (panel) {
      case "entities":
        return entities;
      case "entries":
        return entries;
      case "synthesis":
        return synthesis;
    }
  };

  const handleChange = (value: string) => {
    setContent(localTab, value);
  };

  const activeMeta = getPanelMeta(localTab);
  const ActiveIcon = PANEL_ICONS[localTab];

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border-2 border-border/60 bg-card shadow-lg",
        className,
      )}
    >
      {/* Tab bar */}
      <div className="flex border-b border-border/50 bg-muted/30">
        {panels.map((panel) => {
          const meta = getPanelMeta(panel);
          const Icon = PANEL_ICONS[panel];
          const isActive = panel === localTab;

          return (
            <button
              key={panel}
              onClick={() => handleTabChange(panel)}
              className={cn(
                "group flex flex-1 flex-col items-center gap-1 px-3 py-3 transition-all",
                "border-b-2 -mb-[2px]",
                isActive ? "border-primary bg-background" : "border-transparent hover:bg-muted/50",
              )}
              aria-selected={isActive}
              role="tab"
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md transition-colors",
                    isActive ? "bg-primary/10" : "bg-muted group-hover:bg-muted/80",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 transition-colors",
                      isActive
                        ? meta.iconColor
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {meta.title}
                </span>
              </div>
              <span
                className={cn(
                  "font-mono text-[10px] transition-colors",
                  isActive ? "text-muted-foreground" : "text-muted-foreground/60",
                )}
              >
                {meta.filename}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active panel header */}
      <div className="flex items-center gap-3 border-b border-border/30 bg-muted/20 px-4 py-2">
        <ActiveIcon className={cn("size-4", activeMeta.iconColor)} />
        <span className="text-sm font-medium text-foreground">{activeMeta.title}</span>
        <span className="text-xs text-muted-foreground">—</span>
        <span className="text-xs text-muted-foreground">{activeMeta.description}</span>
      </div>

      {/* Editor content */}
      <div className="h-[400px] flex-1 overflow-hidden">
        <ThaloEditor
          key={localTab}
          value={getContent(localTab)}
          onChange={handleChange}
          className="h-full"
        />
      </div>
    </div>
  );
}

/**
 * Hook to detect number of panels to show based on viewport.
 * Returns 1, 2, or 3.
 */
export function useResponsivePanelCount(): number {
  // This is a simplified version - in real usage, you'd use
  // window.matchMedia or a resize observer
  if (typeof window === "undefined") {
    return 3;
  }

  // Tailwind breakpoints: sm=640, md=768, lg=1024
  const width = window.innerWidth;
  if (width < 768) {
    return 1;
  }
  if (width < 1024) {
    return 2;
  }
  return 3;
}
