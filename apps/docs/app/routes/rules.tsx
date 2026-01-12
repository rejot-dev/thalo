import { useState } from "react";
import { Link } from "react-router";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  FileCode,
  Link2,
  Database,
  FileText,
  Layers,
  BookOpen,
  Search,
  Info,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

export function meta() {
  return [
    { title: "Checker Rules - Thalo" },
    {
      name: "description",
      content:
        "Complete reference for all Thalo checker rules. Understand validation, best practices, and how to write correct .thalo files.",
    },
  ];
}

// Rule severity badge colors
const severityStyles = {
  error: {
    bg: "bg-red-100 dark:bg-red-950/50",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-900/50",
    icon: AlertCircle,
  },
  warning: {
    bg: "bg-amber-100 dark:bg-amber-950/50",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-900/50",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-blue-100 dark:bg-blue-950/50",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-900/50",
    icon: Info,
  },
};

// Category icons and colors
const categoryMeta: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string; description: string }
> = {
  instance: {
    icon: FileCode,
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/60",
    label: "Instance Entry Rules",
    description: "Validation for create, update, and other instance entries",
  },
  link: {
    icon: Link2,
    color: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-950/60",
    label: "Link Rules",
    description: "Cross-reference and link integrity checks",
  },
  schema: {
    icon: Database,
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/60",
    label: "Schema Definition Rules",
    description: "Entity schema structure and consistency",
  },
  metadata: {
    icon: Layers,
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-950/60",
    label: "Metadata Value Rules",
    description: "Field values, types, and constraints",
  },
  content: {
    icon: FileText,
    color: "text-pink-700 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-950/60",
    label: "Content Rules",
    description: "Markdown sections and entry content",
  },
};

// All rules data organized by category
interface RuleDefinition {
  code: string;
  name: string;
  description: string;
  severity: "error" | "warning" | "info";
  explanation: string;
  example?: { bad?: string; good?: string };
}

