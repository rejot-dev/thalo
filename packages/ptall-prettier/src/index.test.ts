import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "./index";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "ptall",
    plugins: [plugin],
  });
};

describe("ptall-prettier", () => {
  describe("basic entry formatting", () => {
    it("should format a simple lore entry", async () => {
      const input = `2026-01-05T18:00 create lore "MSc Software Engineering" #education
  type: fact
  subject: ^self

  Completed MSc Software Engineering at the University of Amsterdam.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create lore "MSc Software Engineering" #education
  type: fact
  subject: ^self

  Completed MSc Software Engineering at the University of Amsterdam.
`);
    });

    it("should format an entry with multiple tags and links", async () => {
      const input = `2026-01-05T18:11 create lore "Custom event streaming" ^event-streaming #architecture #distributed
  type: fact
  subject: acme-corp
`;

      const output = await format(input);

      expect(output)
        .toBe(`2026-01-05T18:11 create lore "Custom event streaming" ^event-streaming #architecture #distributed
  type: fact
  subject: acme-corp
`);
    });
  });

  describe("content formatting", () => {
    it("should format content with markdown headers", async () => {
      const input = `2026-01-05T16:00 create opinion "TypeScript enums" #typescript
  confidence: high

  # Claim
  TypeScript enums are a code smell.

  # Reasoning
  Enums generate runtime code.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T16:00 create opinion "TypeScript enums" #typescript
  confidence: high

  # Claim
  TypeScript enums are a code smell.

  # Reasoning
  Enums generate runtime code.
`);
    });
  });

  describe("multiple entries", () => {
    it("should separate entries with blank lines", async () => {
      const input = `2026-01-05T15:00 create journal "First entry" #test
  type: reflection

  Some thoughts.

2026-01-05T16:00 create journal "Second entry" #test
  type: reflection

  More thoughts.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T15:00 create journal "First entry" #test
  type: reflection

  Some thoughts.

2026-01-05T16:00 create journal "Second entry" #test
  type: reflection

  More thoughts.
`);
    });
  });

  describe("edge cases", () => {
    it("should handle entry without content", async () => {
      const input = `2026-01-05T17:00 create reference "Some article" #reading
  url: "https://example.com"
  ref-type: article
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T17:00 create reference "Some article" #reading
  url: "https://example.com"
  ref-type: article
`);
    });

    it("should handle entry with only header", async () => {
      const input = `2026-01-05T18:00 update opinion "Quick update" #note
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 update opinion "Quick update" #note
`);
    });
  });
});
