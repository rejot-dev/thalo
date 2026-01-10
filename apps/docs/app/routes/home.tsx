import { Link } from "react-router";
import { GitHub } from "@/components/logos/github";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function meta() {
  return [
    { title: "Thalo: Personal Thought And Lore Language" },
    {
      name: "description",
      content:
        "A structured plain-text language for capturing personal knowledge, thoughts, and references. AI-ready, version-controlled, human-readable.",
    },
  ];
}

function Hero() {
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
        <div className="pointer-events-none absolute inset-0 hidden dark:block bg-gradient-to-br from-amber-950/40 via-transparent to-zinc-950/50" />
        {/* Gradient overlay for text readability - left side and bottom only */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#faf3e6_0%,#faf3e6_30%,transparent_60%),linear-gradient(to_bottom,transparent_0%,transparent_80%,#faf3e6_100%)] dark:bg-[linear-gradient(to_right,oklch(0.14_0.015_50)_0%,oklch(0.14_0.015_50/0.95)_25%,transparent_55%),linear-gradient(to_bottom,transparent_0%,transparent_70%,oklch(0.14_0.015_50)_100%)]" />
      </div>

      {/* Desktop: Tree image positioned to touch top and extend to right edge */}
      <div className="absolute -top-16 right-0 bottom-0 w-full hidden lg:block">
        <img
          src="/hero-tree.webp"
          alt="Knowledge tree illustration"
          className="h-full w-full object-contain object-right-top dark:brightness-[0.55] dark:contrast-[1.1] dark:saturate-[0.8]"
        />
        {/* Dark mode color wash overlay - warm amber tint for cohesive night feel */}
        <div className="pointer-events-none absolute inset-0 hidden dark:block bg-gradient-to-br from-amber-950/30 via-zinc-900/20 to-zinc-950/40" />
        {/* Bottom gradient fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(to_bottom,transparent_0%,#faf3e6_85%,#faf3e6_100%)] dark:bg-[linear-gradient(to_bottom,transparent_0%,oklch(0.14_0.015_50)_85%,oklch(0.14_0.015_50)_100%)]" />
      </div>

      {/* Desktop: Wide vignette overlay - covers entire section for smooth left-to-right fade */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block bg-[linear-gradient(to_right,#faf3e6_0%,#faf3e6_25%,transparent_55%)] dark:bg-[linear-gradient(to_right,oklch(0.14_0.015_50)_0%,oklch(0.14_0.015_50)_25%,transparent_55%)]" />

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
              A plain-text, structured format for capturing personal knowledge—simple enough for
              quick notes, consistent enough for durable data. Human-readable, versionable, and
              tool-friendly.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-row gap-3 sm:gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
              >
                <Link to="/docs">Get Started</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-full border-2 px-8 text-base font-semibold transition-all hover:bg-muted/50"
              >
                <Link to="/docs">Read the Docs</Link>
              </Button>
            </div>
          </div>

          {/* Right column: Code overlay - visible on lg and up */}
          <div className="relative hidden lg:flex lg:justify-end lg:items-end">
            {/* Code block overlay */}
            <div className="w-full max-w-md lg:-mb-16 xl:max-w-lg xl:-mb-32">
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
                <pre className="overflow-x-auto p-4 text-xs leading-relaxed md:text-sm">
                  <code className="font-mono text-amber-950 dark:text-zinc-100">
                    <span className="text-amber-600/70 dark:text-zinc-500">2026-01-08T14:30Z</span>{" "}
                    <span className="text-amber-700 font-semibold dark:text-amber-400">
                      create opinion
                    </span>{" "}
                    <span className="text-orange-700 dark:text-orange-300">"Plain text wins"</span>{" "}
                    <span className="text-sky-700 dark:text-sky-400">^plain-text</span>{" "}
                    <span className="text-emerald-700 dark:text-emerald-400">#pkm</span>
                    {"\n"}
                    {"  "}
                    <span className="text-sky-700 dark:text-sky-400">confidence</span>:{" "}
                    <span className="text-orange-700 dark:text-orange-300">"high"</span>
                    {"\n\n"}
                    {"  "}
                    <span className="text-amber-700 dark:text-amber-400"># Claim</span>
                    {"\n"}
                    {"  "}
                    <span className="text-amber-900 dark:text-zinc-300">
                      Your notes should outlive every app.
                    </span>
                    {"\n\n"}
                    {"  "}
                    <span className="text-amber-700 dark:text-amber-400"># Reasoning</span>
                    {"\n"}
                    {"  "}
                    <span className="text-amber-900 dark:text-zinc-300">
                      - Apps die. Plain text is forever.
                    </span>
                    {"\n"}
                    {"  "}
                    <span className="text-amber-900 dark:text-zinc-300">
                      - grep {">"} proprietary search
                    </span>
                    {"\n"}
                    {"  "}
                    <span className="text-amber-900 dark:text-zinc-300">
                      - AI speaks text natively
                    </span>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveDemo() {
  return (
    <section className="relative w-full py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left: The Thalo entry */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                1
              </span>
              Write structured entries
            </div>
            <Card className="border-2 border-primary/20 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2 text-xs text-muted-foreground">
                  <span className="size-3 rounded-full bg-red-400/80"></span>
                  <span className="size-3 rounded-full bg-yellow-400/80"></span>
                  <span className="size-3 rounded-full bg-green-400/80"></span>
                  <span className="ml-2 font-mono">entries.thalo</span>
                </div>
                <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
                  <code className="text-foreground/90 font-mono">
                    <span className="text-muted-foreground">2026-01-08T14:30Z</span>{" "}
                    <span className="text-primary font-semibold">create opinion</span>{" "}
                    <span className="text-foreground">"Plain text wins"</span>{" "}
                    <span className="text-blue-600 dark:text-blue-400">^plain-text</span>{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">#pkm</span>
                    {`
  confidence: "high"

  `}
                    <span className="text-primary"># Claim</span>
                    {`
  Your notes should outlive every app.

  `}
                    <span className="text-primary"># Reasoning</span>
                    {`
  - Apps die. Plain text is forever.
  - grep > proprietary search
  - AI speaks text natively`}
                  </code>
                </pre>
              </CardContent>
            </Card>
          </div>

          {/* Right: What you get */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                2
              </span>
              Get structure + tooling
            </div>
            <div className="grid gap-4">
              <Card className="border bg-card/60 backdrop-blur-sm">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-xl">
                    ✓
                  </div>
                  <div>
                    <div className="font-semibold">Validation</div>
                    <div className="text-sm text-muted-foreground">
                      Schema checks your entries. Missing a required field? You'll know.
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border bg-card/60 backdrop-blur-sm">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xl">
                    🔗
                  </div>
                  <div>
                    <div className="font-semibold">Cross-references</div>
                    <div className="text-sm text-muted-foreground">
                      <code className="rounded bg-muted px-1 text-xs">^plain-text</code> links to
                      other entries. Build a knowledge graph.
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border bg-card/60 backdrop-blur-sm">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-xl">
                    🤖
                  </div>
                  <div>
                    <div className="font-semibold">AI-ready</div>
                    <div className="text-sm text-muted-foreground">
                      Structure gives AI context. Define syntheses to query + summarize.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="relative w-full border-y bg-muted/30 py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
        <h2 className="mb-6 text-3xl font-bold md:text-4xl">The Problem</h2>
        <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Markdown is too loose.</strong> Great for docs,
            terrible for personal knowledge. No schema, no types, no validation. Just soup.
          </p>
          <p>
            <strong className="text-foreground">Apps are too rigid.</strong> Lock-in, proprietary
            formats, features you don't need. When they shut down, your notes are orphaned.
          </p>
          <p>
            <strong className="text-foreground">AI needs structure.</strong> Feed an LLM a folder of
            markdown and watch it hallucinate. Feed it typed, linked entries and watch it reason.
          </p>
        </div>
      </div>
    </section>
  );
}

function Concepts() {
  const concepts = [
    {
      name: "Entities",
      description:
        "Define what kinds of knowledge you track. Opinions, journals, references, lore—whatever fits your brain.",
      example: `define-entity opinion
  confidence: "high" | "medium" | "low"
  
  # Claim
  # Reasoning`,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      name: "Entries",
      description:
        "Create instances of your entities. Timestamped, typed, validated. Plain text that actually means something.",
      example: `create opinion "Tabs > Spaces"
  confidence: "high"
  
  # Claim
  Tabs let everyone choose.`,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      name: "Links",
      description:
        "Connect your thoughts with ^references. Build a personal knowledge graph without leaving plain text.",
      example: `related: ^clean-code, ^pragmatic
subject: ^self`,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      name: "Syntheses",
      description:
        "Query your knowledge and prompt AI to synthesize. Scattered thoughts become coherent understanding.",
      example: `define-synthesis "My Philosophy"
  sources: opinion where #coding
  
  # Prompt
  Synthesize my opinions.`,
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <section className="relative w-full py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Four Simple Concepts</h2>
          <p className="text-muted-foreground text-lg">
            That's it. Learn these and you know Thalo.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {concepts.map((concept) => (
            <Card
              key={concept.name}
              className="overflow-hidden border-2 transition-all hover:border-primary/30"
            >
              <CardContent className="p-0">
                <div className="p-6">
                  <div
                    className={`mb-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${concept.color}`}
                  >
                    {concept.name}
                  </div>
                  <p className="text-muted-foreground">{concept.description}</p>
                </div>
                <div className="border-t bg-muted/30 p-4">
                  <pre className="overflow-x-auto text-xs leading-relaxed">
                    <code className="font-mono text-foreground/80">{concept.example}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Tooling() {
  const tools = [
    {
      name: "CLI",
      status: "Alpha",
      description: "Initialize, validate, actualize syntheses",
      icon: "⌨️",
    },
    {
      name: "LSP",
      status: "Alpha",
      description: "Autocomplete, diagnostics, go-to-definition",
      icon: "🔧",
    },
    {
      name: "VSCode",
      status: "Alpha",
      description: "Syntax highlighting + LSP integration",
      icon: "📝",
    },
    {
      name: "Prettier",
      status: "Alpha",
      description: "Auto-format your .thalo files",
      icon: "✨",
    },
    {
      name: "Tree-sitter",
      status: "Alpha",
      description: "Full parser for building more tools",
      icon: "🌲",
    },
  ];

  return (
    <section className="relative w-full border-t bg-muted/30 py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Real Tooling, Day One</h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            A language is only as good as its tooling. Thalo ships with everything you need.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {tools.map((tool) => (
            <Card key={tool.name} className="text-center">
              <CardContent className="p-5">
                <div className="mb-3 text-3xl">{tool.icon}</div>
                <div className="mb-1 font-semibold">{tool.name}</div>
                <div className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {tool.status}
                </div>
                <div className="text-xs text-muted-foreground">{tool.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Philosophy() {
  return (
    <section className="relative w-full py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4 md:px-8">
        <Card className="overflow-hidden border-2 border-primary/20">
          <CardContent className="p-8 md:p-12">
            <h2 className="mb-6 text-3xl font-bold md:text-4xl">The Philosophy</h2>
            <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">Plain text is the universal interface.</strong>{" "}
                Everything reads it. Everything writes it. Git diffs it. grep searches it. AI
                generates it.
              </p>
              <p>
                <strong className="text-foreground">Structure enables thinking.</strong> When your
                thoughts have shape, you can see patterns, find contradictions, and build on what
                you know.
              </p>
              <p>
                <strong className="text-foreground">
                  AI is your co-pilot, not your replacement.
                </strong>{" "}
                You write the entries. AI helps you synthesize, query, and discover. Your knowledge,
                augmented.
              </p>
              <p>
                <strong className="text-foreground">Your notes should outlive every app.</strong>{" "}
                Thalo files are just text. No cloud required. No subscription. No vendor. Just you
                and your thoughts, forever.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function GetStarted() {
  return (
    <section className="relative w-full border-t py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
        <h2 className="mb-4 text-3xl font-bold md:text-4xl">Start in 30 Seconds</h2>
        <p className="text-muted-foreground mb-8 text-lg">
          Install the CLI, init a knowledge base, start writing.
        </p>

        <Card className="mb-8 border-2 bg-card/80 text-left backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2 text-xs text-muted-foreground">
              <span className="size-3 rounded-full bg-red-400/80"></span>
              <span className="size-3 rounded-full bg-yellow-400/80"></span>
              <span className="size-3 rounded-full bg-green-400/80"></span>
              <span className="ml-2 font-mono">terminal</span>
            </div>
            <pre className="overflow-x-auto p-4 text-sm">
              <code className="font-mono">
                <span className="text-muted-foreground"># Install</span>
                {`
pnpm add -g @rejot-dev/thalo-cli

`}
                <span className="text-muted-foreground"># Initialize</span>
                {`
thalo init

`}
                <span className="text-muted-foreground"># Validate</span>
                {`
thalo check`}
              </code>
            </pre>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-8 text-base">
            <Link to="/docs">Read the Docs</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
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
  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden">
      <Hero />
      <LiveDemo />
      <Problem />
      <Concepts />
      <Tooling />
      <Philosophy />
      <GetStarted />
    </main>
  );
}
