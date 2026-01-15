import { describe, it, expect } from "vitest";
import type { Point, SyntaxNode } from "tree-sitter";
import {
  buildTimestamp,
  buildDatePart,
  buildTimePart,
  buildTimezonePart,
  parseTimezoneOffset,
  createSyntaxError,
  hasValidTimezone,
  getTimezoneValue,
  formatTimestamp,
} from "./builder.js";
import { isSyntaxError, isValidResult } from "./ast-types.js";

// Helper to create a mock syntax node (simple version for non-timestamp nodes)
function mockSyntaxNode(text: string, startIndex: number = 0): SyntaxNode {
  return {
    type: "timestamp",
    text,
    startIndex,
    endIndex: startIndex + text.length,
    startPosition: { row: 0, column: startIndex } as Point,
    endPosition: { row: 0, column: startIndex + text.length } as Point,
    namedChildren: [],
    childForFieldName: () => null,
  } as unknown as import("tree-sitter").SyntaxNode;
}

// Helper to create a mock timestamp node with proper child nodes
function mockTimestampNode(text: string, startIndex: number = 0): SyntaxNode {
  // Parse timestamp to create proper child nodes
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) {
    throw new Error(`Invalid timestamp format for mock: "${text}"`);
  }

  const dateStr = match[1]; // YYYY-MM-DD (no T)
  const timeStr = match[2];
  const tzStr = match[3];

  const dateEndIndex = startIndex + 10; // YYYY-MM-DD
  const tEndIndex = dateEndIndex + 1; // T
  const timeEndIndex = tEndIndex + 5; // HH:MM
  const tzEndIndex = tzStr ? timeEndIndex + tzStr.length : timeEndIndex;

  const dateNode = {
    type: "timestamp_date",
    text: dateStr,
    startIndex,
    endIndex: dateEndIndex,
    startPosition: { row: 0, column: startIndex } as Point,
    endPosition: { row: 0, column: dateEndIndex } as Point,
  };

  const tNode = {
    type: "timestamp_t",
    text: "T",
    startIndex: dateEndIndex,
    endIndex: tEndIndex,
    startPosition: { row: 0, column: dateEndIndex } as Point,
    endPosition: { row: 0, column: tEndIndex } as Point,
  };

  const timeNode = {
    type: "timestamp_time",
    text: timeStr,
    startIndex: tEndIndex,
    endIndex: timeEndIndex,
    startPosition: { row: 0, column: tEndIndex } as Point,
    endPosition: { row: 0, column: timeEndIndex } as Point,
  };

  const tzNode = tzStr
    ? {
        type: "timestamp_tz",
        text: tzStr,
        startIndex: timeEndIndex,
        endIndex: tzEndIndex,
        startPosition: { row: 0, column: timeEndIndex } as Point,
        endPosition: { row: 0, column: tzEndIndex } as Point,
      }
    : null;

  return {
    type: "timestamp",
    text,
    startIndex,
    endIndex: startIndex + text.length,
    startPosition: { row: 0, column: startIndex } as Point,
    endPosition: { row: 0, column: startIndex + text.length } as Point,
    namedChildren: tzNode ? [dateNode, tNode, timeNode, tzNode] : [dateNode, tNode, timeNode],
    childForFieldName: (name: string) => {
      if (name === "date") {
        return dateNode as unknown as SyntaxNode;
      }
      if (name === "time") {
        return timeNode as unknown as SyntaxNode;
      }
      if (name === "tz") {
        return tzNode as unknown as SyntaxNode | null;
      }
      return null;
    },
  } as unknown as import("tree-sitter").SyntaxNode;
}

// Helper to create mock location
function mockLocation(start: number = 0, end: number = 10) {
  return {
    startIndex: start,
    endIndex: end,
    startPosition: { row: 0, column: start } as Point,
    endPosition: { row: 0, column: end } as Point,
  };
}

describe("parseTimezoneOffset", () => {
  it("should return 0 for UTC (Z)", () => {
    expect(parseTimezoneOffset("Z")).toBe(0);
  });

  it("should parse positive offsets", () => {
    expect(parseTimezoneOffset("+05:30")).toBe(330); // 5*60 + 30
    expect(parseTimezoneOffset("+08:00")).toBe(480); // 8*60
    expect(parseTimezoneOffset("+00:00")).toBe(0);
  });

  it("should parse negative offsets", () => {
    expect(parseTimezoneOffset("-08:00")).toBe(-480);
    expect(parseTimezoneOffset("-05:30")).toBe(-330);
    expect(parseTimezoneOffset("-01:00")).toBe(-60);
  });

  it("should throw for invalid formats", () => {
    expect(() => parseTimezoneOffset("invalid")).toThrow('Invalid timezone format: "invalid"');
    expect(() => parseTimezoneOffset("+5:30")).toThrow(); // Missing leading zero
    expect(() => parseTimezoneOffset("08:00")).toThrow(); // Missing sign
  });
});