const rulesByCategory: Record<string, RuleDefinition[]> = {
  instance: [
    {
      code: "unknown-entity",
      name: "Unknown Entity",
      description: "Instance entry uses an undefined entity type",
      severity: "error",
      explanation:
        "Every instance entry must reference an entity type that has been defined using `define-entity`. This ensures your knowledge base has a consistent structure.",
      example: {
        bad: `2026-01-07T10:00Z create book "My Book"\n  # Content\n  ...\n\n// Error: 'book' entity is not defined`,
        good: `2026-01-07T09:00Z define-entity book "Books"\n  # Sections\n  Summary\n\n2026-01-07T10:00Z create book "My Book"\n  # Summary\n  ...`,
      },
    },
    {
      code: "missing-required-field",
      name: "Missing Required Field",
      description: "Required metadata field not present",
      severity: "error",
      explanation:
        "If an entity schema defines a required field (without `?` or a default value), every instance must provide that field.",
    },
    {
      code: "unknown-field",
      name: "Unknown Field",
      description: "Metadata field not defined in entity schema",
      severity: "warning",
      explanation:
        "Using a field that wasn't defined in the entity schema might indicate a typo. Define the field in your schema or remove it from the entry.",
    },
    {
      code: "invalid-field-type",
      name: "Invalid Field Type",
      description: "Metadata value doesn't match declared type",
      severity: "error",
      explanation:
        "The value provided for a field must match its declared type. For example, a `date` field expects a valid date, not arbitrary text.",
      example: {
        bad: `status: "maybe"\n// Error if status is defined as "done" | "pending"`,
        good: `status: "done"`,
      },
    },
    {
      code: "missing-required-section",
      name: "Missing Required Section",
      description: "Required section not present in content",
      severity: "error",
      explanation:
        "If an entity schema defines a required section, every instance must include that markdown section (# SectionName).",
    },
    {
      code: "unknown-section",
      name: "Unknown Section",
      description: "Section not defined in entity schema",
      severity: "warning",
      explanation:
        "Using a section header that wasn't defined in the schema. This might be intentional for free-form content, but could also be a typo.",
    },
    {
      code: "update-without-create",
      name: "Update Without Create",
      description: "Update entry supersedes wrong directive/entity type",
      severity: "warning",
      explanation:
        "An `update` entry should reference the original `create` entry via the `supersedes` field, not another update or a different entity type.",
    },
    {
      code: "timestamp-out-of-order",
      name: "Timestamp Out of Order",
      description: "Entry timestamp is earlier than the previous entry",
      severity: "warning",
      explanation:
        "Entries within a file should be in chronological order. This helps with readability and merge operations.",
    },
    {
      code: "create-requires-section",
      name: "Create Requires Section",
      description: "Create entry must use at least one section",
      severity: "error",
      explanation:
        "A `create` entry must have meaningful content with at least one markdown section. Empty entries don't capture knowledge.",
    },
    {
      code: "duplicate-timestamp",
      name: "Duplicate Timestamp Without Link ID",
      description: "Multiple entries with same timestamp need explicit ^link-id",
      severity: "error",
      explanation:
        "When multiple entries share the same timestamp, they need unique ^link-id values to be distinguishable during merge operations.",
      example: {
        bad: `2026-01-07T10:00Z create opinion "A"\n  ...\n\n2026-01-07T10:00Z create opinion "B"\n  ...`,
        good: `2026-01-07T10:00Z create opinion "A"\n    ^opinion-a\n  ...\n\n2026-01-07T10:00Z create opinion "B"\n    ^opinion-b\n  ...`,
      },
    },
    {
      code: "missing-title",
      name: "Missing Title",
      description: "Entry has empty or missing title",
      severity: "error",
      explanation:
        "Every entry should have a descriptive title in quotes. Titles make entries identifiable and searchable.",
    },
    {
      code: "synthesis-missing-sources",
      name: "Synthesis Missing Sources",
      description: "define-synthesis must have a sources field",
      severity: "error",
      explanation:
        "A synthesis definition needs a `sources:` field to specify which entries to query for the AI synthesis.",
      example: {
        good: `sources: opinion where #programming`,
      },
    },
    {
      code: "synthesis-missing-prompt",
      name: "Synthesis Missing Prompt",
      description: "define-synthesis should have a # Prompt section",
      severity: "warning",
      explanation:
        "A synthesis works best with a `# Prompt` section containing instructions for the LLM on how to synthesize the content.",
    },
    {
      code: "synthesis-empty-query",
      name: "Synthesis Empty Query",
      description: "A synthesis source query must specify an entity type",
      severity: "error",
      explanation:
        "The `sources:` field must contain a valid query with at least an entity type (like `opinion`, `journal`, etc.).",
    },
  ],
  link: [
    {
      code: "unresolved-link",
      name: "Unresolved Link",
      description: "Link reference (^id) has no definition",
      severity: "warning",
      explanation:
        "A `^link-id` reference points to an entry that doesn't exist. Check for typos or ensure the target entry is defined.",
      example: {
        bad: `related: ^nonexistent-entry`,
        good: `related: ^existing-entry  // where ^existing-entry is defined elsewhere`,
      },
    },
    {
      code: "duplicate-link-id",
      name: "Duplicate Link ID",
      description: "Same explicit ^link-id defined multiple times",
      severity: "error",
      explanation:
        "Each explicit ^link-id must be unique across your entire workspace. Duplicate IDs make references ambiguous.",
    },
    {
      code: "actualize-unresolved-target",
      name: "Actualize Unresolved Target",
      description: "actualize-synthesis must reference a defined synthesis",
      severity: "error",
      explanation:
        "An `actualize-synthesis ^target` entry must reference an existing `define-synthesis` entry with that link ID.",
    },
  ],
  schema: [
    {
      code: "duplicate-entity-definition",
      name: "Duplicate Entity Definition",
      description: "Multiple define-entity for the same entity name",
      severity: "error",
      explanation:
        "Each entity type can only be defined once. Use `alter-entity` to modify an existing entity definition.",
    },
    {
      code: "alter-undefined-entity",
      name: "Alter Undefined Entity",
      description: "alter-entity targets an undefined entity",
      severity: "error",
      explanation:
        "You can only alter an entity that has been defined first. Define the entity before altering it.",
    },
    {
      code: "alter-before-define",
      name: "Alter Before Define",
      description: "alter-entity timestamp before define-entity",
      severity: "error",
      explanation:
        "An `alter-entity` must have a timestamp after the original `define-entity`. Time flows forward in Thalo.",
    },
    {
      code: "duplicate-field-in-schema",
      name: "Duplicate Field in Schema",
      description: "Same field defined twice in a schema entry",
      severity: "error",
      explanation:
        "A schema entry cannot define the same field twice. Remove the duplicate or rename one of them.",
    },
    {
      code: "duplicate-section-in-schema",
      name: "Duplicate Section in Schema",
      description: "Same section defined twice in a schema entry",
      severity: "error",
      explanation:
        "A schema entry cannot define the same section twice. Remove the duplicate or rename one of them.",
    },
    {
      code: "remove-undefined-field",
      name: "Remove Undefined Field",
      description: "# Remove Metadata references nonexistent field",
      severity: "warning",
      explanation:
        "An `alter-entity` is trying to remove a field that doesn't exist in the current schema.",
    },
    {
      code: "remove-undefined-section",
      name: "Remove Undefined Section",
      description: "# Remove Sections references nonexistent section",
      severity: "warning",
      explanation:
        "An `alter-entity` is trying to remove a section that doesn't exist in the current schema.",
    },
    {
      code: "invalid-default-value",
      name: "Invalid Default Value",
      description: "Default value doesn't match field's declared type",
      severity: "error",
      explanation:
        "When defining a field with a default value, the default must match the field's type.",
      example: {
        bad: `status: "active" | "inactive" = "maybe"`,
        good: `status: "active" | "inactive" = "active"`,
      },
    },
    {
      code: "define-entity-requires-section",
      name: "Define Entity Requires Section",
      description: "Entity definition must have at least one section",
      severity: "error",
      explanation:
        "Every entity definition needs at least one section defined. Sections give structure to your entries.",
    },
  ],
  metadata: [
    {
      code: "duplicate-metadata-key",
      name: "Duplicate Metadata Key",
      description: "Same metadata key appears twice in an entry",
      severity: "error",
      explanation:
        "An entry cannot have the same metadata key defined twice. Use arrays if you need multiple values.",
    },
    {
      code: "empty-required-value",
      name: "Empty Required Value",
      description: "Required field has empty value",
      severity: "error",
      explanation:
        "A required field must have a non-empty value. Either provide a value or make the field optional in the schema.",
    },
    {
      code: "invalid-date-range-value",
      name: "Invalid Date Range Value",
      description: "Date range doesn't match DATE ~ DATE format",
      severity: "error",
      explanation:
        "Date ranges must follow the format `YYYY ~ YYYY`, `YYYY-MM ~ YYYY-MM`, or `YYYY-MM-DD ~ YYYY-MM-DD`.",
      example: {
        bad: `period: "2020 to 2024"`,
        good: `period: 2020 ~ 2024`,
      },
    },
    {
      code: "actualize-missing-updated",
      name: "Actualize Missing Updated",
      description: "actualize-synthesis must have an updated field",
      severity: "error",
      explanation:
        "An `actualize-synthesis` entry must include an `updated:` field with a timestamp to track when the synthesis was last run.",
    },
  ],
  content: [
    {
      code: "duplicate-section-heading",
      name: "Duplicate Section Heading",
      description: "Same # Section appears twice in entry content",
      severity: "error",
      explanation:
        "Each section heading must be unique within an entry. Rename one of the duplicate sections.",
    },
    {
      code: "empty-section",
      name: "Empty Section",
      description: "Section heading exists but has no content",
      severity: "warning",
      explanation:
        "A section heading without any content below it isn't useful. Either add content or remove the section.",
    },
  ],
};

