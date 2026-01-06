import type { Position } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { isSchemaDirective } from "@wilco/ptall";

// ===================
// Context Kinds
// ===================

/**
 * The kind of completion context detected at the cursor position.
 */
export type CompletionContextKind =
  | "line_start" // Empty line at column 0, suggest timestamp
  | "after_timestamp" // After timestamp, suggest directive
  | "after_directive" // After directive, suggest entity/identifier
  | "after_entity" // After entity, suggest title (no completion typically)
  | "header_suffix" // After title, suggest ^link or #tag
  | "metadata_key" // Indented line without colon, suggest metadata keys
  | "metadata_value" // After key:, suggest values
  | "schema_block_header" // In schema entry, suggest # Metadata etc.
  | "field_type" // In schema field definition after :, suggest types
  | "section_header" // Content area # line, suggest section names
  | "link" // After ^, suggest link IDs
  | "tag" // After #, suggest tags
  | "unknown";

// ===================
// Context Interface
// ===================

/**
 * Information about the entry being edited.
 */
export interface EntryInfo {
  /** The directive (create, update, define-entity, alter-entity) */
  directive?: string;
  /** The entity type (lore, opinion, etc.) or entity name for schema entries */
  entity?: string;
  /** Whether this is a schema entry (define-entity/alter-entity) */
  isSchemaEntry?: boolean;
  /** Metadata keys already present in the entry */
  existingMetadataKeys?: string[];
}

/**
 * Completion context with all information needed by providers.
 */
export interface CompletionContext {
  /** The detected context kind */
  kind: CompletionContextKind;
  /** Text before the cursor on the current line */
  textBefore: string;
  /** Full text of the current line */
  lineText: string;
  /** The current line number (0-based) */
  lineNumber: number;
  /** Information about the entry being edited */
  entry: EntryInfo;
  /** Partial text being typed (for filtering) */
  partial: string;
  /** The metadata key if in metadata_value context */
  metadataKey?: string;
}

// ===================
// Context Detection
// ===================

/** Timestamp pattern: YYYY-MM-DDTHH:MM */
const TIMESTAMP_PREFIX_PATTERN = /^[12]\d{3}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d\s+/;

/**
 * Get the text before the cursor on the current line.
 */
export function getTextBeforeCursor(document: TextDocument, position: Position): string {
  return document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  });
}

/**
 * Get the full text of a line.
 */
export function getLineText(document: TextDocument, lineNumber: number): string {
  const lineCount = document.lineCount;
  if (lineNumber >= lineCount) {
    return "";
  }
  const start = { line: lineNumber, character: 0 };
  const end = { line: lineNumber + 1, character: 0 };
  const text = document.getText({ start, end });
  // Remove trailing newline
  return text.replace(/\r?\n$/, "");
}

/**
 * Find the entry header line by scanning backwards from the cursor.
 * Returns the line number and text of the header, or undefined if not found.
 */
function findEntryHeader(
  document: TextDocument,
  fromLine: number,
): { line: number; text: string } | undefined {
  for (let i = fromLine; i >= 0; i--) {
    const lineText = getLineText(document, i);
    // Header lines start with a timestamp (not indented)
    if (TIMESTAMP_PREFIX_PATTERN.test(lineText)) {
      return { line: i, text: lineText };
    }
    // If we hit a non-indented, non-empty line that's not a timestamp, stop
    if (lineText.trim() && !lineText.startsWith(" ") && !lineText.startsWith("\t")) {
      break;
    }
  }
  return undefined;
}

/**
 * Parse entry info from a header line.
 */
function parseEntryInfo(headerText: string): EntryInfo {
  const parts = headerText.split(/\s+/);
  const info: EntryInfo = {};

  if (parts.length >= 2) {
    const directive = parts[1];
    info.directive = directive;
    info.isSchemaEntry = isSchemaDirective(directive);
  }

  if (parts.length >= 3) {
    info.entity = parts[2];
  }

  return info;
}

/**
 * Extract existing metadata keys from lines between header and cursor.
 */
