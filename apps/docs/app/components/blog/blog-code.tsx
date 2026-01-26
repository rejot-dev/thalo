"use client";

/**
 * BlogCode - Interactive Thalo code editor for blog posts with multi-file tabs.
 *
 * Provides an editable code block with syntax highlighting that can
 * be connected to a BlogChecker to show validation results.
 */

import { useState, useCallback, createContext, useContext, useMemo, type ReactNode } from "react";
import { FileCode, BookOpen, Wand2, RotateCcw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { ThaloEditor } from "@/components/playground/thalo-editor";

// File configuration
export interface BlogFile {
  /** Unique identifier for the file */
  id: string;
  /** Display name shown in tab */
  name: string;
  /** Filename shown below the name */
  filename: string;
  /** Initial content */
  content: string;
  /** Icon type: "entities", "entries", "synthesis", or custom */
  icon?: "entities" | "entries" | "synthesis";
}

// Context for sharing code state between BlogCode and BlogChecker
interface BlogCodeContextValue {
  files: BlogFile[];
  contents: Record<string, string>;
  setContent: (fileId: string, content: string) => void;
  getContent: (fileId: string) => string;
  getAllContent: () => string;
  resetAll: () => void;
  resetFile: (fileId: string) => void;
  hasChanges: (fileId: string) => boolean;
  hasAnyChanges: () => boolean;
}

const BlogCodeContext = createContext<BlogCodeContextValue | null>(null);

export function useBlogCode(): BlogCodeContextValue {
  const context = useContext(BlogCodeContext);
  if (!context) {
    throw new Error("useBlogCode must be used within a BlogCodeProvider");
  }
  return context;
}

// Legacy single-file context value (for backwards compatibility)
interface LegacyBlogCodeContextValue {
  code: string;
  setCode: (code: string) => void;
  defaultCode: string;
}

export function useBlogCodeLegacy(): LegacyBlogCodeContextValue {
  const context = useBlogCode();
  const firstFile = context.files[0];
  return {
    code: context.getAllContent(),
    setCode: (code: string) => context.setContent(firstFile?.id ?? "default", code),
    defaultCode: firstFile?.content ?? "",
  };
}

export interface BlogCodeProviderProps {
  children: ReactNode;
  /** Files to display (for multi-file mode) */
  files?: BlogFile[];
  /** Initial code content (for single-file mode, backwards compatible) */
  defaultCode?: string;
}

/**
 * Provider that manages shared code state between BlogCode and BlogChecker.
 * Supports both single-file (legacy) and multi-file modes.
 */
export function BlogCodeProvider({ children, files, defaultCode }: BlogCodeProviderProps) {
  // Support both old single-file API and new multi-file API
  const normalizedFiles: BlogFile[] = useMemo(() => {
    if (files && files.length > 0) {
      return files;
    }
    // Legacy single-file mode
    return [
      {
        id: "default",
        name: "Code",
        filename: "example.thalo",
        content: defaultCode ?? "",
        icon: "entries",
      },
    ];
  }, [files, defaultCode]);

  // Initialize contents from files
  const [contents, setContents] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const file of normalizedFiles) {
      initial[file.id] = file.content;
    }
    return initial;
  });

  const setContent = useCallback((fileId: string, content: string) => {
    setContents((prev) => ({ ...prev, [fileId]: content }));
  }, []);

  const getContent = useCallback(
    (fileId: string) => {
      return contents[fileId] ?? "";
    },
    [contents],
  );

  const getAllContent = useCallback(() => {
    // Concatenate all file contents for the checker
    return normalizedFiles.map((f) => contents[f.id] ?? "").join("\n\n");
  }, [normalizedFiles, contents]);

  const resetAll = useCallback(() => {
    const initial: Record<string, string> = {};
    for (const file of normalizedFiles) {
      initial[file.id] = file.content;
    }
    setContents(initial);
  }, [normalizedFiles]);

  const resetFile = useCallback(
    (fileId: string) => {
      const file = normalizedFiles.find((f) => f.id === fileId);
      if (file) {
        setContents((prev) => ({ ...prev, [fileId]: file.content }));
      }
    },
    [normalizedFiles],
  );

  const hasChanges = useCallback(
    (fileId: string) => {
      const file = normalizedFiles.find((f) => f.id === fileId);
      return file ? contents[fileId] !== file.content : false;
    },
    [normalizedFiles, contents],
  );

  const hasAnyChanges = useCallback(() => {
    return normalizedFiles.some((file) => contents[file.id] !== file.content);
  }, [normalizedFiles, contents]);

  const value: BlogCodeContextValue = {
    files: normalizedFiles,
    contents,
    setContent,
    getContent,
    getAllContent,
    resetAll,
    resetFile,
    hasChanges,
    hasAnyChanges,
  };

  return <BlogCodeContext.Provider value={value}>{children}</BlogCodeContext.Provider>;
}

// Icon mapping
const FILE_ICONS: Record<string, LucideIcon> = {
  entities: FileCode,
  entries: BookOpen,
  synthesis: Wand2,
};

const ICON_COLORS: Record<string, string> = {
  entities: "text-amber-600 dark:text-amber-400",
  entries: "text-blue-600 dark:text-blue-400",
  synthesis: "text-violet-600 dark:text-violet-400",
};

