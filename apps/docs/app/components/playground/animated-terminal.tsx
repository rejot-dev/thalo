"use client";

/**
 * AnimatedTerminal - Interactive terminal for running Thalo commands.
 *
 * Users can type commands or use shortcut buttons to run check, query, and actualize.
 */

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react";
import { Terminal, RotateCcw, CheckCircle, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePlayground } from "./playground-context";
import {
  runCommand,
  type CommandType,
  type TerminalLine,
  type CommandResult,
} from "./thalo-runner";

// Example commands for buttons
const EXAMPLE_COMMANDS = [
  { label: "check", command: "thalo check", icon: CheckCircle },
  { label: "query", command: "thalo query 'opinion where #programming'", icon: Search },
  { label: "actualize", command: "thalo actualize", icon: Sparkles },
];

// Default suggestion when input is empty
const DEFAULT_SUGGESTION = "thalo check";

interface HistoryEntry {
  command: string;
  result: CommandResult;
}

function renderLine(line: TerminalLine) {
  switch (line.type) {
    case "header":
      return <span className="font-bold text-cyan-400">{line.text}</span>;
    case "info":
      return <span className="text-zinc-300">{line.text}</span>;
    case "error":
      return <span className="text-red-400">{line.text}</span>;
    case "warning":
      return <span className="text-yellow-400">{line.text}</span>;
    case "success":
      return <span className="text-emerald-400">{line.text}</span>;
    case "dim":
      return <span className="text-zinc-500">{line.text}</span>;
    case "entry":
      return <span className="text-amber-300">{line.text}</span>;
    case "prompt":
      return <span className="text-violet-300">{line.text}</span>;
    case "blank":
      return <span>&nbsp;</span>;
    default:
      return <span className="text-zinc-400">{line.text}</span>;
  }
}

/**
 * Parse a command string into a command type and optional query
 */
function parseCommand(input: string): { type: CommandType; query?: string } | null {
  const trimmed = input.trim();

  // Match "thalo <command>" or just "<command>"
  const match = trimmed.match(/^(?:thalo\s+)?(check|query|actualize)(?:\s+(.*))?$/i);
  if (!match) {
    return null;
  }

  const [, cmd, rest] = match;
  const type = cmd.toLowerCase() as CommandType;

  // For query, extract the query string (may be quoted)
  if (type === "query" && rest) {
    // Match double-quoted, single-quoted, or unquoted content
    // Enforce matching quotes to prevent mismatched pairs
    const queryMatch = rest.match(/^"([^"]*)"$|^'([^']*)'$|^(.*)$/);
    // Prefer double-quote group, then single-quote group, then unquoted group
    const query = queryMatch?.[1] || queryMatch?.[2] || queryMatch?.[3] || rest;
    return { type, query: query.trim() };
  }

  return { type };
}

export interface AnimatedTerminalProps {
  /** Optional additional class name */
  className?: string;
}