describe("buildDatePart", () => {
  it("should parse date correctly", () => {
    const node = mockSyntaxNode("2026-01-05", 0);
    const location = mockLocation(0, 10);
    const datePart = buildDatePart("2026-01-05", location, node);

    expect(datePart.type).toBe("date_part");
    expect(datePart.year).toBe(2026);
    expect(datePart.month).toBe(1);
    expect(datePart.day).toBe(5);
    expect(datePart.value).toBe("2026-01-05");
  });

  it("should handle different months and days", () => {
    const node = mockSyntaxNode("1999-12-31", 0);
    const location = mockLocation(0, 10);
    const datePart = buildDatePart("1999-12-31", location, node);

    expect(datePart.year).toBe(1999);
    expect(datePart.month).toBe(12);
    expect(datePart.day).toBe(31);
  });

  it("should throw for malformed dates", () => {
    const node = mockSyntaxNode("bad-date", 0);
    const location = mockLocation(0, 8);

    expect(() => buildDatePart("bad-date", location, node)).toThrow(
      'Invalid date format: "bad-date"',
    );
  });
});

describe("buildTimePart", () => {
  it("should parse time correctly", () => {
    const node = mockSyntaxNode("18:30", 0);
    const location = mockLocation(0, 5);
    const timePart = buildTimePart("18:30", location, node);

    expect(timePart.type).toBe("time_part");
    expect(timePart.hour).toBe(18);
    expect(timePart.minute).toBe(30);
    expect(timePart.value).toBe("18:30");
  });

  it("should handle midnight", () => {
    const node = mockSyntaxNode("00:00", 0);
    const location = mockLocation(0, 5);
    const timePart = buildTimePart("00:00", location, node);

    expect(timePart.hour).toBe(0);
    expect(timePart.minute).toBe(0);
  });

  it("should throw for malformed times", () => {
    const node = mockSyntaxNode("bad", 0);
    const location = mockLocation(0, 3);

    expect(() => buildTimePart("bad", location, node)).toThrow('Invalid time format: "bad"');
  });
});

describe("buildTimezonePart", () => {
  it("should build UTC timezone", () => {
    const node = mockSyntaxNode("Z", 16);
    const location = mockLocation(16, 17);
    const tzPart = buildTimezonePart("Z", location, node);

    expect(tzPart.type).toBe("timezone_part");
    expect(tzPart.value).toBe("Z");
    expect(tzPart.offsetMinutes).toBe(0);
  });

  it("should build positive offset timezone", () => {
    const node = mockSyntaxNode("+05:30", 16);
    const location = mockLocation(16, 22);
    const tzPart = buildTimezonePart("+05:30", location, node);

    expect(tzPart.value).toBe("+05:30");
    expect(tzPart.offsetMinutes).toBe(330);
  });

  it("should build negative offset timezone", () => {
    const node = mockSyntaxNode("-08:00", 16);
    const location = mockLocation(16, 22);
    const tzPart = buildTimezonePart("-08:00", location, node);

    expect(tzPart.value).toBe("-08:00");
    expect(tzPart.offsetMinutes).toBe(-480);
  });
});

