import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "ptall",
    plugins: [plugin],
  });
};

describe("indentation normalization", () => {
  it("should normalize 4-space field indentation to 2 spaces", async () => {
    const input = `2026-01-05T18:12Z define-entity reference "Resources"
  # Metadata
    url?: string ; "the url to the resource"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:12Z define-entity reference "Resources"
  # Metadata
  url?: string ; "the url to the resource"
`);
  });

  it("should normalize 6-space field indentation to 2 spaces", async () => {
    const input = `2026-01-05T18:12Z define-entity reference "Resources"
  # Metadata
      url?: string ; "the url"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:12Z define-entity reference "Resources"
  # Metadata
  url?: string ; "the url"
`);
  });

  it("should normalize mixed field indentation", async () => {
    const input = `2026-01-05T18:12Z define-entity reference "Resources"
  # Metadata
  url?: string
    ref-type: "article" | "video"
      author?: string
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:12Z define-entity reference "Resources"
  # Metadata
  url?: string
  ref-type: "article" | "video"
  author?: string
`);
  });

  it("should normalize section indentation", async () => {
    const input = `2026-01-05T18:12Z define-entity opinion "Stances"
  # Sections
    Claim ; "Core opinion"
      Caveats?
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:12Z define-entity opinion "Stances"
  # Sections
  Claim ; "Core opinion"
  Caveats?
`);
  });

  it("should normalize header indentation", async () => {
    const input = `2026-01-05T18:12Z define-entity reference "Resources"
    # Metadata
    url?: string
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:12Z define-entity reference "Resources"
  # Metadata
  url?: string
`);
  });
});
