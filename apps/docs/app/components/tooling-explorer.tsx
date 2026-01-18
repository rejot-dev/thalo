import { useState } from "react";
import {
  Check,
  Search,
  Sparkles,
  FolderOpen,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Code,
} from "lucide-react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

interface Capability {
  id: string;
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  features: string[];
  visual: "feedback" | "navigation" | "tidy" | "anywhere" | "scripting";
}

const capabilities: Capability[] = [
  {
    id: "feedback",
    name: "Instant Feedback",
    tagline: "Catches mistakes as you type",
    icon: Check,
    description:
      "Spell-check for your knowledge. Thalo validates your notes against the structure you defined, highlighting problems the moment they appear.",
    features: [
      "Missing required fields — forgot to add a confidence level?",
      "Missing sections — your entity requires a # Claim section",
      "Broken links — referenced a note that doesn't exist?",
      "Invalid values — used a value that's not allowed?",
    ],
    visual: "feedback",
  },
  {
    id: "navigation",
    name: "Smart Navigation",
    tagline: "Jump to any note instantly",
    icon: Search,
    description:
      "Your notes form a web of connections. Smart navigation lets you traverse that web effortlessly: jump to linked notes, find everything that references a topic, or search across your entire knowledge base.",
    features: [
      "Go to definition — click a ^link to jump to that note",
      "Find all references — see every note that links here",
      "Search by type — show me all my opinions",
      "Filter by tag — everything marked #coding",
    ],
    visual: "navigation",
  },
  {
    id: "tidy",
    name: "Auto-Tidy",
    tagline: "Clean formatting, always",
    icon: Sparkles,
    description:
      "Never waste time aligning text or fixing spacing. One command formats all your notes consistently, so you can focus on thinking instead of tidying.",
    features: [
      "Consistent spacing between entries",
      "Aligned metadata fields",
      "Proper indentation in sections",
      "Works on one file or your entire knowledge base",
    ],
    visual: "tidy",
  },
  {
    id: "anywhere",
    name: "Works Anywhere",
    tagline: "Use any modern editor",
    icon: FolderOpen,
    description:
      "Thalo integrates with your editor through the Language Server Protocol (LSP). Real-time feedback, navigation, and diagnostics work out of the box.",
    features: [
      "LSP support — real-time feedback in any compatible editor",
      "Modern editors — VS Code, Cursor, IntelliJ, Zed, Vim, Emacs",
      "Version control — track changes with Git, sync with Dropbox or any other file-based sync service",
    ],
    visual: "anywhere",
  },
  {
    id: "scripting",
    name: "Scripting API",
    tagline: "Automate your knowledge",
    icon: Code,
    description:
      "Write scripts that interact with your knowledge base. Iterate over entries, run queries, find connections, and create custom validation rules — all with a clean TypeScript API.",
    features: [
      "Load and iterate — loop over all entries or filter by file",
      "Query entries — use the familiar `entity where #tag` syntax",
      "Navigate links — find definitions and all references",
      "Custom visitors — write your own validation rules",
    ],
    visual: "scripting",
  },
];

/** Mini-editor mockup showing instant feedback */
function FeedbackVisual() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border-2 border-red-500/30 bg-zinc-900 font-mono text-xs shadow-xl shadow-red-500/5">
      {/* Editor header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/80" />
          <span className="size-2.5 rounded-full bg-yellow-500/80" />
          <span className="size-2.5 rounded-full bg-green-500/80" />
        </div>
        <span className="text-[10px] text-zinc-500">entries.thalo</span>
      </div>

      {/* Editor content */}
      <div className="p-3 text-zinc-300">
        <div className="mb-0.5">
          <span className="text-blue-400">2026-01-08T14:30Z</span>{" "}
          <span className="text-purple-400">create</span>{" "}
          <span className="text-amber-400">opinion</span>{" "}
          <span className="text-emerald-400">"Plain text wins"</span>
        </div>
        <div className="relative mb-0.5 pl-4">
          <span className="text-zinc-400">confidence:</span>{" "}
          <span className="relative">
            <span className="text-emerald-400">"very high"</span>
            {/* Squiggly underline - red for error */}
            <svg
              className="absolute -bottom-0.5 left-0 h-1 w-full text-red-500"
              viewBox="0 0 100 6"
              preserveAspectRatio="none"
            >
              <path
                d="M0 3 Q 5 0, 10 3 T 20 3 T 30 3 T 40 3 T 50 3 T 60 3 T 70 3 T 80 3 T 90 3 T 100 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </span>
        </div>
        {/* Error tooltip */}
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px]">
          <AlertCircle className="mt-0.5 size-3 shrink-0 text-red-400" />
          <div>
            <p className="font-medium text-red-300">Invalid value for "confidence"</p>
            <p className="text-red-400/80">Expected "high" | "medium" | "low"</p>
          </div>
        </div>

        {/* Warning tooltip */}
        <div className="mt-2 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-[10px]">
          <AlertTriangle className="mt-0.5 size-3 shrink-0 text-yellow-400" />
          <div>
            <p className="font-medium text-yellow-300">Missing optional section</p>
            <p className="text-yellow-400/80">Entity "opinion" has section "# Reasoning"</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Search palette mockup showing smart navigation */
