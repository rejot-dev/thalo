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
  describe("instance entry formatting", () => {
    it("should format a simple lore entry", async () => {
      const input = `2026-01-05T18:00 create lore "MSc Software Engineering" #education
  type: fact
  subject: ^self

  # Description
  Completed MSc Software Engineering at the University of Amsterdam.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create lore "MSc Software Engineering" #education
  type: fact
  subject: ^self

  # Description
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

    it("should format an update directive", async () => {
      const input = `2026-01-10T14:00 update opinion "Revised stance" #typescript
  confidence: medium
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-10T14:00 update opinion "Revised stance" #typescript
  confidence: medium
`);
    });

    it("should format all entity types", async () => {
      const input = `2026-01-05T10:00 create lore "Lore entry" #test
  type: fact

2026-01-05T11:00 create opinion "Opinion entry" #test
  confidence: high

2026-01-05T12:00 create reference "Reference entry" #test
  ref-type: article

2026-01-05T13:00 create journal "Journal entry" #test
  mood: reflective
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T10:00 create lore "Lore entry" #test
  type: fact

2026-01-05T11:00 create opinion "Opinion entry" #test
  confidence: high

2026-01-05T12:00 create reference "Reference entry" #test
  ref-type: article

2026-01-05T13:00 create journal "Journal entry" #test
  mood: reflective
`);
    });

    it("should format metadata with link values", async () => {
      const input = `2026-01-05T18:00 create lore "Related entry" #test
  type: insight
  subject: ^self
  related: ^other-entry
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create lore "Related entry" #test
  type: insight
  subject: ^self
  related: ^other-entry
`);
    });

    it("should format metadata with quoted values", async () => {
      const input = `2026-01-05T18:00 create reference "Article" #reading
  url: "https://example.com/article"
  author: "John Doe"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create reference "Article" #reading
  url: "https://example.com/article"
  author: "John Doe"
`);
    });

    it("should format metadata with date ranges", async () => {
      const input = `2026-01-05T18:00 create lore "Work period" #career
  type: fact
  date: 2020 ~ 2024
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create lore "Work period" #career
  type: fact
  date: 2020 ~ 2024
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

    it("should format content with multi-level headers", async () => {
      const input = `2026-01-05T16:00 create opinion "Complex opinion" #test
  confidence: high

  # Main Section
  Introduction text.

  ## Subsection
  More details here.

  ### Deep Section
  Even more details.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T16:00 create opinion "Complex opinion" #test
  confidence: high

  # Main Section
  Introduction text.

  ## Subsection
  More details here.

  ### Deep Section
  Even more details.
`);
    });

    it("should format multi-line content paragraphs", async () => {
      const input = `2026-01-05T18:00 create journal "Thoughts" #reflection
  mood: contemplative

  # Reflection
  This is the first line of a longer paragraph
  that continues across multiple lines
  to express a complete thought.

  And here is another paragraph
  also spanning multiple lines.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create journal "Thoughts" #reflection
  mood: contemplative

  # Reflection
  This is the first line of a longer paragraph
  that continues across multiple lines
  to express a complete thought.

  And here is another paragraph
  also spanning multiple lines.
`);
    });

    it("should preserve blank lines in content", async () => {
      const input = `2026-01-05T18:00 create journal "Spaced thoughts" #test
  type: reflection

  # Notes
  First thought.


  Second thought after double blank.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create journal "Spaced thoughts" #test
  type: reflection

  # Notes
  First thought.


  Second thought after double blank.
`);
    });
  });

  describe("multiple entries", () => {
    it("should separate entries with blank lines", async () => {
      const input = `2026-01-05T15:00 create journal "First entry" #test
  type: reflection

  # Thoughts
  Some thoughts.

2026-01-05T16:00 create journal "Second entry" #test
  type: reflection

  # Thoughts
  More thoughts.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T15:00 create journal "First entry" #test
  type: reflection

  # Thoughts
  Some thoughts.

2026-01-05T16:00 create journal "Second entry" #test
  type: reflection

  # Thoughts
  More thoughts.
`);
    });

    it("should handle three or more entries", async () => {
      const input = `2026-01-05T10:00 create lore "First" #test
  type: fact

2026-01-05T11:00 create lore "Second" #test
  type: fact

2026-01-05T12:00 create lore "Third" #test
  type: fact
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T10:00 create lore "First" #test
  type: fact

2026-01-05T11:00 create lore "Second" #test
  type: fact

2026-01-05T12:00 create lore "Third" #test
  type: fact
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

    it("should handle title with special characters", async () => {
      const input = `2026-01-05T18:00 create lore "Adyen's accounting system: a double-entry approach" #finance
  type: fact
`;

      const output = await format(input);

      expect(output)
        .toBe(`2026-01-05T18:00 create lore "Adyen's accounting system: a double-entry approach" #finance
  type: fact
`);
    });

    it("should handle empty file", async () => {
      const input = ``;

      const output = await format(input);

      expect(output).toBe(``);
    });

    it("should handle content directly after header (no blank line)", async () => {
      const input = `2026-01-05T18:00 create journal "Direct content"
  # Summary
  Content starts right after header.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create journal "Direct content"

  # Summary
  Content starts right after header.
`);
    });

    it("should handle content directly after metadata (no blank line)", async () => {
      const input = `2026-01-05T18:00 create lore "Direct after metadata"
  type: fact
  # Description
  Section starts right after metadata.
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:00 create lore "Direct after metadata"
  type: fact

  # Description
  Section starts right after metadata.
`);
    });
  });

  describe("schema entry formatting", () => {
    it("should format a simple define-entity", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Collected resources"
  # Metadata
  url: string
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Collected resources"
  # Metadata
  url: string
`);
    });

    it("should format define-entity with optional fields", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  url?: string ; "the url to the resource"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  url?: string ; "the url to the resource"
`);
    });

    it("should format define-entity with union types", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  ref-type: "article" | "video" | "tweet"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  ref-type: "article" | "video" | "tweet"
`);
    });

    it("should format define-entity with primitive union types", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  author: string | link
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  author: string | link
`);
    });

    it("should format define-entity with array types", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  related: link[]
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  related: link[]
`);
    });

    it("should format define-entity with default values", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  status?: "unread" | "read" = "unread"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  status?: "unread" | "read" = "unread"
`);
    });

    it("should format define-entity with date and date-range types", async () => {
      const input = `2026-01-05T18:12 define-entity lore "Facts"
  # Metadata
  date?: date-range
  published?: date
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity lore "Facts"
  # Metadata
  date?: date-range
  published?: date
`);
    });

    it("should format define-entity with sections", async () => {
      const input = `2026-01-05T18:12 define-entity opinion "Stances"
  # Sections
  Claim ; "Core opinion"
  Caveats?
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity opinion "Stances"
  # Sections
  Claim ; "Core opinion"
  Caveats?
`);
    });

    it("should format define-entity with multiple sections", async () => {
      const input = `2026-01-05T18:12 define-entity opinion "Full opinion schema"
  # Sections
  Claim ; "Core opinion statement"
  Reasoning ; "Supporting arguments"
  Caveats? ; "Edge cases and exceptions"
  References?
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity opinion "Full opinion schema"
  # Sections
  Claim ; "Core opinion statement"
  Reasoning ; "Supporting arguments"
  Caveats? ; "Edge cases and exceptions"
  References?
`);
    });

    it("should format define-entity with tags", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Collected resources" #schema #v1
  # Metadata
  url?: string
`;

      const output = await format(input);

      expect(output)
        .toBe(`2026-01-05T18:12 define-entity reference "Collected resources" #schema #v1
  # Metadata
  url?: string
`);
    });

    it("should format define-entity with link", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Resources" ^reference-schema
  # Metadata
  url?: string
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources" ^reference-schema
  # Metadata
  url?: string
`);
    });

    it("should format complete define-entity with metadata and sections", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Collected resources" #schema
  # Metadata
  url?: string ; "the url"
  ref-type: "article" | "video"
  author?: string | link
  status?: "unread" | "read" = "unread"
  related?: link[]
  # Sections
  Summary ; "Brief summary"
  KeyTakeaways?
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Collected resources" #schema
  # Metadata
  url?: string ; "the url"
  ref-type: "article" | "video"
  author?: string | link
  status?: "unread" | "read" = "unread"
  related?: link[]

  # Sections
  Summary ; "Brief summary"
  KeyTakeaways?
`);
    });

    it("should format alter-entity adding metadata", async () => {
      const input = `2026-01-10T14:00 alter-entity reference "Add published field"
  # Metadata
  published: date ; "publication date"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-10T14:00 alter-entity reference "Add published field"
  # Metadata
  published: date ; "publication date"
`);
    });

    it("should format alter-entity removing metadata", async () => {
      const input = `2026-01-10T14:00 alter-entity reference "Remove legacy field"
  # Remove Metadata
  legacy-field ; "deprecated"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-10T14:00 alter-entity reference "Remove legacy field"
  # Remove Metadata
  legacy-field ; "deprecated"
`);
    });

    it("should format alter-entity adding sections", async () => {
      const input = `2026-01-10T14:00 alter-entity reference "Add section"
  # Sections
  NewSection? ; "newly added section"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-10T14:00 alter-entity reference "Add section"
  # Sections
  NewSection? ; "newly added section"
`);
    });

    it("should format alter-entity removing sections", async () => {
      const input = `2026-01-10T14:00 alter-entity reference "Remove section"
  # Remove Sections
  OldSection ; "no longer needed"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-10T14:00 alter-entity reference "Remove section"
  # Remove Sections
  OldSection ; "no longer needed"
`);
    });

    it("should format alter-entity with multiple field removals", async () => {
      const input = `2026-01-10T14:00 alter-entity reference "Clean up"
  # Remove Metadata
  legacy-field ; "deprecated"
  old-status
  unused-field ; "never used"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-10T14:00 alter-entity reference "Clean up"
  # Remove Metadata
  legacy-field ; "deprecated"
  old-status
  unused-field ; "never used"
`);
    });

    it("should format alter-entity with all block types", async () => {
      const input = `2026-01-10T14:00 alter-entity reference "Major update"
  # Metadata
  published: date
  # Remove Metadata
  legacy-field
  # Sections
  NewSection?
  # Remove Sections
  OldSection
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-10T14:00 alter-entity reference "Major update"
  # Metadata
  published: date
  # Remove Metadata
  legacy-field

  # Sections
  NewSection?

  # Remove Sections
  OldSection
`);
    });

    it("should add blank line before # Sections when preceded by metadata", async () => {
      const input = `2026-01-05T18:12 define-entity lore "Simple entity"
  # Metadata
  type: string
  # Sections
  Description
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity lore "Simple entity"
  # Metadata
  type: string

  # Sections
  Description
`);
    });

    it("should preserve blank line when input already has it", async () => {
      const input = `2026-01-05T18:12 define-entity lore "Simple entity"
  # Metadata
  type: string

  # Sections
  Description
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity lore "Simple entity"
  # Metadata
  type: string

  # Sections
  Description
`);
    });
  });

  describe("indentation normalization", () => {
    it("should normalize 4-space field indentation to 2 spaces", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
    url?: string ; "the url to the resource"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  url?: string ; "the url to the resource"
`);
    });

    it("should normalize 6-space field indentation to 2 spaces", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
      url?: string ; "the url"
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  url?: string ; "the url"
`);
    });

    it("should normalize mixed field indentation", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  url?: string
    ref-type: "article" | "video"
      author?: string
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  url?: string
  ref-type: "article" | "video"
  author?: string
`);
    });

    it("should normalize section indentation", async () => {
      const input = `2026-01-05T18:12 define-entity opinion "Stances"
  # Sections
    Claim ; "Core opinion"
      Caveats?
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity opinion "Stances"
  # Sections
  Claim ; "Core opinion"
  Caveats?
`);
    });

    it("should normalize header indentation", async () => {
      const input = `2026-01-05T18:12 define-entity reference "Resources"
    # Metadata
    url?: string
`;

      const output = await format(input);

      expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Metadata
  url?: string
`);
    });
  });

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
});
