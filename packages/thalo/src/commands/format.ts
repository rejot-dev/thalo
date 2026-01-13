/**
 * Format command - checks syntax and formats files, returning structured results.
 */

import type { Workspace } from "../model/workspace.js";

// ===================
// Types
// ===================

/**
 * A syntax error found during parsing.
 */
export interface SyntaxErrorInfo {
  /** File path where the error occurred */
  file: string;
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
  /** Human-readable error message */
  message: string;
  /** Error code (e.g., "syntax-parse_error") */
  code: string;
}

/**
 * Result of formatting a single file.
 */
export interface FormatFileResult {
  /** The file path */
  file: string;
  /** The formatted content (or original if unchanged/error) */
  formatted: string;
  /** Whether the content changed after formatting */
  isChanged: boolean;
  /** Whether the file has syntax errors (formatting skipped) */
  hasSyntaxErrors: boolean;
  /** Syntax errors found in the file (if any) */
  syntaxErrors: SyntaxErrorInfo[];
}

/**
 * Result of running the format command.
 */
export interface FormatResult {
  /** Number of files that were processed */
  filesProcessed: number;
  /** Results for each file */
  fileResults: FormatFileResult[];
  /** Number of files that were changed/need changes */
  changedCount: number;
  /** Number of files with syntax errors */
  syntaxErrorCount: number;
  /** Total number of syntax errors across all files */
  totalSyntaxErrors: number;
}

/**
 * A formatter function that formats source code.
 */
export type Formatter = (source: string, filepath: string) => Promise<string>;

/**
 * Input for formatting a single file.
 */
export interface FormatFileInput {
  /** The file path */
  file: string;
  /** The file content */
  content: string;
}

/**
 * Options for running the format command.
 */
export interface RunFormatOptions {
  /** Custom formatter function (e.g., prettier) */
  formatter: Formatter;
}

// ===================
// Core Logic
// ===================

/**
 * Check a file for syntax errors using the thalo parser.
 * Returns syntax errors without running semantic analysis or rules.
 */
function collectSyntaxErrors(
  workspace: Workspace,
  file: string,
  content: string,
): SyntaxErrorInfo[] {
  const errors: SyntaxErrorInfo[] = [];

  workspace.addDocument(content, { filename: file });
  try {
    const model = workspace.getModel(file);
    if (!model) {
      return errors;
    }

    // Collect root-level syntax errors
    for (const error of model.ast.syntaxErrors) {
      errors.push({
        file,
        line: error.location.startPosition.row + 1,
        column: error.location.startPosition.column + 1,
        message: error.message,
        code: `syntax-${error.code}`,
      });
    }

    return errors;
  } finally {
    workspace.removeDocument(file);
  }
}

/**
 * Format a single file, checking for syntax errors first.
 *
 * @param workspace - The workspace to use for syntax checking
 * @param input - The file input (path and content)
 * @param formatter - The formatter function to apply
 * @returns The format result for this file
 */
export async function formatFile(
  workspace: Workspace,
  input: FormatFileInput,
  formatter: Formatter,
): Promise<FormatFileResult> {
  const { file, content } = input;

  // Check for syntax errors first
  const syntaxErrors = collectSyntaxErrors(workspace, file, content);
  if (syntaxErrors.length > 0) {
    // Return unchanged content - don't format files with syntax errors
    return {
      file,
      formatted: content,
      isChanged: false,
      hasSyntaxErrors: true,
      syntaxErrors,
    };
  }

  // Format the file
  const formatted = await formatter(content, file);

  return {
    file,
    formatted,
    isChanged: content !== formatted,
    hasSyntaxErrors: false,
    syntaxErrors: [],
  };
}

/**
 * Run the format command on multiple files.
 *
 * @param workspace - The workspace to use for syntax checking
 * @param files - The files to format (path and content)
 * @param options - Format options including the formatter function
 * @returns Structured format results
 */
export async function runFormat(
  workspace: Workspace,
  files: FormatFileInput[],
  options: RunFormatOptions,
): Promise<FormatResult> {
  const { formatter } = options;

  const fileResults: FormatFileResult[] = [];

  // Process files sequentially to avoid workspace conflicts
  // (workspace.addDocument/removeDocument is not concurrent-safe)
  for (const input of files) {
    const result = await formatFile(workspace, input, formatter);
    fileResults.push(result);
  }

  // Calculate summary statistics
  const changedCount = fileResults.filter((r) => r.isChanged).length;
  const syntaxErrorCount = fileResults.filter((r) => r.hasSyntaxErrors).length;
  const totalSyntaxErrors = fileResults.reduce((sum, r) => sum + r.syntaxErrors.length, 0);

  return {
    filesProcessed: files.length,
    fileResults,
    changedCount,
    syntaxErrorCount,
    totalSyntaxErrors,
  };
}
