import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";

// ─────────────────────────────────────────────────────────────────────────────
// File Templates
// ─────────────────────────────────────────────────────────────────────────────

const ENTITIES_THALO = `{{TIMESTAMP}} define-entity journal "Personal thoughts, reflections, and experiences"
  # Metadata
  subject: string | link ; "Subject name/slug (use ^self for personal)"
  type: string ; "idea, reflection, experience, doubt, question, etc."
  mood?: string ; "Free text mood"
  context?: string ; "What prompted this entry"
  # Sections
  Entry ; "The journal entry content"

{{TIMESTAMP}} define-entity opinion "Formed stances on topics"
  # Metadata
  confidence: "high" | "medium" | "low"
  supersedes?: link ; "Reference to previous stance"
  related?: link[] ; "Related entries"
  # Sections
  Claim ; "Core opinion in 1-2 sentences"
  Reasoning ; "Bullet points supporting the claim"
  Caveats? ; "Edge cases, limitations, exceptions"

{{TIMESTAMP}} define-entity reference "External resources or local files"
  # Metadata
  url?: string ; "Full URL to external resource"
  file?: string ; "Path to local file"
  ref-type: "article" | "video" | "tweet" | "paper" | "book" | "other"
  author?: string | link ; "Creator/author name"
  published?: datetime ; "Publication date"
  status?: "unread" | "read" | "processed" = "unread"
  # Sections
  Summary? ; "Brief summary of the content"
  Key Takeaways? ; "Bullet points of main insights"
  Related? ; "Links to related entries"

{{TIMESTAMP}} define-entity lore "Facts and insights about subjects or yourself"
  # Metadata
  type: "fact" | "insight" ; "fact = verifiable info, insight = learned wisdom"
  subject: string | link ; "Subject name/slug (use ^self for personal lore)"
  date?: date-range ; "Relevant date or date range"
  # Sections
  Description ; "The lore content"

{{TIMESTAMP}} define-entity me "Entity to allow for self-references" ^self
  # Sections
  Bio ; "Need at least one section"
`;

const AGENTS_MD = `# THALO - Personal Thought And Lore Language

Entity schemas are defined in \`entities.thalo\`.

## Entry Syntax

\`\`\`
{timestamp} {directive} {entity} "Title" [^link-id] [#tags...]
  {key}: {value}
  ...

  # Section
  {content}

\`\`\`

- **timestamp**: ISO 8601 local time with timezone (\`2026-01-05T15:30Z\`)
- **directive**: \`create\` or \`update\`
- **entity**: \`journal\`, \`opinion\`, \`reference\`, or \`lore\`
- **^link-id**: Optional explicit ID for cross-referencing
- **#tag**: Optional categorization tags

## Metadata

Metadata fields are indented key-value pairs. See \`entities.thalo\` for required/optional
fields per entity. Values can be:

- Strings: \`author: "Jane Doe"\` or unquoted \`author: Jane Doe\`
- Links: \`subject: ^self\` or \`related: ^my-other-entry\`
- Dates: \`published: 2023-03-16\`
- Date ranges: \`date: 2020 ~ 2021\`

## Sections

Content sections start with \`# SectionName\` (indented). **All content must be within a section.**
Each entity type defines which sections are required/optional in \`entities.thalo\`.

## Example

\`\`\`thalo
2026-01-05T16:00Z create opinion "TypeScript enums should be avoided" ^opinion-ts-enums #typescript
  confidence: "high"

  # Claim
  TypeScript enums should be replaced with \`as const\` objects.

  # Reasoning
  - Enums generate runtime code
  - \`as const\` provides the same type safety with zero overhead

\`\`\`

## Tips

- Run \`date -u +"%Y-%m-%dT%H:%MZ"\` to get the current timestamp
- Use \`thalo check\` to validate entries against schemas
`;

// ─────────────────────────────────────────────────────────────────────────────
// Init Action
// ─────────────────────────────────────────────────────────────────────────────

function initAction(ctx: CommandContext): void {
  const { options, args } = ctx;

  // Determine target directory
  const targetDir = args.length > 0 ? path.resolve(args[0]) : process.cwd();

  // Get current timestamp for entity definitions
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16) + "Z"; // YYYY-MM-DDTHH:MMZ

  const dryRun = options["dry-run"] as boolean;
  const force = options["force"] as boolean;

  if (dryRun) {
    console.log(pc.dim("Dry run mode - no files will be created"));
    console.log();
  }

  console.log(pc.bold("Initializing THALO..."));
  console.log();

  const files = [
    { path: "entities.thalo", content: ENTITIES_THALO.replace(/\{\{TIMESTAMP\}\}/g, timestamp) },
    { path: "AGENTS.md", content: AGENTS_MD },
  ];

  let createdCount = 0;
  let warningCount = 0;

  for (const file of files) {
    const fullPath = path.join(targetDir, file.path);
    const exists = fs.existsSync(fullPath);

    if (exists && !force) {
      console.log(
        `${pc.yellow("⚠")} ${pc.yellow("warning:")} ${file.path} already exists, skipping`,
      );
      warningCount++;
      continue;
    }

    if (exists && force) {
      console.log(`${pc.yellow("⚠")} ${pc.yellow("overwriting:")} ${file.path}`);
    }

    if (!dryRun) {
      fs.writeFileSync(fullPath, file.content, "utf-8");
    }

    console.log(`${pc.green("✓")} Created: ${pc.dim(file.path)}`);
    createdCount++;
  }

  // Summary
  console.log();
  if (warningCount > 0) {
    console.log(`${pc.yellow("Warnings:")} ${warningCount} file(s) already exist`);
  }

  if (dryRun) {
    console.log(pc.dim("Run without --dry-run to create files."));
  } else if (createdCount > 0) {
    console.log(`${pc.green("✓")} Done! Created ${createdCount} file(s).`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Definition
// ─────────────────────────────────────────────────────────────────────────────

export const initCommand: CommandDef = {
  name: "init",
  description: "Initialize THALO with entity definitions and documentation",
  args: {
    name: "directory",
    description: "Target directory (defaults to current directory)",
    required: false,
    multiple: false,
  },
  options: {
    "dry-run": {
      type: "boolean",
      short: "n",
      description: "Show what would be created without making changes",
      default: false,
    },
    force: {
      type: "boolean",
      short: "f",
      description: "Overwrite existing files",
      default: false,
    },
  },
  action: initAction,
};
