/**
 * AST Builder: Converts Tree-sitter CST to typed AST with syntax validation.
 *
 * This module is responsible for:
 * - Converting CST nodes to typed AST nodes
 * - Decomposing timestamps into date, time, and timezone parts
 * - Validating syntax constraints (timezone required, etc.)
 * - Emitting SyntaxErrorNode for recoverable syntax errors
 *
 * Note: This module runs alongside extract.ts during the migration period.
 * Once migration is complete, extract.ts can be removed.
 */
import type { SyntaxNode, Point } from "tree-sitter";
import type {
  Location,
  SyntaxErrorCode,
  SyntaxErrorNode,
  DatePart,
  TimePart,
  TimezonePart,
  Timestamp,
  Result,
} from "./types.js";

// ===================
// Location Utilities
// ===================

/**
 * Extract location information from a tree-sitter node
 */
function extractLocation(node: SyntaxNode): Location {
  return {
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    startPosition: node.startPosition,
    endPosition: node.endPosition,
  };
}

/**
 * Create a synthetic location from two points
 */
function syntheticLocation(
  start: { index: number; position: Point },
  end: { index: number; position: Point },
): Location {
  return {
    startIndex: start.index,
    endIndex: end.index,
    startPosition: start.position,
    endPosition: end.position,
  };
}

// ===================
// Syntax Error Helpers
// ===================

/**
 * Create a syntax error node for recoverable parse errors
 */
export function createSyntaxError<Code extends SyntaxErrorCode>(
  code: Code,
  message: string,
  text: string,
  node: SyntaxNode,
): SyntaxErrorNode<Code> {
  return {
    type: "syntax_error",
    code,
    message,
    text,
    location: extractLocation(node),
    syntaxNode: node,
  };
}

/**
 * Create a syntax error node with a synthetic location
 */
export function createSyntaxErrorAt<Code extends SyntaxErrorCode>(
  code: Code,
  message: string,
  text: string,
  location: Location,
  syntaxNode: SyntaxNode,
): SyntaxErrorNode<Code> {
  return {
    type: "syntax_error",
    code,
    message,
    text,
    location,
    syntaxNode,
  };
}

// ===================
// Timestamp Building
// ===================

/**
 * Parse a timezone string and return the offset in minutes
 *
 * @param tz - Timezone string like "Z", "+05:30", "-08:00"
 * @returns Offset from UTC in minutes (0 for Z, positive for east, negative for west)
 */
export function parseTimezoneOffset(tz: string): number {
  if (tz === "Z") {
    return 0;
  }

  const match = tz.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid timezone format: "${tz}"`);
  }

  const sign = match[1] === "+" ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);

  return sign * (hours * 60 + minutes);
}

/**
 * Build a DatePart from a date string (YYYY-MM-DD)
 */
export function buildDatePart(
  dateStr: string,
  location: Location,
  syntaxNode: SyntaxNode,
): DatePart {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date format: "${dateStr}"`);
  }

  return {
    type: "date_part",
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
    value: dateStr,
    location,
    syntaxNode,
  };
}

/**
 * Build a TimePart from a time string (HH:MM)
 */
export function buildTimePart(
  timeStr: string,
  location: Location,
  syntaxNode: SyntaxNode,
): TimePart {
  const match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time format: "${timeStr}"`);
  }

  return {
    type: "time_part",
    hour: parseInt(match[1], 10),
    minute: parseInt(match[2], 10),
    value: timeStr,
    location,
    syntaxNode,
  };
}

/**
 * Build a TimezonePart from a timezone string
 */
export function buildTimezonePart(
  tzStr: string,
  location: Location,
  syntaxNode: SyntaxNode,
): TimezonePart {
  return {
    type: "timezone_part",
    value: tzStr,
    offsetMinutes: parseTimezoneOffset(tzStr),
    location,
    syntaxNode,
  };
}

/**
 * Build a Timestamp with decomposed parts from a timestamp string.
 *
 * Expected format: YYYY-MM-DDTHH:MM[Z|±HH:MM]
 *
 * If the timezone is missing (when grammar allows it), a SyntaxErrorNode
 * is created for the timezone field.
 *
 * @param node - The tree-sitter node for the timestamp
 * @returns Timestamp with decomposed date, time, and timezone parts
 */
export function buildTimestamp(node: SyntaxNode): Timestamp {
  const text = node.text;

  // Parse the timestamp: YYYY-MM-DDTHH:MM[Z|±HH:MM]
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})?$/);

  if (!match) {
    throw new Error(`Invalid timestamp format: "${text}"`);
  }

  const dateStr = match[1];
  const timeStr = match[2];
  const tzStr = match[3];

  // Calculate positions for each part within the timestamp
  const baseIndex = node.startIndex;
  const baseRow = node.startPosition.row;
  const baseCol = node.startPosition.column;

  // Date: positions 0-9 (YYYY-MM-DD)
  const dateLocation = syntheticLocation(
    { index: baseIndex, position: { row: baseRow, column: baseCol } },
    { index: baseIndex + 10, position: { row: baseRow, column: baseCol + 10 } },
  );

  // Time: positions 11-15 (HH:MM, after the T)
  const timeLocation = syntheticLocation(
    { index: baseIndex + 11, position: { row: baseRow, column: baseCol + 11 } },
    { index: baseIndex + 16, position: { row: baseRow, column: baseCol + 16 } },
  );

  const datePart = buildDatePart(dateStr, dateLocation, node);
  const timePart = buildTimePart(timeStr, timeLocation, node);

  // Build timezone or syntax error if missing
  let timezone: Result<TimezonePart, "missing_timezone">;

  if (tzStr) {
    // Timezone: position 16 onwards
    const tzLocation = syntheticLocation(
      { index: baseIndex + 16, position: { row: baseRow, column: baseCol + 16 } },
      { index: node.endIndex, position: node.endPosition },
    );
    timezone = buildTimezonePart(tzStr, tzLocation, node);
  } else {
    // Missing timezone - create syntax error at end of timestamp
    const errorLocation = syntheticLocation(
      { index: baseIndex + 16, position: { row: baseRow, column: baseCol + 16 } },
      { index: baseIndex + 16, position: { row: baseRow, column: baseCol + 16 } },
    );
    timezone = createSyntaxErrorAt(
      "missing_timezone",
      "Timestamp requires timezone (e.g., Z or +05:30)",
      text,
      errorLocation,
      node,
    );
  }

  return {
    type: "timestamp",
    value: text,
    date: datePart,
    time: timePart,
    timezone,
    location: extractLocation(node),
    syntaxNode: node,
  };
}

// ===================
// Validation Helpers
// ===================

/**
 * Check if a timestamp has a valid timezone (not a syntax error)
 */
export function hasValidTimezone(timestamp: Timestamp): boolean {
  if (!timestamp.timezone) {
    return false;
  }
  return timestamp.timezone.type !== "syntax_error";
}

/**
 * Get the timezone value from a timestamp, or null if missing/invalid
 */
export function getTimezoneValue(timestamp: Timestamp): string | null {
  if (!timestamp.timezone || timestamp.timezone.type === "syntax_error") {
    return null;
  }
  return timestamp.timezone.value;
}

/**
 * Get the full formatted timestamp value, including timezone if valid
 */
export function formatTimestamp(timestamp: Timestamp): string {
  if (!timestamp.date || !timestamp.time) {
    return timestamp.value;
  }

  const dateStr = timestamp.date.value;
  const timeStr = timestamp.time.value;
  const tzStr = getTimezoneValue(timestamp) ?? "";

  return `${dateStr}T${timeStr}${tzStr}`;
}