function extractExistingMetadataKeys(
  document: TextDocument,
  headerLine: number,
  currentLine: number,
): string[] {
  const keys: string[] = [];
  for (let i = headerLine + 1; i < currentLine; i++) {
    const line = getLineText(document, i);
    // Match indented lines with key: pattern
    const match = line.match(/^[\t ]+([a-z][a-zA-Z0-9\-_]*):/);
    if (match) {
      keys.push(match[1]);
    }
  }
  return keys;
}

/**
 * Check if a line is in the content area (after a blank line following metadata).
 */
function isInContentArea(document: TextDocument, headerLine: number, currentLine: number): boolean {
  let foundBlankAfterMetadata = false;
  let foundMetadata = false;

  for (let i = headerLine + 1; i < currentLine; i++) {
    const line = getLineText(document, i);
    const trimmed = line.trim();

    if (!trimmed) {
      if (foundMetadata) {
        foundBlankAfterMetadata = true;
      }
      continue;
    }

    // Check if it's a metadata line (indented with key:)
    if (/^[\t ]+[a-z][a-zA-Z0-9\-_]*:/.test(line)) {
      foundMetadata = true;
      continue;
    }

    // Check if it's content (indented text after blank line)
    if (foundBlankAfterMetadata && /^[\t ]+/.test(line)) {
      return true;
    }
  }

  return foundBlankAfterMetadata;
}

/**
 * Check if we're inside a schema block definition (after # Metadata, # Sections, etc.)
 */