describe("buildTimestamp", () => {
  it("should decompose timestamp with UTC timezone", () => {
    const node = mockTimestampNode("2026-01-05T18:30Z", 0);
    const timestamp = buildTimestamp(node);

    expect(timestamp.type).toBe("timestamp");
    expect(timestamp.value).toBe("2026-01-05T18:30Z");

    // Date part
    expect(timestamp.date).toBeDefined();
    expect(timestamp.date!.year).toBe(2026);
    expect(timestamp.date!.month).toBe(1);
    expect(timestamp.date!.day).toBe(5);
    expect(timestamp.date!.value).toBe("2026-01-05");

    // Time part
    expect(timestamp.time).toBeDefined();
    expect(timestamp.time!.hour).toBe(18);
    expect(timestamp.time!.minute).toBe(30);
    expect(timestamp.time!.value).toBe("18:30");

    // Timezone part
    expect(timestamp.timezone).toBeDefined();
    expect(isValidResult(timestamp.timezone!)).toBe(true);
    if (isValidResult(timestamp.timezone!)) {
      expect(timestamp.timezone.value).toBe("Z");
      expect(timestamp.timezone.offsetMinutes).toBe(0);
    }
  });

  it("should decompose timestamp with positive offset timezone", () => {
    const node = mockTimestampNode("2026-01-05T18:30+05:30", 0);
    const timestamp = buildTimestamp(node);

    expect(isValidResult(timestamp.timezone!)).toBe(true);
    if (isValidResult(timestamp.timezone!)) {
      expect(timestamp.timezone.value).toBe("+05:30");
      expect(timestamp.timezone.offsetMinutes).toBe(330);
    }
  });

  it("should decompose timestamp with negative offset timezone", () => {
    const node = mockTimestampNode("2026-01-05T18:30-08:00", 0);
    const timestamp = buildTimestamp(node);

    expect(isValidResult(timestamp.timezone!)).toBe(true);
    if (isValidResult(timestamp.timezone!)) {
      expect(timestamp.timezone.value).toBe("-08:00");
      expect(timestamp.timezone.offsetMinutes).toBe(-480);
    }
  });

  it("should create syntax error for missing timezone", () => {
    const node = mockTimestampNode("2026-01-05T18:30", 0);
    const timestamp = buildTimestamp(node);

    // Should still have date and time
    expect(timestamp.date).toBeDefined();
    expect(timestamp.time).toBeDefined();

    // Timezone should be a syntax error
    expect(timestamp.timezone).toBeDefined();
    expect(isSyntaxError(timestamp.timezone!)).toBe(true);
    if (isSyntaxError(timestamp.timezone!)) {
      expect(timestamp.timezone.code).toBe("missing_timezone");
      expect(timestamp.timezone.message).toContain("Timestamp requires timezone");
    }
  });

  it("should throw for missing child nodes", () => {
    // Mock node without proper children simulates invalid structure
    const node = mockSyntaxNode("not-a-timestamp", 0);

    expect(() => buildTimestamp(node)).toThrow(
      "Invalid timestamp structure: missing date or time node",
    );
  });
});

describe("createSyntaxError", () => {
  it("should create syntax error with correct properties", () => {
    const node = mockSyntaxNode("test", 0);
    const error = createSyntaxError("missing_timezone", "Test message", "test text", node);

    expect(error.type).toBe("syntax_error");
    expect(error.code).toBe("missing_timezone");
    expect(error.message).toBe("Test message");
    expect(error.text).toBe("test text");
    expect(error.location.startIndex).toBe(0);
  });
});

describe("hasValidTimezone", () => {
  it("should return true for valid timezone", () => {
    const node = mockTimestampNode("2026-01-05T18:30Z", 0);
    const timestamp = buildTimestamp(node);
    expect(hasValidTimezone(timestamp)).toBe(true);
  });

  it("should return false for missing timezone", () => {
    const node = mockTimestampNode("2026-01-05T18:30", 0);
    const timestamp = buildTimestamp(node);
    expect(hasValidTimezone(timestamp)).toBe(false);
  });
});

describe("getTimezoneValue", () => {
  it("should return timezone value for valid timestamp", () => {
    const node = mockTimestampNode("2026-01-05T18:30Z", 0);
    const timestamp = buildTimestamp(node);
    expect(getTimezoneValue(timestamp)).toBe("Z");
  });

  it("should return null for missing timezone", () => {
    const node = mockTimestampNode("2026-01-05T18:30", 0);
    const timestamp = buildTimestamp(node);
    expect(getTimezoneValue(timestamp)).toBeNull();
  });
});

describe("formatTimestamp", () => {
  it("should format complete timestamp", () => {
    const node = mockTimestampNode("2026-01-05T18:30Z", 0);
    const timestamp = buildTimestamp(node);
    expect(formatTimestamp(timestamp)).toBe("2026-01-05T18:30Z");
  });

  it("should format timestamp with positive offset", () => {
    const node = mockTimestampNode("2026-01-05T18:30+05:30", 0);
    const timestamp = buildTimestamp(node);
    expect(formatTimestamp(timestamp)).toBe("2026-01-05T18:30+05:30");
  });

  it("should format timestamp without timezone (drops timezone)", () => {
    const node = mockTimestampNode("2026-01-05T18:30", 0);
    const timestamp = buildTimestamp(node);
    expect(formatTimestamp(timestamp)).toBe("2026-01-05T18:30");
  });
});
