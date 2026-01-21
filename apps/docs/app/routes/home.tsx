import { Link, useLoaderData } from "react-router";
import { GitHub } from "@/components/logos/github";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThaloCodeRenderer, type HighlightedLine } from "@/components/thalo-code";
import { getParser } from "@/lib/thalo-parser.server";
import { getParser as getClientParser } from "@/lib/thalo-parser.client";
import { highlightToTokens } from "@/lib/thalo-highlighter";
import { ArrowRight, Check, Link2, Sparkles, FileCode, Terminal, Wand2 } from "lucide-react";
import { WorkflowLoop } from "@/components/workflow-loop";
import { ToolingExplorer } from "@/components/tooling-explorer";

const DEMO_CODE = `2026-01-08T14:30Z create opinion "Plain text wins" ^plain-text #pkm
  confidence: "high"

  # Claim
  Your notes should be plain text.

  # Reasoning
  - Plain text is portable
  - AI works best with file systems
  - grep > proprietary search`;

/** Server loader - runs during SSR. */
export async function loader() {
  const parser = await getParser();
  const { lines } = highlightToTokens(parser, DEMO_CODE);
  return { highlightedLines: lines };
}

/** Client loader - runs during client-side navigation. */
export async function clientLoader() {
  const parser = await getClientParser();
  const { lines } = highlightToTokens(parser, DEMO_CODE);
  return { highlightedLines: lines };
}

export function meta() {
  return [
    { title: "Thalo: Thought And Lore Language" },
    {
      name: "description",
      content:
        "A structured plain-text language for capturing personal knowledge, thoughts, and references. AI-ready, version-controlled, human-readable.",
    },
  ];
}