// Component for a single rule card
function RuleCard({ rule }: { rule: RuleDefinition }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const severity = severityStyles[rule.severity];
  const SeverityIcon = severity.icon;

  return (
    <article
      className={cn(
        "group relative rounded-lg border bg-card transition-all duration-200",
        "hover:shadow-md hover:border-border/80",
        isExpanded && "ring-1 ring-primary/20",
      )}
    >
      {/* Card header - always visible */}
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-left p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Rule code as mono badge */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                {rule.code}
              </code>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border",
                  severity.bg,
                  severity.text,
                  severity.border,
                )}
              >
                <SeverityIcon className="size-3" />
                {rule.severity}
              </span>
            </div>
            {/* Rule name */}
            <h3 className="font-semibold text-foreground mb-1">{rule.name}</h3>
            {/* Short description */}
            <p className="text-sm text-muted-foreground">{rule.description}</p>
          </div>
          {/* Expand/collapse indicator */}
          <ChevronDown
            className={cn(
              "size-5 text-muted-foreground transition-transform duration-200 shrink-0 mt-1",
              isExpanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-border/50">
          <div className="pt-4 space-y-4">
            {/* Detailed explanation */}
            <p className="text-sm text-foreground/90 leading-relaxed">{rule.explanation}</p>

            {/* Code examples if present */}
            {rule.example && (
              <div className="space-y-3">
                {rule.example.bad && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="size-2 rounded-full bg-red-500/70" />
                      <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">
                        Incorrect
                      </span>
                    </div>
                    <pre className="text-xs font-mono bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/30 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                      {rule.example.bad}
                    </pre>
                  </div>
                )}
                {rule.example.good && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="size-2 rounded-full bg-emerald-500/70" />
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Correct
                      </span>
                    </div>
                    <pre className="text-xs font-mono bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/30 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                      {rule.example.good}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// Category section component
function CategorySection({ categoryId, rules }: { categoryId: string; rules: RuleDefinition[] }) {
  const meta = categoryMeta[categoryId];
  const CategoryIcon = meta.icon;

  return (
    <section className="relative">
      {/* Category header */}
      <div className="flex items-center gap-3 py-4 mb-6 border-b border-border/40">
        <div
          className={cn("flex items-center justify-center size-10 rounded-lg", meta.bg, meta.color)}
        >
          <CategoryIcon className="size-5" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">{meta.label}</h2>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <span className="ml-auto text-sm font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
          {rules.length} rule{rules.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Rules grid */}
      <div className="grid gap-3 sm:gap-4">
        {rules.map((rule) => (
          <RuleCard key={rule.code} rule={rule} />
        ))}
      </div>
    </section>
  );
}

export default function RulesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter rules based on search
  const filteredCategories = Object.entries(rulesByCategory)
    .map(([categoryId, rules]) => {
      const filteredRules = rules.filter(
        (rule) =>
          searchQuery === "" ||
          rule.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          rule.description.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return { categoryId, rules: filteredRules };
    })
    .filter(({ rules }) => rules.length > 0);

  const totalRules = Object.values(rulesByCategory).flat().length;
  const filteredTotal = filteredCategories.reduce((acc, { rules }) => acc + rules.length, 0);

  // Category order
  const categoryOrder = ["instance", "schema", "metadata", "content", "link"];
  filteredCategories.sort(
    (a, b) => categoryOrder.indexOf(a.categoryId) - categoryOrder.indexOf(b.categoryId),
  );

  return (
    <main className="relative min-h-screen">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-64 -top-64 size-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-64 -right-64 size-[600px] rounded-full bg-primary/5 blur-3xl" />
        {/* Index card lines pattern - subtle */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              to bottom,
              transparent,
              transparent 1.5rem,
              currentColor 1.5rem,
              currentColor calc(1.5rem + 1px)
            )`,
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        {/* Header */}
        <header className="mb-10 sm:mb-14">
          <div className="text-center mb-8">
            <span className="mb-4 inline-block font-mono text-sm tracking-wider text-primary">
              — REFERENCE
            </span>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
              Checker <span className="italic text-primary">Rules</span>
            </h1>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Thalo validates your files against {totalRules} rules to ensure consistency, catch
              errors early, and maintain a healthy knowledge base.
            </p>
          </div>

          {/* Search and stats bar */}
          <div className="flex flex-col gap-4 bg-card border rounded-xl p-4 sm:p-5">
            {/* Search input - full width */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-9 py-2.5 text-sm bg-muted/50 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all",
                  searchQuery ? "pr-9" : "pr-4",
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-500" />
                <span className="text-muted-foreground">
                  {
                    Object.values(rulesByCategory)
                      .flat()
                      .filter((r) => r.severity === "error").length
                  }{" "}
                  errors
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">
                  {
                    Object.values(rulesByCategory)
                      .flat()
                      .filter((r) => r.severity === "warning").length
                  }{" "}
                  warnings
                </span>
              </div>
            </div>
          </div>

          {/* Search results indicator */}
          {searchQuery && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Showing {filteredTotal} of {totalRules} rules
              {filteredTotal === 0 && (
                <span className="block mt-1">
                  Try a different search term or{" "}
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-primary hover:underline"
                  >
                    clear the search
                  </button>
                </span>
              )}
            </p>
          )}
        </header>

        {/* Rules by category */}
        <div className="space-y-12 sm:space-y-16">
          {filteredCategories.map(({ categoryId, rules }) => (
            <CategorySection key={categoryId} categoryId={categoryId} rules={rules} />
          ))}
        </div>

        {/* Footer CTA */}
        <footer className="mt-16 sm:mt-20 text-center border-t border-border/50 pt-12">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <BookOpen className="size-4" />
            Need more details?
          </div>
          <h2 className="text-xl font-semibold mb-2">Learn the Thalo syntax</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Understand the language fundamentals to write valid .thalo files from the start.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/docs"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
            >
              Read the Docs
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 font-semibold text-foreground transition-all hover:bg-muted"
            >
              Try the Demo
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
