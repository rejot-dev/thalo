import { describe, it, expect } from "vitest";
import type { SyntaxErrorNode, TimezonePart, Result } from "./ast-types.js";
import { isSyntaxError, isValidResult } from "./ast-types.js";
import type { Point } from "tree-sitter";

// Helper to create a mock location
const mockLocation = () => ({
  startIndex: 0,
  endIndex: 10,
  startPosition: { row: 0, column: 0 } as Point,
  endPosition: { row: 0, column: 10 } as Point,
});

// Helper to create a mock syntax node (minimal for testing)
const mockSyntaxNode = () =>
  ({
    type: "mock",
    text: "mock",
    startIndex: 0,
    endIndex: 10,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 10 },
  }) as unknown as import("tree-sitter").SyntaxNode;

describe("SyntaxError types", () => {
  describe("isSyntaxError", () => {
    it("should return true for syntax error nodes", () => {
      const syntaxError: SyntaxErrorNode<"missing_timezone"> = {
        type: "syntax_error",
        code: "missing_timezone",
        message: "Timestamp requires timezone",
        text: "2026-01-05T18:00",
        location: mockLocation(),
        syntaxNode: mockSyntaxNode(),
      };

      const result: Result<TimezonePart, "missing_timezone"> = syntaxError;
      expect(isSyntaxError(result)).toBe(true);
    });

    it("should return false for valid result nodes", () => {
      const timezonePart: TimezonePart = {
        type: "timezone_part",
        value: "Z",
        offsetMinutes: 0,
        location: mockLocation(),
        syntaxNode: mockSyntaxNode(),
      };

      const result: Result<TimezonePart, "missing_timezone"> = timezonePart;
      expect(isSyntaxError(result)).toBe(false);
    });
  });

  describe("isValidResult", () => {
    it("should return false for syntax error nodes", () => {
      const syntaxError: SyntaxErrorNode<"missing_timezone"> = {
        type: "syntax_error",
        code: "missing_timezone",
        message: "Timestamp requires timezone",
        text: "2026-01-05T18:00",
        location: mockLocation(),
        syntaxNode: mockSyntaxNode(),
      };

      const result: Result<TimezonePart, "missing_timezone"> = syntaxError;
      expect(isValidResult(result)).toBe(false);
    });

    it("should return true for valid result nodes", () => {
      const timezonePart: TimezonePart = {
        type: "timezone_part",
        value: "Z",
        offsetMinutes: 0,
        location: mockLocation(),
        syntaxNode: mockSyntaxNode(),
      };

      const result: Result<TimezonePart, "missing_timezone"> = timezonePart;
      expect(isValidResult(result)).toBe(true);
    });
  });

  describe("Result type", () => {
    it("should allow discriminating between error and success using type guards", () => {
      const errorResult: Result<TimezonePart, "missing_timezone"> = {
        type: "syntax_error",
        code: "missing_timezone",
        message: "Timestamp requires timezone",
        text: "2026-01-05T18:00",
        location: mockLocation(),
        syntaxNode: mockSyntaxNode(),
      };

      const successResult: Result<TimezonePart, "missing_timezone"> = {
        type: "timezone_part",
        value: "+05:30",
        offsetMinutes: 330,
        location: mockLocation(),
        syntaxNode: mockSyntaxNode(),
      };

      // Test type narrowing with isSyntaxError
      if (isSyntaxError(errorResult)) {
        expect(errorResult.code).toBe("missing_timezone");
        expect(errorResult.message).toBe("Timestamp requires timezone");
      } else {
        // This branch should not be reached
        expect.fail("Expected syntax error");
      }

      // Test type narrowing with isValidResult
      if (isValidResult(successResult)) {
        expect(successResult.value).toBe("+05:30");
        expect(successResult.offsetMinutes).toBe(330);
      } else {
        // This branch should not be reached
        expect.fail("Expected valid result");
      }
    });
  });
});

describe("Timestamp decomposed parts", () => {
  it("should support DatePart with numeric components", () => {
    const datePart = {
      type: "date_part" as const,
      year: 2026,
      month: 1,
      day: 5,
      value: "2026-01-05",
      location: mockLocation(),
      syntaxNode: mockSyntaxNode(),
    };

    expect(datePart.year).toBe(2026);
    expect(datePart.month).toBe(1);
    expect(datePart.day).toBe(5);
    expect(datePart.value).toBe("2026-01-05");
  });

  it("should support TimePart with numeric components", () => {
    const timePart = {
      type: "time_part" as const,
      hour: 18,
      minute: 30,
      value: "18:30",
      location: mockLocation(),
      syntaxNode: mockSyntaxNode(),
    };

    expect(timePart.hour).toBe(18);
    expect(timePart.minute).toBe(30);
    expect(timePart.value).toBe("18:30");
  });

  it("should support TimezonePart with offset", () => {
    const timezonePart: TimezonePart = {
      type: "timezone_part",
      value: "+05:30",
      offsetMinutes: 330,
      location: mockLocation(),
      syntaxNode: mockSyntaxNode(),
    };

    expect(timezonePart.value).toBe("+05:30");
    expect(timezonePart.offsetMinutes).toBe(330);
  });

  it("should support UTC timezone", () => {
    const utcTimezone: TimezonePart = {
      type: "timezone_part",
      value: "Z",
      offsetMinutes: 0,
      location: mockLocation(),
      syntaxNode: mockSyntaxNode(),
    };

    expect(utcTimezone.value).toBe("Z");
    expect(utcTimezone.offsetMinutes).toBe(0);
  });

  it("should support negative timezone offsets", () => {
    const negativeTimezone: TimezonePart = {
      type: "timezone_part",
      value: "-08:00",
      offsetMinutes: -480,
      location: mockLocation(),
      syntaxNode: mockSyntaxNode(),
    };

    expect(negativeTimezone.value).toBe("-08:00");
    expect(negativeTimezone.offsetMinutes).toBe(-480);
  });
});
