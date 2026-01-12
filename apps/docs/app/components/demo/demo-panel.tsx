"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDemo } from "./demo-context";

export interface DemoPanelProps {
  /** Panel index for visibility tracking */
  index: number;
  /** Panel title */
  title: string;
  /** Icon component */
  icon: LucideIcon;
  /** Filename shown in terminal header */
  filename: string;
  /** Code/content to display */
  children: React.ReactNode;
  /** Optional badge (e.g., "new", "updated") */
  badge?: string;
  /** Color accent class for the icon */
  iconColor?: string;
  /** Whether this is a terminal/CLI output style */
  isTerminal?: boolean;
  /** Use fixed height for consistent scrollbar position */
  fixedHeight?: boolean;
}

export function DemoPanel({
  index,
  title,
  icon: Icon,
  filename,
  children,
  badge,
  iconColor = "text-amber-600 dark:text-amber-400",
  isTerminal = false,
  fixedHeight = false,
}: DemoPanelProps) {
  const { isPanelVisible, isPanelActive, getPanelPosition, step } = useDemo();

  const isVisible = isPanelVisible(index);
  const isActive = isPanelActive(index);
  const position = getPanelPosition(index);

  // Check for overrides at current step
  const override = step.panelOverrides?.[index];
  const displayBadge = override?.badge ?? badge;

  // Calculate transform based on visibility
  const getTransform = () => {
    if (!isVisible) {
      // Panel is off-screen
      if (position === -1) {
        // Determine if it should be left or right based on focused panels
        // Guard against empty focusedPanels array
        if (step.focusedPanels.length > 0) {
          const firstFocused = step.focusedPanels[0];
          return index < firstFocused
            ? "translateX(-120%) scale(0.9)"
            : "translateX(120%) scale(0.9)";
        }
        // Fall back to default off-screen transform when no focused panels exist
        return "translateX(-120%) scale(0.9)";
      }
    }
    return "translateX(0) scale(1)";
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border-2 shadow-lg transition-all duration-500 ease-out overflow-hidden",
        "min-w-0 shrink-0",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none absolute",
        isActive
          ? "border-primary/40 shadow-xl shadow-primary/10 ring-2 ring-primary/20"
          : "border-border/60",
        !isVisible && "scale-90",
        fixedHeight && "h-[400px] sm:h-[450px]",
        // Terminal panels get a forced dark theme
        isTerminal ? "bg-zinc-900" : "bg-card",
      )}
      style={{
        transform: getTransform(),
        order: position >= 0 ? position : 99,
      }}
      data-panel-index={index}
      data-panel-visible={isVisible}
      data-panel-position={position}
    >
      {/* Panel header */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b px-4 py-3",
          isTerminal ? "border-zinc-700 bg-zinc-800" : "border-border/50 bg-muted/30",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              isTerminal ? "bg-zinc-700" : "bg-muted",
              isTerminal ? "text-emerald-400" : iconColor,
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="flex flex-col">
            <span
              className={cn("text-sm font-semibold tracking-tight", isTerminal && "text-zinc-100")}
            >
              {title}
            </span>
            <span
              className={cn(
                "font-mono text-xs",
                isTerminal ? "text-zinc-400" : "text-muted-foreground",
              )}
            >
              {filename}
            </span>
          </div>
        </div>
        {displayBadge && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              displayBadge === "new"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : displayBadge === "updated"
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                displayBadge === "new"
                  ? "bg-emerald-500"
                  : displayBadge === "updated"
                    ? "bg-blue-500"
                    : "bg-amber-500",
              )}
            />
            {displayBadge}
          </span>
        )}
      </div>

      {/* Terminal-style header dots for terminal panels */}
      {isTerminal && (
        <div className="flex items-center gap-1.5 border-b border-zinc-700 bg-zinc-900 px-4 py-2">
          <span className="size-3 rounded-full bg-red-500/80" />
          <span className="size-3 rounded-full bg-yellow-500/80" />
          <span className="size-3 rounded-full bg-green-500/80" />
          <span className="ml-2 font-mono text-xs text-zinc-500">terminal</span>
        </div>
      )}

      {/* Content area */}
      <div
        className={cn("flex-1 overflow-auto", isTerminal ? "bg-zinc-900 text-zinc-100" : "bg-card")}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Code content wrapper with consistent styling
 */
export function PanelCode({
  children,
  className,
  wordWrap = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Enable word wrapping for long lines */
  wordWrap?: boolean;
}) {
  return (
    <pre
      className={cn(
        "p-4 text-sm leading-relaxed",
        wordWrap ? "whitespace-pre-wrap break-all" : "overflow-x-auto",
        className,
      )}
    >
      <code className={cn("block font-mono", wordWrap ? "w-full" : "w-fit min-w-full")}>
        {children}
      </code>
    </pre>
  );
}

/**
 * Syntax highlighting color classes (matching home.tsx)
 */
export const syn = {
  timestamp: "text-blue-600 dark:text-blue-400",
  directive: "text-purple-600 dark:text-purple-400",
  entity: "text-amber-600 dark:text-amber-400",
  string: "text-emerald-600 dark:text-emerald-400",
  link: "text-cyan-600 dark:text-cyan-400",
  tag: "text-pink-600 dark:text-pink-400",
  section: "text-foreground font-semibold",
  key: "text-foreground/90",
  comment: "text-muted-foreground",
  // Terminal-specific
  termHeader: "text-cyan-400 font-bold",
  termLabel: "text-yellow-400",
  termDim: "text-zinc-500",
  termSuccess: "text-emerald-400",
};
