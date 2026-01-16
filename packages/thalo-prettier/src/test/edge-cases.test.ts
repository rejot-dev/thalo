import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../mod";

const format = async (code: string, opts: prettier.Options = {}): Promise<string> => {
  return prettier.format(code, {
    parser: "thalo",
    plugins: [plugin],
    ...opts,
  });
};

describe("edge cases", () => {
  it("should handle entry without content", async () => {
    const input = `2026-01-05T17:00Z create reference "Some article" #reading
  url: "https://example.com"
  ref-type: "article"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T17:00Z create reference "Some article" #reading
  url: "https://example.com"
  ref-type: "article"
`);
  });

  it("should handle entry with only header", async () => {
    const input = `2026-01-05T18:00Z update opinion "Quick update" #note
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00Z update opinion "Quick update" #note
`);
  });

  it("should handle title with special characters", async () => {
    const input = `2026-01-05T18:00Z create lore "Adyen's accounting system: a double-entry approach" #finance
  type: "fact"
`;

    const output = await format(input);

    expect(output)
      .toBe(`2026-01-05T18:00Z create lore "Adyen's accounting system: a double-entry approach" #finance
  type: "fact"
`);
  });

  it("should handle empty file", async () => {
    const input = ``;

    const output = await format(input);

    expect(output).toBe(``);
  });

  it("should handle content directly after header (no blank line)", async () => {
    const input = `2026-01-05T18:00Z create journal "Direct content"
  # Summary
  Content starts right after header.
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00Z create journal "Direct content"
  # Summary
  Content starts right after header.
`);
  });

  it("should handle content directly after metadata (no blank line)", async () => {
    const input = `2026-01-05T18:00Z create lore "Direct after metadata"
  type: "fact"
  # Description
  Section starts right after metadata.
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00Z create lore "Direct after metadata"
  type: "fact"

  # Description
  Section starts right after metadata.
`);
  });

  it("should handle line at max print width with tag token", async () => {
    // This test ensures that when a line is exactly at or near the max print width
    // with a tag token like #123123123, the formatter handles it correctly.
    // Line is 92 characters: "2026-01-05T18:00Z create reference "A long title that is moderately sized" #123123123"
    const input = `2026-01-05T18:00Z create reference "A long title that is moderately sized" #123123123
  url: "https://example.com"
`;

    const output = await format(input);

    expect(output)
      .toBe(`2026-01-05T18:00Z create reference "A long title that is moderately sized" #123123123
  url: "https://example.com"
`);
  });

  it("should handle header line exceeding printWidth with tag", async () => {
    // When the header line exceeds printWidth, it should still be preserved
    // (header lines are not wrapped)
    const input = `2026-01-05T18:00Z create journal "Test" #123123123
  type: "note"
`;

    const output = await format(input, { printWidth: 40 });

    expect(output).toBe(`2026-01-05T18:00Z create journal "Test" #123123123
  type: "note"
`);
  });

  it("should not wrap lines such that a # token starts the line", async () => {
    // Content lines cannot start with # (unless it's a markdown header with space).
    // The formatter must avoid breaking lines before # tokens in prose content.
    const input = `2026-01-05T18:00Z create journal "Test"
  type: "note"

  # Entry
  Word word #12345678901234567890
`;

    const output = await format(input, { printWidth: 22, proseWrap: "always" });

    // The # token should NOT start on its own line - that would create invalid syntax
    // Instead, keep it on the same line as preceding text
    expect(output).toBe(`2026-01-05T18:00Z create journal "Test"
  type: "note"

  # Entry
  Word word #12345678901234567890
`);
  });

  it("should not wrap lines such that a // token starts the line", async () => {
    // Content lines cannot start with // (would be parsed as a comment).
    // The formatter must avoid breaking lines before // in prose content.
    const input = `2026-01-05T18:00Z create journal "Test"
  type: "note"

  # Entry
  Some text //comment-like text here.
`;

    const output = await format(input, { printWidth: 20, proseWrap: "always" });

    // The // should NOT start on its own line - that would be parsed as a comment
    expect(output).toBe(`2026-01-05T18:00Z create journal "Test"
  type: "note"

  # Entry
  Some text //comment-like
  text here.
`);
  });
});
