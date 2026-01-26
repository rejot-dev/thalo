"use client";

/**
 * BlogChecker - Displays Thalo checker results for blog posts.
 *
 * Shows validation output (errors, warnings, success) that updates
 * in real-time as the connected BlogCode editor changes.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Terminal,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useBlogCode } from "./blog-code";
import { Workspace } from "@rejot-dev/thalo";
import { runCheck as runCheckCommand, type CheckResult } from "@rejot-dev/thalo/commands/check";
import { getParser } from "@/lib/thalo-parser.client";

interface DiagnosticLine {
  type: "error" | "warning" | "info";
  file: string;
  line: number;
  column: number;
  message: string;
  code: string;
}

interface CheckState {
  status: "idle" | "checking" | "done";
  result: CheckResult | null;
  error: string | null;
}

export interface BlogCheckerProps {
  /** Title shown in the header */
  title?: string;
  /** Optional additional class name */
  className?: string;
  /** Delay in ms before running check after code changes */
  debounceMs?: number;
  /** Whether to auto-run check on mount and changes */
  autoRun?: boolean;
}

/**
 * Checker output display for blog posts.
 * Shows errors, warnings, and success state from the Thalo checker.
 */
export function BlogChecker({
  title = "Checker Output",
  className,
  debounceMs = 300,
  autoRun = true,
}: BlogCheckerProps) {
  const { files, contents, getAllContent } = useBlogCode();
  const code = getAllContent();
  const [state, setState] = useState<CheckState>({
    status: "idle",
    result: null,
    error: null,
  });

  const runCheck = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "checking" }));

    try {
      const parser = await getParser();
      const workspace = new Workspace(parser);

      // Add each file as a separate document
      for (const file of files) {
        const content = contents[file.id];
        if (content?.trim()) {
          workspace.addDocument(content, { filename: file.filename });
        }
      }

      const result = runCheckCommand(workspace);

      setState({
        status: "done",
        result,
        error: null,
      });
    } catch (err) {
      setState({
        status: "done",
        result: null,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [files, contents]);

  // Auto-run check with debounce
  useEffect(() => {
    if (!autoRun) {
      return;
    }

    const timer = setTimeout(() => {
      void runCheck();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [code, autoRun, debounceMs, runCheck]);

  // Parse diagnostics for display
  const diagnostics = useMemo((): DiagnosticLine[] => {
    if (!state.result) {
      return [];
    }

    const lines: DiagnosticLine[] = [];
    for (const [file, fileDiagnostics] of state.result.diagnosticsByFile) {
      for (const d of fileDiagnostics) {
        lines.push({
          type: d.severity as "error" | "warning" | "info",
          file,
          line: d.line,
          column: d.column,
          message: d.message,
          code: d.code,
        });
      }
    }
    return lines;
  }, [state.result]);

  const hasErrors = (state.result?.errorCount ?? 0) > 0;
  const hasWarnings = (state.result?.warningCount ?? 0) > 0;
  const isSuccess = state.result && !hasErrors && !hasWarnings;

  return (
    <div
      className={cn(
        "not-prose my-6 overflow-hidden rounded-xl border-2 shadow-lg",
        hasErrors
          ? "border-red-500/30 dark:border-red-500/20"
          : hasWarnings
            ? "border-amber-500/30 dark:border-amber-500/20"
            : "border-emerald-500/30 dark:border-emerald-500/20",
        "bg-zinc-900",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-700 bg-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              hasErrors
                ? "bg-red-500/10 text-red-400"
                : hasWarnings
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-emerald-500/10 text-emerald-400",
            )}
          >
            <Terminal className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">{title}</span>
            <span className="font-mono text-xs text-zinc-500">thalo check</span>
          </div>
        </div>

        {/* Status indicator and Run button */}
        <div className="flex items-center gap-3">
          {state.status === "checking" && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Loader2 className="size-3 animate-spin" />
              Checking...
            </div>
          )}
          {state.status === "done" && state.result && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                hasErrors
                  ? "bg-red-500/15 text-red-400"
                  : hasWarnings
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-emerald-500/15 text-emerald-400",
              )}
            >
              {hasErrors ? (
                <>
                  <AlertCircle className="size-3" />
                  {state.result.errorCount} error{state.result.errorCount !== 1 ? "s" : ""}
                </>
              ) : hasWarnings ? (
                <>
                  <AlertTriangle className="size-3" />
                  {state.result.warningCount} warning{state.result.warningCount !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3" />
                  Valid
                </>
              )}
            </div>
          )}

          {/* Run Check button */}
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={state.status === "checking"}
            className={cn(
              "group relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              "bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-md",
              "hover:from-emerald-400 hover:to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/25",
              "active:scale-[0.98]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-emerald-500 disabled:hover:to-emerald-600 disabled:hover:shadow-md",
            )}
          >
            {state.status === "checking" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
            <span>Run Check</span>
          </button>
        </div>
      </div>

      {/* Terminal dots */}
      <div className="flex items-center gap-1.5 border-b border-zinc-700 bg-zinc-900 px-4 py-2">
        <span className="size-3 rounded-full bg-red-500/80" />
        <span className="size-3 rounded-full bg-yellow-500/80" />
        <span className="size-3 rounded-full bg-green-500/80" />
        <span className="ml-2 font-mono text-xs text-zinc-500">terminal</span>
      </div>

      {/* Output */}
      <div className="max-h-[300px] min-h-[120px] overflow-y-auto bg-zinc-900 p-4">
        <div className="font-mono text-sm leading-relaxed">
          {/* Header line */}
          <div className="mb-3 text-cyan-400 font-semibold">=== Running check ===</div>

          {state.error ? (
            <div className="flex items-start gap-2 text-red-400">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          ) : state.status === "idle" ? (
            <div className="text-zinc-500">Waiting for code...</div>
          ) : state.status === "checking" ? (
            <div className="text-zinc-400">Analyzing...</div>
          ) : isSuccess ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="size-4" />
                <span>No issues found</span>
              </div>
              <div className="text-zinc-500">
                {state.result?.filesChecked} file{state.result?.filesChecked !== 1 ? "s" : ""}{" "}
                checked
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {diagnostics.map((d, idx) => (
                <div
                  key={`${d.file}-${d.line}-${d.column}-${idx}`}
                  className={cn(
                    "flex flex-col gap-1",
                    d.type === "error"
                      ? "text-red-400"
                      : d.type === "warning"
                        ? "text-amber-400"
                        : "text-blue-400",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {d.type === "error" ? (
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    ) : d.type === "warning" ? (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    ) : (
                      <Info className="mt-0.5 size-4 shrink-0" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-zinc-400">
                        {d.file}:{d.line}:{d.column}
                      </span>
                      <span>{d.message}</span>
                      <span className="text-xs text-zinc-500">{d.code}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Summary */}
              <div className="mt-4 border-t border-zinc-700 pt-3">
                {hasErrors ? (
                  <span className="text-red-400">
                    {state.result?.errorCount} error{state.result?.errorCount !== 1 ? "s" : ""}
                    {hasWarnings &&
                      `, ${state.result?.warningCount} warning${state.result?.warningCount !== 1 ? "s" : ""}`}
                  </span>
                ) : (
                  <span className="text-amber-400">
                    {state.result?.warningCount} warning
                    {state.result?.warningCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
