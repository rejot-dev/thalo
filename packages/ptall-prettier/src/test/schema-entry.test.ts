import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../index";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "ptall",
    plugins: [plugin],
  });
};

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
  published?: datetime
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:12 define-entity lore "Facts"
  # Metadata
  date?: date-range
  published?: datetime
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

    expect(output).toBe(`2026-01-05T18:12 define-entity reference "Collected resources" #schema #v1
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

  it("should format section names with spaces", async () => {
    const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Sections
  Key Takeaways? ; "main points"
  Related Items
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Sections
  Key Takeaways? ; "main points"
  Related Items
`);
  });

  it("should normalize multiple spaces in section names to single space", async () => {
    const input = `2026-01-05T18:12 define-entity reference "Resources"
  # Sections
  Key  Takeaways? ; "main points"
  Related   Items
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:12 define-entity reference "Resources"
  # Sections
  Key Takeaways? ; "main points"
  Related Items
`);
  });

  it("should format alter-entity adding metadata", async () => {
    const input = `2026-01-10T14:00 alter-entity reference "Add published field"
  # Metadata
  published: datetime ; "publication date"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-10T14:00 alter-entity reference "Add published field"
  # Metadata
  published: datetime ; "publication date"
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

  it("should format alter-entity removing sections with spaces in name", async () => {
    const input = `2026-01-10T14:00 alter-entity reference "Remove section"
  # Remove Sections
  Old Section Name ; "deprecated section"
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-10T14:00 alter-entity reference "Remove section"
  # Remove Sections
  Old Section Name ; "deprecated section"
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
  published: datetime
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
  published: datetime
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