function isInSchemaBlock(document: TextDocument, headerLine: number, currentLine: number): boolean {
  for (let i = currentLine - 1; i > headerLine; i--) {
    const line = getLineText(document, i);
    const trimmed = line.trim();

    // Found a schema block header
    if (
      trimmed === "# Metadata" ||
      trimmed === "# Sections" ||
      trimmed === "# Remove Metadata" ||
      trimmed === "# Remove Sections"
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Detect the completion context at a given position.
 */
export function detectContext(document: TextDocument, position: Position): CompletionContext {
  const textBefore = getTextBeforeCursor(document, position);
  const lineText = getLineText(document, position.line);

  // Default context
  const ctx: CompletionContext = {
    kind: "unknown",
    textBefore,
    lineText,
    lineNumber: position.line,
    entry: {},
    partial: "",
  };

  // Check for link context (^) - highest priority
  if (textBefore.endsWith("^") || /\^[\w\-:]*$/.test(textBefore)) {
    ctx.kind = "link";
    const match = textBefore.match(/\^([\w\-:]*)$/);
    ctx.partial = match ? match[1] : "";
    // Still try to get entry info
    const header = findEntryHeader(document, position.line);
    if (header) {
      ctx.entry = parseEntryInfo(header.text);
    }
    return ctx;
  }

  // Check for tag context (#) - but not markdown headers in content
  const trimmedBefore = textBefore.trimStart();
  if (
    !trimmedBefore.startsWith("#") &&
    (textBefore.endsWith("#") || /#[\w\-./]*$/.test(textBefore))
  ) {
    ctx.kind = "tag";
    const match = textBefore.match(/#([\w\-./]*)$/);
    ctx.partial = match ? match[1] : "";
    // Still try to get entry info
    const header = findEntryHeader(document, position.line);
    if (header) {
      ctx.entry = parseEntryInfo(header.text);
    }
    return ctx;
  }

  // Empty line at column 0 -> suggest timestamp
  if (textBefore === "" && position.character === 0) {
    ctx.kind = "line_start";
    return ctx;
  }

  // Check if line starts with timestamp
  const timestampMatch = textBefore.match(/^([12]\d{3}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d)\s*/);
  if (timestampMatch) {
    const afterTimestamp = textBefore.slice(timestampMatch[0].length);

    // Just timestamp + space -> suggest directive
    if (afterTimestamp === "" || afterTimestamp.match(/^\s*$/)) {
      ctx.kind = "after_timestamp";
      ctx.partial = afterTimestamp.trim();
      return ctx;
    }

    // Parse what comes after timestamp
    const parts = afterTimestamp.trim().split(/\s+/);
    const directive = parts[0];

    ctx.entry.directive = directive;
    ctx.entry.isSchemaEntry = isSchemaDirective(directive);

    // After directive -> suggest entity
    if (parts.length === 1 && !afterTimestamp.endsWith(" ")) {
      ctx.kind = "after_timestamp";
      ctx.partial = directive;
      return ctx;
    }

    if (parts.length === 1 && afterTimestamp.endsWith(" ")) {
      ctx.kind = "after_directive";
      ctx.partial = "";
      return ctx;
    }

    // Entity is being typed
    if (parts.length >= 2) {
      ctx.entry.entity = parts[1];
    }

    if (parts.length === 2 && !afterTimestamp.endsWith(" ") && !afterTimestamp.includes('"')) {
      ctx.kind = "after_directive";
      ctx.partial = parts[1];
      return ctx;
    }

    // Check if we're after the title (look for closing quote)
    const titleMatch = afterTimestamp.match(/"[^"]*"/);
    if (titleMatch) {
      // After title -> header suffix (for tags/links)
      ctx.kind = "header_suffix";
      const afterTitle = afterTimestamp.slice(
        afterTimestamp.indexOf(titleMatch[0]) + titleMatch[0].length,
      );
      ctx.partial = afterTitle.trim();
      return ctx;
    }

    // After entity but before/during title
    if (parts.length >= 2) {
      ctx.kind = "after_entity";
      return ctx;
    }
  }

  // Indented line -> metadata or content
  const indentMatch = textBefore.match(/^([\t ]+)/);
  if (indentMatch && indentMatch[1].length >= 2) {
    const header = findEntryHeader(document, position.line);
    if (header) {
      ctx.entry = parseEntryInfo(header.text);
      ctx.entry.existingMetadataKeys = extractExistingMetadataKeys(
        document,
        header.line,
        position.line,
      );
    }

    const afterIndent = textBefore.slice(indentMatch[0].length);

    // Schema entry handling
    if (ctx.entry.isSchemaEntry) {
      // Check for # at start of indented content -> schema block header
      if (afterIndent.startsWith("#") && !afterIndent.includes(":")) {
        ctx.kind = "schema_block_header";
        ctx.partial = afterIndent;
        return ctx;
      }

      // Inside a schema block (after # Metadata, # Sections, etc.)
      if (header && isInSchemaBlock(document, header.line, position.line)) {
        // Check if we're after a colon (field type position)
        const colonMatch = afterIndent.match(/^[a-z][a-zA-Z0-9\-_]*\??:\s*/);
        if (colonMatch) {
          ctx.kind = "field_type";
          ctx.partial = afterIndent.slice(colonMatch[0].length);
          return ctx;
        }
      }
    }

    // Check if we're in content area
    if (header && isInContentArea(document, header.line, position.line)) {
      // Check for section header (# in content)
      if (afterIndent.startsWith("#") && afterIndent.length <= 2) {
        ctx.kind = "section_header";
        ctx.partial = afterIndent.replace(/^#\s*/, "");
        return ctx;
      }
      // Regular content - no completion
      ctx.kind = "unknown";
      return ctx;
    }

    // Check if there's a colon -> metadata value
    const colonIndex = afterIndent.indexOf(":");
    if (colonIndex !== -1) {
      ctx.kind = "metadata_value";
      ctx.metadataKey = afterIndent.slice(0, colonIndex).trim();
      ctx.partial = afterIndent.slice(colonIndex + 1).trim();
      return ctx;
    }

    // No colon yet -> metadata key
    ctx.kind = "metadata_key";
    ctx.partial = afterIndent.trim();
    return ctx;
  }

  return ctx;
}

/**
 * Get partial text for filtering (used by some providers).
 */
export function getPartialText(textBefore: string, prefix: string): string {
  const match = textBefore.match(new RegExp(`\\${prefix}([\\w\\-:/.]*)$`));
  return match ? match[1] : "";
}