export function AnimatedTerminal({ className }: AnimatedTerminalProps) {
  const { entities, entries, synthesis } = usePlayground();
  const [inputValue, setInputValue] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showCursor, setShowCursor] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Cursor blink effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input on mount and when clicking terminal
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Get the current suggestion (placeholder or autocomplete)
  const getSuggestion = useCallback((): string | null => {
    if (inputValue === "") {
      return DEFAULT_SUGGESTION;
    }
    // Show autocomplete suggestions when typing
    if (inputValue.length > 0) {
      const suggestions = [
        "thalo check",
        "thalo query 'opinion where #programming'",
        "thalo actualize",
      ];
      const match = suggestions.find((s) => s.startsWith(inputValue) && s !== inputValue);
      return match || null;
    }
    return null;
  }, [inputValue]);

  const executeCommand = useCallback(
    async (commandStr: string) => {
      // Add to command history
      setCommandHistory((prev) => [...prev, commandStr]);
      setHistoryIndex(-1);

      const parsed = parseCommand(commandStr);

      if (!parsed) {
        // Unknown command
        const errorResult: CommandResult = {
          command: commandStr,
          lines: [
            { type: "error", text: `Unknown command: ${commandStr}` },
            { type: "blank", text: "" },
            { type: "info", text: "Available commands:" },
            { type: "dim", text: "  thalo check      - Validate syntax" },
            {
              type: "dim",
              text: "  thalo query      - Find entries (e.g., thalo query 'opinion where #tag')",
            },
            { type: "dim", text: "  thalo actualize  - Generate synthesis prompt" },
          ],
        };
        setHistory((prev) => [...prev, { command: commandStr, result: errorResult }]);
        return;
      }

      setIsRunning(true);

      try {
        const result = await runCommand(
          parsed.type,
          {
            entities,
            entries,
            synthesis,
          },
          parsed.query,
        );

        setHistory((prev) => [...prev, { command: commandStr, result }]);
      } catch (error) {
        const errorResult: CommandResult = {
          command: commandStr,
          lines: [
            {
              type: "error",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
        setHistory((prev) => [...prev, { command: commandStr, result: errorResult }]);
      } finally {
        setIsRunning(false);
      }
    },
    [entities, entries, synthesis],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (isRunning) {
        return;
      }

      // Enter - execute command
      if (e.key === "Enter" && inputValue.trim()) {
        executeCommand(inputValue);
        setInputValue("");
        return;
      }

      // Up arrow - recall previous command
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex =
            historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[newIndex]);
        }
        return;
      }

      // Down arrow - go forward in history
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex !== -1) {
          const newIndex = historyIndex + 1;
          if (newIndex >= commandHistory.length) {
            setHistoryIndex(-1);
            setInputValue("");
          } else {
            setHistoryIndex(newIndex);
            setInputValue(commandHistory[newIndex]);
          }
        }
        return;
      }

      // Tab or Right arrow - autocomplete
      if (e.key === "Tab" || e.key === "ArrowRight") {
        const suggestion = getSuggestion();
        if (suggestion && suggestion !== inputValue) {
          // Only autocomplete with right arrow if cursor is at end
          if (e.key === "ArrowRight") {
            const input = inputRef.current;
            if (input && input.selectionStart !== inputValue.length) {
              return; // Let default behavior handle cursor movement
            }
          }
          e.preventDefault();
          setInputValue(suggestion);
        }
        return;
      }

      // Ctrl+C - clear line
      if (e.key === "c" && e.ctrlKey) {
        e.preventDefault();
        setInputValue("");
        setHistoryIndex(-1);
        return;
      }
    },
    [inputValue, isRunning, executeCommand, commandHistory, historyIndex, getSuggestion],
  );

  const handleExampleClick = useCallback((command: string) => {
    setInputValue(command);
    inputRef.current?.focus();
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCommandHistory([]);
    setHistoryIndex(-1);
    setInputValue("");
    inputRef.current?.focus();
  }, []);

  const suggestion = getSuggestion();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border-2 border-zinc-700 bg-zinc-900 shadow-xl",
        className,
      )}
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-red-500/80" />
            <span className="size-3 rounded-full bg-yellow-500/80" />
            <span className="size-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Terminal className="size-4" />
            <span className="font-mono text-xs">terminal</span>
          </div>
        </div>

        {/* Command shortcut buttons */}
        <div className="flex items-center gap-1.5">
          <span className="hidden text-[10px] text-zinc-500 sm:inline">Try:</span>
          {EXAMPLE_COMMANDS.map(({ label, command, icon: Icon }) => (
            <button
              key={label}
              onClick={() => handleExampleClick(command)}
              disabled={isRunning}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
                isRunning && "cursor-not-allowed opacity-50",
              )}
              title={`Insert: ${command}`}
            >
              <Icon className="size-3" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}

          {history.length > 0 && (
            <button
              onClick={clearHistory}
              disabled={isRunning}
              className={cn(
                "ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
                isRunning && "cursor-not-allowed opacity-50",
              )}
              title="Clear terminal"
            >
              <RotateCcw className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal content */}
      <div
        ref={scrollRef}
        onClick={focusInput}
        className="h-[350px] cursor-text overflow-auto p-4 font-mono text-sm leading-relaxed"
      >
        {/* Welcome message when empty */}
        {history.length === 0 && !inputValue && (
          <div className="mb-4 text-zinc-500">
            <p>Welcome to the Thalo terminal.</p>
            <p className="mt-1 text-zinc-600">
              Type a command or click a button above to get started.
            </p>
          </div>
        )}

        {/* Command history */}
        {history.map((entry, historyIdx) => (
          <div key={historyIdx} className="mb-4">
            {/* Command line */}
            <div className="flex">
              <span className="text-emerald-400">$</span>
              <span className="ml-2 text-zinc-100">{entry.command}</span>
            </div>

            {/* Output */}
            <div className="mt-2 space-y-0.5">
              {entry.result.lines.map((line, lineIndex) => (
                <div key={lineIndex}>{renderLine(line)}</div>
              ))}
            </div>
          </div>
        ))}

        {/* Current input line */}
        <div className="flex">
          <span className="text-emerald-400">$</span>
          <div className="relative ml-2 flex-1">
            {/* Suggestion/ghost text */}
            {suggestion && (
              <span className="pointer-events-none absolute inset-0 text-zinc-600">
                {suggestion}
              </span>
            )}
            {/* Actual input */}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setHistoryIndex(-1); // Reset history navigation when typing
              }}
              onKeyDown={handleKeyDown}
              disabled={isRunning}
              className={cn(
                "relative w-full bg-transparent text-zinc-100 outline-none",
                "caret-transparent", // Hide default caret, we render our own
                isRunning && "cursor-not-allowed opacity-50",
              )}
              autoFocus
            />
            {/* Custom cursor - positioned after the input text */}
            <span
              className={cn(
                "pointer-events-none absolute top-1/2 -translate-y-1/2 h-[1.2em] w-[0.55em] bg-zinc-100",
                showCursor && !isRunning ? "opacity-100" : "opacity-0",
              )}
              style={{ left: `${inputValue.length}ch` }}
            />
          </div>
          {isRunning && <span className="ml-2 text-zinc-500">Running...</span>}
        </div>
      </div>
    </div>
  );
}