function NavigationVisual() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-900 font-mono text-sm shadow-xl">
      {/* Search input */}
      <div className="border-b border-zinc-800 bg-zinc-900/80 p-3">
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-zinc-800 px-3 py-2">
          <Search className="size-4 text-primary" />
          <span className="text-zinc-300">opinion where #coding</span>
          <span className="ml-auto rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
            ↵
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="p-2">
        <p className="mb-2 px-2 text-[10px] uppercase tracking-wider text-zinc-500">
          3 entries found
        </p>

        {[
          { title: "Tabs > Spaces", link: "^tabs-vs-spaces", date: "Jan 8" },
          { title: "Plain text wins", link: "^plain-text", date: "Jan 7" },
          { title: "AI is a tool", link: "^ai-tool", date: "Jan 5" },
        ].map((result, i) => (
          <div
            key={result.link}
            className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors ${i === 0 ? "bg-primary/10" : "hover:bg-zinc-800"}`}
          >
            <div
              className={`flex size-6 items-center justify-center rounded ${i === 0 ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500"}`}
            >
              <span className="text-[10px] font-bold">O</span>
            </div>
            <div className="flex-1">
              <p className={`text-xs ${i === 0 ? "text-zinc-100" : "text-zinc-300"}`}>
                {result.title}
              </p>
              <p className="text-[10px] text-zinc-500">{result.link}</p>
            </div>
            <span className="text-[10px] text-zinc-600">{result.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Before/after formatting visual */
function TidyVisual() {
  return (
    <div className="flex h-full w-full gap-2">
      {/* Before */}
      <div className="flex-1 overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-900 font-mono text-[10px] shadow-xl">
        <div className="border-b border-zinc-800 bg-red-500/10 px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-red-400">
            Before
          </span>
        </div>
        <div className="p-2.5 leading-relaxed text-zinc-400">
          <div>
            <span className="text-blue-400">2026-01-08T14:30Z</span>
          </div>
          <div className="pl-1">
            <span className="text-purple-400">create</span>{" "}
            <span className="text-amber-400">opinion</span>
          </div>
          <div className="pl-2">
            <span className="text-emerald-400">"Plain text"</span>{" "}
            <span className="text-cyan-400">^plain</span>
          </div>
          <div className="pl-1">confidence: "high"</div>
          <div className="pl-3"># Claim</div>
          <div className="pl-1">Your notes should be plain.</div>
          <div className="mt-1 pl-4"># Reasoning</div>
          <div className="pl-2">- Portable</div>
          <div className="pl-5">- AI friendly</div>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center">
        <ArrowRight className="size-5 text-primary" />
      </div>

      {/* After */}
      <div className="flex-1 overflow-hidden rounded-lg border border-primary/30 bg-zinc-900 font-mono text-[10px] shadow-xl shadow-primary/5">
        <div className="border-b border-zinc-800 bg-emerald-500/10 px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400">
            After
          </span>
        </div>
        <div className="p-2.5 leading-relaxed text-zinc-300">
          <div>
            <span className="text-blue-400">2026-01-08T14:30Z</span>{" "}
            <span className="text-purple-400">create</span>{" "}
            <span className="text-amber-400">opinion</span>{" "}
            <span className="text-emerald-400">"Plain text"</span>{" "}
            <span className="text-cyan-400">^plain</span>
          </div>
          <div className="pl-4">
            <span className="text-zinc-400">confidence:</span>{" "}
            <span className="text-emerald-400">"high"</span>
          </div>
          <div className="mt-1.5 pl-4 font-semibold text-zinc-200"># Claim</div>
          <div className="pl-4">Your notes should be plain.</div>
          <div className="mt-1.5 pl-4 font-semibold text-zinc-200"># Reasoning</div>
          <div className="pl-4">- Portable</div>
          <div className="pl-4">- AI friendly</div>
        </div>
      </div>
    </div>
  );
}

/** Platform/editor icons showing universal compatibility */
function AnywhereVisual() {
  const editors = [
    { name: "VS Code", color: "text-blue-400" },
    { name: "Cursor", color: "text-purple-400" },
    { name: "IntelliJ", color: "text-orange-400" },
    { name: "Zed", color: "text-emerald-400" },
    { name: "Vim", color: "text-lime-400" },
    { name: "Emacs", color: "text-violet-400" },
  ];

  const sync = [
    { name: "Git", color: "text-orange-500" },
    { name: "Dropbox", color: "text-blue-500" },
  ];

  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-900 p-5">
      {/* Side-by-side layout */}
      <div className="flex gap-8">
        {/* Modern Editors */}
        <div>
          <div className="mb-3 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Modern Editors
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {editors.map((editor) => (
              <div
                key={editor.name}
                className="flex h-16 w-20 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-800/50 transition-colors hover:border-primary/30"
              >
                <span className={`text-xl font-bold ${editor.color}`}>{editor.name[0]}</span>
                <span className="mt-0.5 text-[8px] text-zinc-500">{editor.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sync & Version */}
        <div>
          <div className="mb-3 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Sync & Version
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {sync.map((service) => (
              <div
                key={service.name}
                className="flex h-16 w-20 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-800/50 transition-colors hover:border-primary/30"
              >
                <span className={`text-xl font-bold ${service.color}`}>{service.name[0]}</span>
                <span className="mt-0.5 text-[8px] text-zinc-500">{service.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LSP badge at bottom */}
      <div className="mt-5 flex justify-center">
        <div className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
          <span className="font-mono text-[11px] font-medium text-primary">Powered by LSP</span>
        </div>
      </div>
    </div>
  );
}

/** Code snippet mockup showing scripting API */
function ScriptingVisual() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-cyan-500/30 bg-zinc-900 font-mono text-xs shadow-xl shadow-cyan-500/5">
      {/* Editor header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/80" />
          <span className="size-2.5 rounded-full bg-yellow-500/80" />
          <span className="size-2.5 rounded-full bg-green-500/80" />
        </div>
        <span className="text-[10px] text-zinc-500">analyze.ts</span>
      </div>

      {/* Code content */}
      <div className="p-3 leading-relaxed text-zinc-300">
        <div className="text-zinc-500">
          <span className="text-purple-400">import</span> {"{"} loadThalo {"}"}{" "}
          <span className="text-purple-400">from</span>{" "}
          <span className="text-emerald-400">"@rejot-dev/thalo/api"</span>;
        </div>
        <div className="mt-2" />
        <div>
          <span className="text-purple-400">const</span>{" "}
          <span className="text-cyan-400">workspace</span> ={" "}
          <span className="text-purple-400">await</span>{" "}
          <span className="text-amber-400">loadThalo</span>(
          <span className="text-emerald-400">"."</span>);
        </div>
        <div className="mt-2" />
        <div className="text-zinc-500">// Query your knowledge base</div>
        <div>
          <span className="text-purple-400">const</span>{" "}
          <span className="text-cyan-400">opinions</span> = workspace.
          <span className="text-amber-400">query</span>(
        </div>
        <div className="pl-4">
          <span className="text-emerald-400">"opinion where #coding"</span>
        </div>
        <div>);</div>
        <div className="mt-2" />
        <div className="text-zinc-500">// Find all link references</div>
        <div>
          <span className="text-purple-400">const</span> <span className="text-cyan-400">refs</span>{" "}
          = workspace.
          <span className="text-amber-400">findReferences</span>(
          <span className="text-emerald-400">"^my-note"</span>);
        </div>
        <div className="mt-2" />
        <div className="text-zinc-500">// Custom visitor</div>
        <div>
          workspace.<span className="text-amber-400">visit</span>({"{"}{" "}
          <span className="text-cyan-400">visitInstanceEntry</span>
          (e) {"=>"} {"{"} ... {"}"} {"}"});
        </div>
      </div>
    </div>
  );
}

function VisualDemo({ type }: { type: Capability["visual"] }) {
  switch (type) {
    case "feedback":
      return <FeedbackVisual />;
    case "navigation":
      return <NavigationVisual />;
    case "tidy":
      return <TidyVisual />;
    case "anywhere":
      return <AnywhereVisual />;
    case "scripting":
      return <ScriptingVisual />;
  }
}

export function ToolingExplorer() {
  const [activeId, setActiveId] = useState(capabilities[0]!.id);
  const active = capabilities.find((c) => c.id === activeId)!;

  return (
    <section className="relative w-full overflow-hidden py-24 md:py-32">
      {/* Background texture */}
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iLjAzIi8+PC9zdmc+')] opacity-50 dark:opacity-30" />

      {/* Gradient orbs */}
      <div className="pointer-events-none absolute left-0 top-1/3 size-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 size-[500px] translate-x-1/3 rounded-full bg-amber-500/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 md:px-8">
        {/* Section header */}
        <div className="mb-12 md:mb-16">
          <span className="mb-4 inline-block font-mono text-sm tracking-wider text-primary">
            — TOOLING
          </span>
          <h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
            Helpful from <span className="italic text-primary">the start</span>
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Thalo guides you as you write by catching mistakes, suggesting connections, and keeping
            everything organized.
          </p>
        </div>

        {/* Capability tabs - carousel for drag & swipe */}
        <div className="relative mb-6">
          <Carousel
            opts={{
              align: "start",
              dragFree: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-3">
              {capabilities.map((capability) => {
                const Icon = capability.icon;
                const isActive = capability.id === activeId;

                return (
                  <CarouselItem key={capability.id} className="basis-auto pl-3">
                    <button
                      onClick={() => setActiveId(capability.id)}
                      className={`
                        group relative flex items-center gap-3 rounded-xl border-2 px-5 py-4 text-left transition-all duration-300
                        ${
                          isActive
                            ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                            : "border-border bg-card hover:border-primary/30 hover:shadow-md"
                        }
                      `}
                    >
                      <div
                        className={`
                          flex size-10 items-center justify-center rounded-lg transition-colors
                          ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:text-primary"}
                        `}
                      >
                        <Icon className="size-5" />
                      </div>

                      <div>
                        <p
                          className={`font-semibold tracking-tight ${isActive ? "text-foreground" : "text-foreground/80"}`}
                        >
                          {capability.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{capability.tagline}</p>
                      </div>
                    </button>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
        </div>

        {/* Detail panel */}
        <div className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-card shadow-2xl shadow-primary/5">
          {/* Panel header bar */}
          <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-3">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-red-400/80" />
              <span className="size-2.5 rounded-full bg-yellow-400/80" />
              <span className="size-2.5 rounded-full bg-green-400/80" />
            </div>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              capability.explorer
            </span>
          </div>

          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-2 lg:gap-12">
            {/* Left: Description */}
            <div>
              <div className="mb-6 flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <active.icon className="size-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">{active.name}</h3>
                  <p className="text-sm text-muted-foreground">{active.tagline}</p>
                </div>
              </div>

              <p className="mb-6 leading-relaxed text-muted-foreground">{active.description}</p>

              <div className="space-y-3">
                <p className="font-mono text-xs uppercase tracking-wider text-primary">
                  What it does
                </p>
                {active.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <p className="text-sm leading-relaxed text-foreground/80">{feature}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Visual demo */}
            <div className="flex min-h-[280px] items-center justify-center lg:min-h-[320px]">
              <VisualDemo type={active.visual} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
