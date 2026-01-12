"use client";

/**
 * PlaygroundPanel - Panel wrapper with header styling for the playground.
 *
 * Each panel has a header with icon, title, and filename, wrapping
 * a ThaloEditor instance.
 */

import { FileCode, BookOpen, Wand2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { ThaloEditor } from "./thalo-editor";
import { usePlayground, getPanelMeta, type PanelType } from "./playground-context";

const PANEL_ICONS: Record<PanelType, LucideIcon> = {
  entities: FileCode,
  entries: BookOpen,
  synthesis: Wand2,
};

export interface PlaygroundPanelProps {
  /** Which panel this represents */
  panel: PanelType;
  /** Optional additional class name */
  className?: string;
  /** Whether to show in compact mode (for tabs) */
  compact?: boolean;
}

export function PlaygroundPanel({ panel, className, compact = false }: PlaygroundPanelProps) {
  const { entities, entries, synthesis, setContent } = usePlayground();
  const meta = getPanelMeta(panel);
  const Icon = PANEL_ICONS[panel];

  // Get the content for this panel
  const content = panel === "entities" ? entities : panel === "entries" ? entries : synthesis;

  const handleChange = (value: string) => {
    setContent(panel, value);
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border-2 border-border/60 bg-card shadow-lg",
        "transition-shadow duration-200 hover:shadow-xl",
        className,
      )}
    >
      {/* Panel header */}
      <div className="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-lg bg-muted",
            meta.iconColor,
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">{meta.title}</span>
          <span className="font-mono text-xs text-muted-foreground">{meta.filename}</span>
        </div>
      </div>

      {/* Editor content */}
      <div className={cn("flex-1 overflow-hidden", compact ? "h-[300px]" : "h-[400px]")}>
        <ThaloEditor value={content} onChange={handleChange} className="h-full" />
      </div>
    </div>
  );
}

/**
 * Standalone panel header for use in tab layouts.
 */
export function PanelHeader({ panel }: { panel: PanelType }) {
  const meta = getPanelMeta(panel);
  const Icon = PANEL_ICONS[panel];

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("size-4", meta.iconColor)} />
      <span className="font-medium">{meta.title}</span>
    </div>
  );
}