function Hero({ highlightedLines }: { highlightedLines: HighlightedLine[] }) {
  return (
    <section className="relative w-full min-h-[90vh] flex items-center overflow-hidden">
      {/* Mobile: Tree as background with content overlapping */}
      <div className="absolute inset-0 lg:hidden">
        <img
          src="/hero-tree.webp"
          alt="Knowledge tree illustration"
          className="h-full w-full object-cover object-[60%_top] dark:brightness-[0.55] dark:contrast-[1.1] dark:saturate-[0.8]"
        />
        {/* Dark mode color wash overlay - warm amber tint */}
        <div className="pointer-events-none absolute inset-0 hidden dark:block bg-linear-to-br from-amber-950/40 via-transparent to-zinc-950/50" />
        {/* Gradient overlay for text readability - left side and bottom only */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#faf3e6_0%,#faf3e6_30%,transparent_60%),linear-gradient(to_bottom,transparent_0%,transparent_80%,#faf3e6_100%)] dark:bg-[linear-gradient(to_right,oklch(0.14_0.015_50)_0%,oklch(0.14_0.015_50/0.95)_25%,transparent_55%),linear-gradient(to_bottom,transparent_0%,transparent_70%,oklch(0.14_0.015_50)_100%)]" />
      </div>

      {/* Desktop: Tree image positioned to touch top and extend to right edge */}
      <div className="absolute -top-16 right-0 bottom-0 w-full hidden lg:block">
        <img
          src="/hero-tree.webp"
          alt="Knowledge tree illustration"
          className="h-full w-full object-contain object-top-right dark:brightness-[0.55] dark:contrast-[1.1] dark:saturate-[0.8]"
        />
        {/* Dark mode color wash overlay - warm amber tint for cohesive night feel */}
        <div className="pointer-events-none absolute inset-0 hidden dark:block bg-linear-to-br from-amber-950/30 via-zinc-900/20 to-zinc-950/40" />
        {/* Bottom gradient fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(to_bottom,transparent_0%,#faf3e6_85%,#faf3e6_100%)] dark:bg-[linear-gradient(to_bottom,transparent_0%,oklch(0.14_0.015_50)_85%,oklch(0.14_0.015_50)_100%)]" />
      </div>

      {/* Desktop: Wide vignette overlay - covers entire section for smooth left-to-right fade */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block bg-[linear-gradient(to_right,#faf3e6_0%,#faf3e6_25%,transparent_55%)] dark:bg-[linear-gradient(to_right,oklch(0.12_0.01_50)_0%,oklch(0.14_0.015_50)_20%,oklch(0.14_0.015_50)_30%,transparent_55%)]" />

      {/* Desktop dark mode: Subtle ambient glow on left side for visual interest */}
      <div className="pointer-events-none absolute inset-0 hidden dark:lg:block bg-[radial-gradient(ellipse_80%_100%_at_15%_50%,oklch(0.20_0.02_50/0.4)_0%,transparent_50%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-6 py-12 md:px-8 lg:px-12">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left column: Text content */}
          <div className="relative z-10 max-w-[280px] pt-8 sm:max-w-sm md:max-w-md md:pt-16 lg:max-w-xl lg:pt-20">
            {/* Title */}
            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
              <span className="text-primary">Thalo:</span>{" "}
              <span className="italic">Thought And Lore Language.</span>
            </h1>

            {/* Description */}
            <p className="mb-8 text-lg  leading-relaxed text-muted-foreground md:text-xl">
              A plain-text, structured format for capturing knowledge. Store quick notes, create
              usable data. Human-readable, versionable, and LLMs love to work with it.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-row gap-3 sm:gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
              >
                <Link to="/docs/getting-started">Get Started</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-full border-2 px-8 text-base font-semibold transition-all hover:bg-muted/50"
              >
                <Link to="/demo">View Demo</Link>
              </Button>
            </div>
          </div>

          {/* Right column: Code overlay - visible on lg and up */}
          <div className="relative hidden lg:flex lg:justify-end lg:items-end">
            {/* Code block overlay */}
            <div className="w-full max-w-lg lg:-mb-16 xl:max-w-5xl xl:-mb-32 2xl:translate-x-32">
              <div className="overflow-hidden rounded-xl border border-amber-900/20 bg-amber-50 shadow-2xl dark:border-zinc-700/50 dark:bg-zinc-900/95 dark:backdrop-blur-sm">
                {/* Terminal header */}
                <div className="flex items-center gap-2 border-b border-amber-900/10 bg-amber-100/50 px-4 py-2.5 dark:border-zinc-700/50 dark:bg-transparent">
                  <span className="size-3 rounded-full bg-red-400/80 dark:bg-red-500/80"></span>
                  <span className="size-3 rounded-full bg-yellow-400/80 dark:bg-yellow-500/80"></span>
                  <span className="size-3 rounded-full bg-green-400/80 dark:bg-green-500/80"></span>
                  <span className="ml-2 font-mono text-xs text-amber-800/60 dark:text-zinc-500">
                    entries.thalo
                  </span>
                </div>

                {/* Code content - Plain text wins snippet */}
                <ThaloCodeRenderer
                  lines={highlightedLines}
                  className="p-4 text-xs leading-relaxed md:text-sm [&_code]:text-amber-950 dark:[&_code]:text-zinc-100"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveDemo({ highlightedLines }: { highlightedLines: HighlightedLine[] }) {
  const benefits = [
    {
      icon: Check,
      title: "Schema Validation",
      description:
        "Your entries are type-checked. Missing a required field? You'll know instantly.",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      icon: Link2,
      title: "Cross-references",
      description: "Connect thoughts with ^links. Build a personal knowledge graph in plain text.",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: Sparkles,
      title: "Works with AI",
      description:
        "Answer questions with agentic search. Let the LLM create structure: scattered thoughts → coherent understanding.",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <section className="relative w-full overflow-hidden py-24 md:py-32">
      {/* Subtle diagonal line decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 top-0 h-px w-96 rotate-45 bg-linear-to-r from-transparent via-border to-transparent" />
        <div className="absolute -left-32 bottom-32 h-px w-96 rotate-45 bg-linear-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="mx-auto max-w-6xl px-6 md:px-8">
        {/* Section header */}
        <div className="mb-16 max-w-2xl">
          <span className="mb-4 inline-block font-mono text-sm tracking-wider text-primary">
            — HOW IT WORKS
          </span>
          <h2 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
            Write once, <span className="italic text-primary">understand forever</span>
          </h2>
        </div>

        <div className="grid items-start gap-12 lg:grid-cols-5 lg:gap-16">
          {/* Left: Code block - takes 3 columns */}
          <div className="lg:col-span-3">
            <div className="relative">
              {/* Decorative shadow layer */}
              <div className="absolute -inset-1 rounded-2xl bg-linear-to-br from-primary/20 via-transparent to-primary/10 blur-xl" />

              <Card className="relative overflow-hidden border-2 border-primary/20 bg-card shadow-2xl shadow-primary/5">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="size-3 rounded-full bg-red-400/80" />
                      <span className="size-3 rounded-full bg-yellow-400/80" />
                      <span className="size-3 rounded-full bg-green-400/80" />
                    </div>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      entries.thalo
                    </span>
                  </div>
                  <ThaloCodeRenderer
                    lines={highlightedLines}
                    className="p-5 text-sm leading-relaxed md:text-base"
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right: Benefits - takes 2 columns */}
          <div className="space-y-6 lg:col-span-2">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="group relative">
                <div className="flex gap-4">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${benefit.bg} transition-transform duration-300 group-hover:scale-110`}
                  >
                    <benefit.icon className={`size-5 ${benefit.color}`} />
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold tracking-tight">{benefit.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-4">
              <Link
                to="/playground"
                className="group inline-flex items-center gap-2 font-medium text-primary transition-colors hover:text-primary/80"
              >
                See it in action
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const problems = [
    {
      label: "Markdown",
      headline: "Too loose",
      body: "Great for docs, terrible for personal knowledge. No schema, no types, no validation. Just soup.",
    },
    {
      label: "Apps",
      headline: "Too rigid",
      body: "Lock-in, proprietary formats, features you don't need. Constrained to their AI.",
    },
    {
      label: "AI",
      headline: "Needs structure",
      body: "With structure and a checker, LLMs have a feedback loop to create valid entries.",
    },
  ];

  return (
    <section className="relative w-full overflow-hidden border-y border-border/50 bg-muted/20 py-24 md:py-32">
      {/* Subtle paper texture hint */}
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iLjAzIi8+PC9zdmc+')] opacity-50 dark:opacity-30" />

      <div className="relative mx-auto max-w-6xl px-6 md:px-8">
        <div className="mb-16 text-center">
          <span className="mb-4 inline-block font-mono text-sm tracking-wider text-primary">
            — THE PROBLEM
          </span>
          <h2 className="mx-auto max-w-3xl text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
            Your knowledge deserves <span className="italic">better infrastructure</span>
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3 md:gap-6 lg:gap-12">
          {problems.map((problem, idx) => (
            <div key={problem.label} className="relative">
              {/* Connecting line on larger screens */}
              {idx < problems.length - 1 && (
                <div className="absolute right-0 top-8 hidden h-px w-6 bg-border md:block lg:w-12" />
              )}

              <div className="space-y-3">
                <span className="inline-block rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium uppercase tracking-wider text-primary">
                  {problem.label}
                </span>
                <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {problem.headline}
                </h3>
                <p className="leading-relaxed text-muted-foreground">{problem.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Fake syntax-highlighted code for concepts - uses manual spans for highlighting */
function SyntaxCode({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto text-xs leading-relaxed">
      <code className="font-mono text-foreground/80">{children}</code>
    </pre>
  );
}

/** Color classes for syntax highlighting */
const syn = {
  timestamp: "text-blue-600 dark:text-blue-400",
  directive: "text-purple-600 dark:text-purple-400",
  entity: "text-amber-600 dark:text-amber-400",
  string: "text-emerald-600 dark:text-emerald-400",
  link: "text-cyan-600 dark:text-cyan-400",
  tag: "text-pink-600 dark:text-pink-400",
  section: "text-foreground font-semibold",
  key: "text-foreground/90",
  comment: "text-muted-foreground",
};

function ConceptCodeEntity() {
  return (
    <SyntaxCode>
      <span className={syn.timestamp}>2026-01-08T14:30Z</span>{" "}
      <span className={syn.directive}>define-entity</span>{" "}
      <span className={syn.entity}>opinion</span>{" "}
      <span className={syn.string}>"Formed stances"</span>
      {"\n"}
      {"  "}
      <span className={syn.section}># Metadata</span>
      {"\n"}
      {"  "}
      <span className={syn.key}>confidence:</span> <span className={syn.string}>"high"</span>
      {" | "}
      <span className={syn.string}>"medium"</span>
      {" | "}
      <span className={syn.string}>"low"</span>
      {"\n\n"}
      {"  "}
      <span className={syn.section}># Sections</span>
      {"\n"}
      {"  "}
      <span className={syn.key}>Claim</span>
      {" ; "}
      <span className={syn.string}>"Core opinion"</span>
      {"\n"}
      {"  "}
      <span className={syn.key}>Reasoning?</span>
      {" ; "}
      <span className={syn.string}>"Supporting points"</span>
    </SyntaxCode>
  );
}

function ConceptCodeEntry() {
  return (
    <SyntaxCode>
      <span className={syn.timestamp}>2026-01-08T14:30Z</span>{" "}
      <span className={syn.directive}>create</span> <span className={syn.entity}>opinion</span>{" "}
      <span className={syn.string}>"Tabs &gt; Spaces"</span>{" "}
      <span className={syn.link}>^tabs-vs-spaces</span>
      {"\n"}
      {"  "}
      <span className={syn.key}>confidence:</span> <span className={syn.string}>"high"</span>
      {"\n\n"}
      {"  "}
      <span className={syn.section}># Claim</span>
      {"\n"}
      {"  "}Tabs let everyone choose their width.
    </SyntaxCode>
  );
}

function ConceptCodeLinks() {
  return (
    <SyntaxCode>
      <span className={syn.comment}>// Reference other entries</span>
      {"\n"}
      <span className={syn.key}>related:</span> <span className={syn.link}>^clean-code</span>
      {", "}
      <span className={syn.link}>^pragmatic</span>
      {"\n"}
      <span className={syn.key}>subject:</span> <span className={syn.link}>^self</span>
      {"\n\n"}
      <span className={syn.comment}>// Tags for filtering</span>
      {"\n"}
      <span className={syn.tag}>#programming</span> <span className={syn.tag}>#architecture</span>
    </SyntaxCode>
  );
}

function ConceptCodeSynthesis() {
  return (
    <SyntaxCode>
      <span className={syn.timestamp}>2026-01-08T14:30Z</span>{" "}
      <span className={syn.directive}>define-synthesis</span>{" "}
      <span className={syn.string}>"My Philosophy"</span> <span className={syn.tag}>#coding</span>
      {"\n"}
      {"  "}
      <span className={syn.key}>sources:</span> <span className={syn.entity}>opinion</span>
      {" where "}
      <span className={syn.tag}>#coding</span>
      {"\n\n"}
      {"  "}
      <span className={syn.section}># Prompt</span>
      {"\n"}
      {"  "}Synthesize my opinions into a philosophy.
    </SyntaxCode>
  );
}

function Concepts() {
  const concepts = [
    {
      name: "Entities",
      number: "01",
      description:
        "Define what kinds of knowledge you track. Opinions, references, goals, git commits, anything.",
      codeComponent: ConceptCodeEntity,
      icon: FileCode,
      accent: "from-amber-500/20 to-orange-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      name: "Entries",
      number: "02",
      description: "Create instances of your entities. Timestamped, typed, validated. Plain text.",
      codeComponent: ConceptCodeEntry,
      icon: Terminal,
      accent: "from-blue-500/20 to-cyan-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      name: "Links",
      number: "03",
      description:
        "Connect your thoughts with ^references. Build an organized knowledge graph without leaving plain text.",
      codeComponent: ConceptCodeLinks,
      icon: Link2,
      accent: "from-emerald-500/20 to-teal-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      name: "Syntheses",
      number: "04",
      description:
        "Query your knowledge and prompt AI to synthesize. Scattered thoughts become coherent understanding.",
      codeComponent: ConceptCodeSynthesis,
      icon: Wand2,
      accent: "from-violet-500/20 to-purple-500/20",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <section className="relative w-full py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="mb-16">
          <span className="mb-4 inline-block font-mono text-sm tracking-wider text-primary">
            — CORE CONCEPTS
          </span>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-xl text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
              Four concepts, <span className="italic">infinite possibilities</span>
            </h2>
            <p className="max-w-sm text-muted-foreground">Learn these and you know Thalo.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {concepts.map((concept) => (
            <Card key={concept.name} className="relative h-full overflow-hidden border-2">
              <CardContent className="relative flex h-full flex-col p-0">
                <div className="flex-1 p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex size-10 items-center justify-center rounded-lg bg-muted ${concept.iconColor}`}
                      >
                        <concept.icon className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight">{concept.name}</h3>
                      </div>
                    </div>
                    <span className="font-mono text-2xl font-bold text-muted-foreground/30">
                      {concept.number}
                    </span>
                  </div>
                  <p className="leading-relaxed text-muted-foreground">{concept.description}</p>
                </div>

                <div className="border-t border-border/50 bg-muted/30 p-4">
                  <concept.codeComponent />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Philosophy() {
  const principles = [
    {
      headline: "Plain text is the universal interface",
      body: "Everything reads it. Everything writes it. Git diffs it. grep searches it. AI generates it.",
    },
    {
      headline: "Structure enables thinking",
      body: "When your thoughts have shape, you can see patterns, find contradictions, and build on what you know.",
    },
    {
      headline: "AI is your co-pilot, not your replacement",
      body: "You write in collaboration with AI. AI helps you synthesize, query, and discover. Your knowledge, augmented.",
    },
    {
      headline: "Your notes should outlive every app",
      body: "Thalo files are just text. No cloud required. No subscription. No vendor. Just you and your thoughts, forever.",
    },
  ];

  return (
    <section className="relative w-full py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Large typography */}
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-block font-mono text-sm tracking-wider text-primary">
              — PHILOSOPHY
            </span>
            <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Structure knowledge,{" "}
              <span className="relative">
                <span className="italic text-primary">collaborate with AI</span>
                <svg
                  className="absolute -bottom-1 left-0 h-2 w-full text-primary/30 overflow-visible"
                  viewBox="0 0 100 8"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 7 Q 25 0, 50 7 T 100 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </span>{" "}
            </h2>
          </div>

          {/* Right: Principles list */}
          <div className="space-y-8">
            {principles.map((principle) => (
              <div key={principle.headline} className="group relative pl-6">
                {/* Vertical accent line */}
                <div className="absolute left-0 top-0 h-full w-0.5 bg-border transition-colors duration-300 group-hover:bg-primary" />

                <h3 className="mb-2 text-lg font-semibold tracking-tight transition-colors group-hover:text-primary">
                  {principle.headline}
                </h3>
                <p className="leading-relaxed text-muted-foreground">{principle.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GetStarted() {
  return (
    <section className="relative w-full overflow-hidden border-t border-border/50 py-24 md:py-32">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-64 -top-64 size-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-64 -right-64 size-[500px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 md:px-8">
        <div className="mb-12 text-center">
          <span className="mb-4 inline-block font-mono text-sm tracking-wider text-primary">
            — GET STARTED
          </span>
          <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
            Start structuring your <span className="italic text-primary">knowledge</span>
          </h2>
        </div>

        <div className="mb-12">
          <Card className="relative overflow-hidden border-2 border-primary/20 bg-card shadow-2xl shadow-primary/5">
            {/* Gradient accent */}
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent" />

            <CardContent className="relative p-0">
              <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="size-3 rounded-full bg-red-400/80" />
                  <span className="size-3 rounded-full bg-yellow-400/80" />
                  <span className="size-3 rounded-full bg-green-400/80" />
                </div>
                <span className="ml-2 font-mono text-xs text-muted-foreground">terminal</span>
              </div>
              <pre className="overflow-x-auto p-6 text-sm md:text-base">
                <code className="font-mono leading-relaxed">
                  <span className="text-muted-foreground"># Install the CLI (or use npm/yarn)</span>
                  {"\n"}
                  <span className="text-primary">pnpm</span>
                  {" add -g @rejot-dev/thalo-cli"}
                  {"\n\n"}
                  <span className="text-muted-foreground"># Initialize your knowledge base</span>
                  {"\n"}
                  <span className="text-primary">thalo</span>
                  {" init\n\n"}
                  <span className="text-muted-foreground"># Validate your entries</span>
                  {"\n"}
                  <span className="text-primary">thalo</span>
                  {" check"}
                </code>
              </pre>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
          >
            <Link to="/docs" className="flex items-center gap-2">
              Read the Docs
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 rounded-full border-2 px-8 text-base font-semibold"
          >
            <a
              href="https://github.com/rejot-dev/thalo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <GitHub className="size-5" />
              Star on GitHub
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { highlightedLines } = useLoaderData<typeof loader>();

  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden">
      <Hero highlightedLines={highlightedLines} />
      <LiveDemo highlightedLines={highlightedLines} />
      <WorkflowLoop />
      <Problem />
      <Concepts />
      <ToolingExplorer />
      <Philosophy />
      <GetStarted />
    </main>
  );
}
