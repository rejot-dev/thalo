import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "thalo",
    plugins: [plugin],
  });
};

describe("multiple entries", () => {
  it("should separate entries with blank lines", async () => {
    const input = `2026-01-05T15:00Z create journal "First entry" #test
  type: "reflection"

  # Thoughts
  Some thoughts.

2026-01-05T16:00Z create journal "Second entry" #test
  type: "reflection"

  # Thoughts
  More thoughts.
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T15:00Z create journal "First entry" #test
  type: "reflection"

  # Thoughts
  Some thoughts.

2026-01-05T16:00Z create journal "Second entry" #test
  type: "reflection"

  # Thoughts
  More thoughts.
`);
  });

  it("should handle three or more entries", async () => {
    const input = `2026-01-05T10:00Z create lore "First" #test
  type: "fact"

2026-01-05T11:00Z create lore "Second" #test
  type: "fact"

2026-01-05T12:00Z create lore "Third" #test
  type: "fact"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T10:00Z create lore "First" #test
  type: "fact"

2026-01-05T11:00Z create lore "Second" #test
  type: "fact"

2026-01-05T12:00Z create lore "Third" #test
  type: "fact"
`);
  });
});
