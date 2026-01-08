import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "ptall",
    plugins: [plugin],
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
});
