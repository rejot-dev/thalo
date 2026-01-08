import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "thalo",
    plugins: [plugin],
  });
};

describe("instance entry formatting", () => {
  it("should format a simple lore entry", async () => {
    const input = `2026-01-05T18:00Z create lore "MSc Software Engineering" #education
  type: "fact"
  subject: ^self

  # Description
  Completed MSc Software Engineering at the University of Amsterdam.
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00Z create lore "MSc Software Engineering" #education
  type: "fact"
  subject: ^self

  # Description
  Completed MSc Software Engineering at the University of Amsterdam.
`);
  });

  it("should format an entry with multiple tags and links", async () => {
    const input = `2026-01-05T18:11Z create lore "Custom event streaming" ^event-streaming #architecture #distributed
  type: "fact"
  subject: ^acme-corp
`;

    const output = await format(input);

    expect(output)
      .toBe(`2026-01-05T18:11Z create lore "Custom event streaming" ^event-streaming #architecture #distributed
  type: "fact"
  subject: ^acme-corp
`);
  });

  it("should format an update directive", async () => {
    const input = `2026-01-10T14:00Z update opinion "Revised stance" #typescript
  confidence: "medium"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-10T14:00Z update opinion "Revised stance" #typescript
  confidence: "medium"
`);
  });

  it("should format all entity types", async () => {
    const input = `2026-01-05T10:00Z create lore "Lore entry" #test
  type: "fact"

2026-01-05T11:00Z create opinion "Opinion entry" #test
  confidence: "high"

2026-01-05T12:00Z create reference "Reference entry" #test
  ref-type: "article"

2026-01-05T13:00Z create journal "Journal entry" #test
  mood: "reflective"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T10:00Z create lore "Lore entry" #test
  type: "fact"

2026-01-05T11:00Z create opinion "Opinion entry" #test
  confidence: "high"

2026-01-05T12:00Z create reference "Reference entry" #test
  ref-type: "article"

2026-01-05T13:00Z create journal "Journal entry" #test
  mood: "reflective"
`);
  });

  it("should format metadata with link values", async () => {
    const input = `2026-01-05T18:00Z create lore "Related entry" #test
  type: "insight"
  subject: ^self
  related: ^other-entry
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00Z create lore "Related entry" #test
  type: "insight"
  subject: ^self
  related: ^other-entry
`);
  });

  it("should format metadata with quoted values", async () => {
    const input = `2026-01-05T18:00Z create reference "Article" #reading
  url: "https://example.com/article"
  author: "John Doe"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00Z create reference "Article" #reading
  url: "https://example.com/article"
  author: "John Doe"
`);
  });

  it("should format metadata with date ranges", async () => {
    const input = `2026-01-05T18:00Z create lore "Work period" #career
  type: "fact"
  date: 2020 ~ 2024
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00Z create lore "Work period" #career
  type: "fact"
  date: 2020 ~ 2024
`);
  });
});
