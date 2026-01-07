import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "ptall",
    plugins: [plugin],
  });
};

describe("mixed entries", () => {
  it("should format instance and schema entries together", async () => {
    const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  url?: string

2026-01-05T18:15 create reference "My article"
  url: "https://example.com"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  url?: string

2026-01-05T18:15 create reference "My article"
  url: "https://example.com"
`);
  });

  it("should format multiple schema entries", async () => {
    const input = `2026-01-05T18:00 define-entity lore "Facts schema"
  # Metadata
  type: "fact" | "insight"

2026-01-05T18:01 define-entity opinion "Opinion schema"
  # Sections
  Claim
  Reasoning
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00 define-entity lore "Facts schema"
  # Metadata
  type: "fact" | "insight"

2026-01-05T18:01 define-entity opinion "Opinion schema"
  # Sections
  Claim
  Reasoning
`);
  });

  it("should format define then alter sequence", async () => {
    const input = `2026-01-05T18:00 define-entity reference "Initial schema"
  # Metadata
  url: string

2026-01-10T14:00 alter-entity reference "Add status"
  # Metadata
  status?: "unread" | "read" = "unread"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00 define-entity reference "Initial schema"
  # Metadata
  url: string

2026-01-10T14:00 alter-entity reference "Add status"
  # Metadata
  status?: "unread" | "read" = "unread"
`);
  });
});
