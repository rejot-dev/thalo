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

describe("prettier options", () => {
  it("respects useTabs for indentation", async () => {
    const input = `2026-01-05T18:12Z define-entity reference "Resources"
  # Metadata
    url?: string ; "the url"
`;

    const output = await format(input, { useTabs: true });

    expect(output).toBe(`2026-01-05T18:12Z define-entity reference "Resources"
\t# Metadata
\turl?: string ; "the url"
`);
  });

  it("respects tabWidth for indentation", async () => {
    const input = `2026-01-05T18:12Z define-entity reference "Resources"
  # Metadata
    url?: string ; "the url"
`;

    const output = await format(input, { tabWidth: 4 });

    expect(output).toBe(`2026-01-05T18:12Z define-entity reference "Resources"
    # Metadata
    url?: string ; "the url"
`);
  });

  it("wraps prose when proseWrap is always", async () => {
    const input = `2026-01-05T18:00Z create journal "Thoughts"
  type: "note"

  # Notes
  One two three four five six
`;

    const output = await format(input, { proseWrap: "always", printWidth: 20 });

    expect(output).toBe(`2026-01-05T18:00Z create journal "Thoughts"
  type: "note"

  # Notes
  One two three four
  five six
`);
  });

  it("wraps long section lines when proseWrap is always", async () => {
    const input = `2026-01-05T18:00Z create journal "Long section"
  type: "note"

  # Notes
  This is a very long section line that should wrap when prose wrapping is enabled.
`;

    const output = await format(input, { proseWrap: "always", printWidth: 40 });

    expect(output).toBe(`2026-01-05T18:00Z create journal "Long section"
  type: "note"

  # Notes
  This is a very long section line that
  should wrap when prose wrapping is
  enabled.
`);
  });

  it("unwraps prose when proseWrap is never", async () => {
    const input = `2026-01-05T18:00Z create journal "Thoughts"
  type: "note"

  # Notes
  Line one
  continues here
`;

    const output = await format(input, { proseWrap: "never", printWidth: 12 });

    expect(output).toBe(`2026-01-05T18:00Z create journal "Thoughts"
  type: "note"

  # Notes
  Line one continues here
`);
  });

  it("preserves prose when proseWrap is preserve", async () => {
    const input = `2026-01-05T18:00Z create journal "Thoughts"
  type: "note"

  # Notes
  First line
  Second line
`;

    const output = await format(input, { proseWrap: "preserve", printWidth: 12 });

    expect(output).toBe(`2026-01-05T18:00Z create journal "Thoughts"
  type: "note"

  # Notes
  First line
  Second line
`);
  });

  it("preserves bullet points when proseWrap is never", async () => {
    const input = `2026-01-05T18:00Z create reference "Book" #reading
  ref-type: "book"

  # Key Takeaways
  - First point
  - Second point
  - Third point
`;

    const output = await format(input, { proseWrap: "never" });

    expect(output).toBe(`2026-01-05T18:00Z create reference "Book" #reading
  ref-type: "book"

  # Key Takeaways
  - First point
  - Second point
  - Third point
`);
  });

  it("preserves bullet points when proseWrap is always", async () => {
    const input = `2026-01-05T18:00Z create reference "Book" #reading
  ref-type: "book"

  # Key Takeaways
  - First point
  - Second point
  - Third point
`;

    const output = await format(input, { proseWrap: "always", printWidth: 80 });

    expect(output).toBe(`2026-01-05T18:00Z create reference "Book" #reading
  ref-type: "book"

  # Key Takeaways
  - First point
  - Second point
  - Third point
`);
  });

  it("wraps long bullet items when proseWrap is always", async () => {
    const input = `2026-01-05T18:00Z create reference "Book" #reading
  ref-type: "book"

  # Key Takeaways
  - This is a very long bullet point that should wrap to the next line
  - Short point
`;

    const output = await format(input, { proseWrap: "always", printWidth: 40 });

    expect(output).toBe(`2026-01-05T18:00Z create reference "Book" #reading
  ref-type: "book"

  # Key Takeaways
  - This is a very long bullet point
    that should wrap to the next line
  - Short point
`);
  });

  it("re-formats wrapped bullet items stably", async () => {
    // Input is already wrapped from a previous format
    const input = `2026-01-05T18:00Z create reference "Book" #reading
  ref-type: "book"

  # Key Takeaways
  - This is a very long bullet point
    that should wrap to the next line
  - Short point
`;

    // Re-formatting should produce identical output
    const output = await format(input, { proseWrap: "always", printWidth: 40 });

    expect(output).toBe(`2026-01-05T18:00Z create reference "Book" #reading
  ref-type: "book"

  # Key Takeaways
  - This is a very long bullet point
    that should wrap to the next line
  - Short point
`);
  });
});