export interface BlogCodeProps {
  /** Title shown in the header (only used in single-file mode) */
  title?: string;
  /** Filename shown in the header (only used in single-file mode) */
  filename?: string;
  /** Optional additional class name */
  className?: string;
  /** Height of the editor */
  height?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
}

/**
 * Editable Thalo code block with tabs for multiple files.
 */
export function BlogCode({
  title,
  filename,
  className,
  height = "320px",
  readOnly = false,
}: BlogCodeProps) {
  const { files, contents, setContent, resetFile, resetAll, hasChanges, hasAnyChanges } =
    useBlogCode();

  const [activeTab, setActiveTab] = useState(files[0]?.id ?? "default");

  // Ensure active tab is valid
  const effectiveTab = files.find((f) => f.id === activeTab)
    ? activeTab
    : (files[0]?.id ?? "default");
  const activeFile = files.find((f) => f.id === effectiveTab);

  const handleChange = useCallback(
    (value: string) => {
      setContent(effectiveTab, value);
    },
    [effectiveTab, setContent],
  );

  const handleResetCurrent = useCallback(() => {
    resetFile(effectiveTab);
  }, [effectiveTab, resetFile]);

  const isSingleFile = files.length === 1;
  const showTabs = files.length > 1;

  // For single file, use props or file data
  const displayTitle = isSingleFile ? (title ?? activeFile?.name ?? "Code") : activeFile?.name;
  const displayFilename = isSingleFile
    ? (filename ?? activeFile?.filename ?? "example.thalo")
    : activeFile?.filename;
  const iconType = activeFile?.icon ?? "entries";
  const Icon = FILE_ICONS[iconType] ?? FileCode;
  const iconColor = ICON_COLORS[iconType] ?? ICON_COLORS.entries;

  return (
    <div
      className={cn(
        "not-prose my-6 flex flex-col overflow-hidden rounded-xl border-2 border-amber-900/20 bg-amber-50 shadow-lg dark:border-zinc-700/50 dark:bg-zinc-900",
        className,
      )}
    >
      {/* Tab bar (for multi-file mode) */}
      {showTabs && (
        <div className="flex border-b border-amber-900/10 bg-amber-100/30 dark:border-zinc-700/50 dark:bg-zinc-800/30">
          {files.map((file) => {
            const isActive = file.id === effectiveTab;
            const FileIcon = FILE_ICONS[file.icon ?? "entries"] ?? FileCode;
            const fileIconColor = ICON_COLORS[file.icon ?? "entries"] ?? ICON_COLORS.entries;
            const fileHasChanges = hasChanges(file.id);

            return (
              <button
                key={file.id}
                onClick={() => setActiveTab(file.id)}
                className={cn(
                  "group relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all",
                  "border-b-2 -mb-[2px]",
                  isActive
                    ? "border-primary bg-amber-50 text-amber-950 dark:bg-zinc-900 dark:text-zinc-100"
                    : "border-transparent text-amber-800/70 hover:bg-amber-100/50 hover:text-amber-950 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100",
                )}
                aria-selected={isActive}
                role="tab"
              >
                <FileIcon
                  className={cn(
                    "size-4 transition-colors",
                    isActive ? fileIconColor : "opacity-60",
                  )}
                />
                <span>{file.name}</span>
                {fileHasChanges && (
                  <span className="size-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-amber-900/10 bg-amber-100/50 px-4 py-2.5 dark:border-zinc-700/50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-7 items-center justify-center rounded-lg bg-amber-200/50 dark:bg-amber-500/10",
              iconColor,
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-amber-950 dark:text-zinc-100">
              {displayTitle}
            </span>
            <span className="font-mono text-xs text-amber-800/60 dark:text-zinc-500">
              {displayFilename}
            </span>
          </div>
        </div>

        {/* Reset button */}
        {!readOnly && (hasChanges(effectiveTab) || (showTabs && hasAnyChanges())) && (
          <div className="flex items-center gap-2">
            {showTabs && hasAnyChanges() && (
              <button
                type="button"
                onClick={resetAll}
                className="flex items-center gap-1.5 rounded-lg border border-amber-300/50 bg-amber-100/50 px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200/50 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <RotateCcw className="size-3" />
                Reset All
              </button>
            )}
            {hasChanges(effectiveTab) && (
              <button
                type="button"
                onClick={handleResetCurrent}
                className="flex items-center gap-1.5 rounded-lg border border-amber-300/50 bg-amber-100/50 px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200/50 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <RotateCcw className="size-3" />
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="overflow-hidden" style={{ height, maxHeight: height }}>
        <ThaloEditor
          key={effectiveTab}
          value={contents[effectiveTab] ?? ""}
          onChange={handleChange}
          readOnly={readOnly}
          className="h-full [&_.cm-editor]:h-full [&_.cm-editor]:bg-amber-50 dark:[&_.cm-editor]:bg-zinc-900 [&_.cm-scroller]:overflow-auto [&_.cm-gutters]:bg-amber-100/50 dark:[&_.cm-gutters]:bg-zinc-800/50 [&_.cm-gutters]:border-amber-900/10 dark:[&_.cm-gutters]:border-zinc-700/50"
        />
      </div>
    </div>
  );
}
