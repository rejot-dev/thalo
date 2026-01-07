import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "ptall",
    plugins: [plugin],
  });
};

describe("multiple entries", () => {
  it("should separate entries with blank lines", async () => {
    const input = `2026-01-05T15:00 create journal "First entry" #test
  type: "reflection"

  # Thoughts
  Some thoughts.

2026-01-05T16:00 create journal "Second entry" #test
  type: "reflection"

  # Thoughts
  More thoughts.
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T15:00 create journal "First entry" #test
  type: "reflection"

  # Thoughts
  Some thoughts.

2026-01-05T16:00 create journal "Second entry" #test
  type: "reflection"

  # Thoughts
  More thoughts.
`);
  });

  it("should handle three or more entries", async () => {
    const input = `2026-01-05T10:00 create lore "First" #test
  type: "fact"

2026-01-05T11:00 create lore "Second" #test
  type: "fact"

2026-01-05T12:00 create lore "Third" #test
  type: "fact"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T10:00 create lore "First" #test
  type: "fact"

2026-01-05T11:00 create lore "Second" #test
  type: "fact"

2026-01-05T12:00 create lore "Third" #test
  type: "fact"
`);
  });
});
