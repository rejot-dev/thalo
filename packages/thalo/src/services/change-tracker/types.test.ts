import { describe, it, expect } from "vitest";
import { parseCheckpoint, formatCheckpoint } from "./change-tracker.js";

describe("parseCheckpoint", () => {
  describe("git checkpoints", () => {
    it("should parse git checkpoint with double quotes", () => {
      const marker = parseCheckpoint('"git:abc123def456"');
      expect(marker).toEqual({
        type: "git",
        value: "abc123def456",
      });
    });

    it("should parse git checkpoint with single quotes", () => {
      const marker = parseCheckpoint("'git:abc123def456'");
      expect(marker).toEqual({
        type: "git",
        value: "abc123def456",
      });
    });

    it("should parse git checkpoint without quotes", () => {
      const marker = parseCheckpoint("git:abc123def456");
      expect(marker).toEqual({
        type: "git",
        value: "abc123def456",
      });
    });
  });

  describe("timestamp checkpoints", () => {
    it("should parse ts checkpoint", () => {
      const marker = parseCheckpoint('"ts:2026-01-07T12:00Z"');
      expect(marker).toEqual({
        type: "ts",
        value: "2026-01-07T12:00Z",
      });
    });

    it("should parse ts checkpoint without quotes", () => {
      const marker = parseCheckpoint("ts:2026-01-07T12:00Z");
      expect(marker).toEqual({
        type: "ts",
        value: "2026-01-07T12:00Z",
      });
    });
  });

  describe("invalid cases", () => {
    it("should return null when value is undefined", () => {
      const marker = parseCheckpoint(undefined);
      expect(marker).toBeNull();
    });

    it("should return null when value is empty string", () => {
      const marker = parseCheckpoint("");
      expect(marker).toBeNull();
    });

    it("should return null when no colon in value", () => {
      const marker = parseCheckpoint("abc123def456");
      expect(marker).toBeNull();
    });

    it("should return null for unknown provider", () => {
      const marker = parseCheckpoint("db:123");
      expect(marker).toBeNull();
    });

    it("should return null when value after colon is empty", () => {
      const marker = parseCheckpoint("git:");
      expect(marker).toBeNull();
    });
  });
});

describe("formatCheckpoint", () => {
  it("should format git marker", () => {
    const result = formatCheckpoint({ type: "git", value: "abc123def456" });
    expect(result).toBe("git:abc123def456");
  });

  it("should format ts marker", () => {
    const result = formatCheckpoint({ type: "ts", value: "2026-01-07T12:00Z" });
    expect(result).toBe("ts:2026-01-07T12:00Z");
  });
});
