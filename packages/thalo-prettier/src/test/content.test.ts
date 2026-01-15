import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../mod";

const format = async (code: string): Promise<string> => {
  return prettier.format(code, {
    parser: "thalo",
    plugins: [plugin],
  });
};

describe("content formatting", () => {
  it("should format content with markdown headers", async () => {
    const input = `2026-01-05T16:00Z create opinion "TypeScript enums" #typescript
  confidence: "high"

  # Claim
  TypeScript enums are a code smell.

  # Reasoning
  Enums generate runtime code.
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T16:00Z create opinion "TypeScript enums" #typescript
  confidence: "high"

  # Claim
  TypeScript enums are a code smell.

  # Reasoning
  Enums generate runtime code.
`);
  });

  it("should format content with multi-level headers", async () => {
    const input = `2026-01-05T16:00Z create opinion "Complex opinion" #test
  confidence: "high"

  # Main Section
  Introduction text.

  ## Subsection
  More details here.

  ### Deep Section
  Even more details.
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T16:00Z create opinion "Complex opinion" #test
  confidence: "high"

  # Main Section
  Introduction text.

  ## Subsection
  More details here.

  ### Deep Section
  Even more details.
`);
  });

  it("should normalize multiple spaces in content section headers", async () => {
    const input = `2026-01-05T16:00Z create opinion "Test" #test
  confidence: "high"

  # Key  Takeaways
  Some content.

  ## Related   Items
  More content.
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T16:00Z create opinion "Test" #test
  confidence: "high"

  # Key Takeaways
  Some content.

  ## Related Items
  More content.
`);
  });

  it("should format multi-line content paragraphs", async () => {
    const input = `2026-01-05T18:00Z create journal "Thoughts" #reflection
  mood: "contemplative"

  # Reflection
  This is the first line of a longer paragraph
  that continues across multiple lines
  to express a complete thought.

  And here is another paragraph
  also spanning multiple lines.
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00Z create journal "Thoughts" #reflection
  mood: "contemplative"

  # Reflection
  This is the first line of a longer paragraph
  that continues across multiple lines
  to express a complete thought.

  And here is another paragraph
  also spanning multiple lines.
`);
  });

  it("should preserve blank lines in content", async () => {
    const input = `2026-01-05T18:00Z create journal "Spaced thoughts" #test
  type: "reflection"

  # Notes
  First thought.


  Second thought after double blank.
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T18:00Z create journal "Spaced thoughts" #test
  type: "reflection"

  # Notes
  First thought.


  Second thought after double blank.
`);
  });

  it("should preserve bullet points on separate lines", async () => {
    const input = `2026-01-05T16:00Z create reference "Clean Code" #programming
  ref-type: "book"

  # Key Takeaways
  - Functions should do one thing
  - Names should reveal intent
  - Comments explain why, not what
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T16:00Z create reference "Clean Code" #programming
  ref-type: "book"

  # Key Takeaways
  - Functions should do one thing
  - Names should reveal intent
  - Comments explain why, not what
`);
  });

  it("should preserve asterisk bullet points on separate lines", async () => {
    const input = `2026-01-05T16:00Z create opinion "Testing practices" #testing
  confidence: "high"

  # Claim
  Test behavior, not implementation.

  # Reasoning
  * Tests should be resilient to refactoring
  * Implementation details change frequently
  * Behavior is what users care about
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T16:00Z create opinion "Testing practices" #testing
  confidence: "high"

  # Claim
  Test behavior, not implementation.

  # Reasoning
  * Tests should be resilient to refactoring
  * Implementation details change frequently
  * Behavior is what users care about
`);
  });

  it("should preserve numbered lists on separate lines", async () => {
    const input = `2026-01-05T16:00Z create lore "Development process" #workflow
  type: "fact"

  # Description
  Our standard development process:
  1. Write failing test
  2. Implement minimal code
  3. Refactor
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T16:00Z create lore "Development process" #workflow
  type: "fact"

  # Description
  Our standard development process:
  1. Write failing test
  2. Implement minimal code
  3. Refactor
`);
  });

  it("should handle mixed prose and bullet points", async () => {
    const input = `2026-01-05T16:00Z create opinion "Code reviews" #process
  confidence: "medium"

  # Claim
  Code reviews are essential for quality.

  # Reasoning
  Benefits include:
  - Knowledge sharing across the team
  - Catching bugs early
  - Maintaining code consistency
`;

    const output = await format(input);

    expect(output).toBe(`2026-01-05T16:00Z create opinion "Code reviews" #process
  confidence: "medium"

  # Claim
  Code reviews are essential for quality.

  # Reasoning
  Benefits include:
  - Knowledge sharing across the team
  - Catching bugs early
  - Maintaining code consistency
`);
  });
});
