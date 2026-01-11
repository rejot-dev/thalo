import {
  FileCode,
  Terminal,
  Wand2,
  Sparkles,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  PlaygroundProvider,
  type PlaygroundStep,
} from "@/components/playground/playground-context";
import { PlaygroundPanel, PanelCode, syn } from "@/components/playground/playground-panel";
import { PlaygroundTimeline } from "@/components/playground/playground-timeline";
import { usePlayground } from "@/components/playground/playground-context";
import { Link } from "react-router";
import { cn } from "@/lib/cn";

export function meta() {
  return [
    { title: "Playground - Thalo" },
    {
      name: "description",
      content:
        "Interactive walkthrough of how Thalo works: define entities, create entries, synthesize knowledge.",
    },
  ];
}

// Step definitions - 2 panels visible at a time for better readability
const STEPS: PlaygroundStep[] = [
  {
    id: "define-entity",
    label: "Define",
    description: "First, define what kinds of knowledge you'll track",
    details:
      "Entities are templates for your thoughts. Define the structure once: metadata fields and content sections, then use it to capture many entries of that type.",
    focusedPanels: [0, 1],
    activePanel: 0,
  },
  {
    id: "first-entry",
    label: "Entry #1",
    description: "Create your first typed entry with metadata and content",
    details:
      "Each entry is timestamped and typed. Fill in the metadata (like confidence level) and write your content in the defined sections. The structure keeps your thinking organized.",
    focusedPanels: [0, 1],
    activePanel: 1,
    panelOverrides: {
      1: { badge: "new" },
    },
  },
  {
    id: "second-entry",
    label: "Entry #2",
    description: "Add more entries over time - build your knowledge base",
    details:
      "As you learn and think, add more entries. They can be different entity types — opinions, references, experiences. Your personal knowledge base grows organically over time.",
    focusedPanels: [1, 2],
    activePanel: 1,
  },
  {
    id: "define-synthesis",
    label: "Synthesis",
    description: "Query your entries and define a prompt for AI synthesis",
    details:
      "A synthesis defines what to generate. Use queries to select which entries to include, then write a prompt that tells the AI how to combine them into something useful.",
    focusedPanels: [1, 2],
    activePanel: 2,
    panelOverrides: {
      2: { badge: "new" },
    },
  },
  {
    id: "run-actualize",
    label: "Actualize",
    description: "The CLI gathers matching entries and prepares the prompt",
    details:
      "Running 'thalo actualize' collects all _new_ entries matching your queries and formats them with your prompt. Simply pipe the output to an LLM, and your knowledge base is organically updated.",
    focusedPanels: [2, 3],
    activePanel: 3,
  },
  {
    id: "see-output",
    label: "Output",
    description: "AI synthesizes your scattered thoughts into coherent output",
    details:
      "The LLM processes your structured entries and generates the output you defined — a summary, analysis, or any format you specified. Your fragmented notes become connected insights.",
    focusedPanels: [3, 4],
    activePanel: 4,
    panelOverrides: {
      4: { badge: "generated" },
    },
  },
];

// Panel content components
function EntityPanelContent() {
  return (
    <PanelCode>
      <span className={syn.timestamp}>2026-01-07T11:40Z</span>{" "}
      <span className={syn.directive}>define-entity</span>{" "}
      <span className={syn.entity}>opinion</span>{" "}
      <span className={syn.string}>"Formed stances on topics"</span>
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
      {"\n"}
      {"  "}
      <span className={syn.key}>related?:</span> link[]
      {"\n\n"}
      {"  "}
      <span className={syn.section}># Sections</span>
      {"\n"}
      {"  "}
      <span className={syn.key}>Claim</span>
      {" ; "}
      <span className={syn.string}>"Core opinion in 1-2 sentences"</span>
      {"\n"}
      {"  "}
      <span className={syn.key}>Reasoning</span>
      {" ; "}
      <span className={syn.string}>"Bullet points supporting the claim"</span>
    </PanelCode>
  );
}

function EntryPanelContent() {
  const { currentStep } = usePlayground();
  const showSecondEntry = currentStep >= 2;
  const showUpdated = currentStep >= 6;

  return (
    <PanelCode>
      <span className={syn.timestamp}>2026-01-07T10:18Z</span>{" "}
      <span className={syn.directive}>create</span> <span className={syn.entity}>opinion</span>{" "}
      <span className={syn.string}>"Premature abstraction is worse than duplication"</span>
      {"\n"}
      {"    "}
      <span className={syn.link}>^opinion-premature-abstraction</span>{" "}
      <span className={syn.tag}>#programming</span>
      {"\n"}
      {"  "}
      <span className={syn.key}>confidence:</span> <span className={syn.string}>"high"</span>
      {"\n"}
      {"  "}
      <span className={syn.key}>related:</span> <span className={syn.link}>^no-abstraction</span>
      {", "}
      <span className={syn.link}>^pragmatic-programmer</span>
      {"\n\n"}
      {"  "}
      <span className={syn.section}># Claim</span>
      {"\n"}
      {"  "}Abstracting too early creates rigid, hard-to-change code.
      {"\n\n"}
      {"  "}
      <span className={syn.section}># Reasoning</span>
      {"\n"}
      {"  "}- Early abstractions often encode the wrong assumptions
      {"\n"}
      {"  "}- The Rule of Three exists for a reason
      {showSecondEntry && (
        <>
          {"\n\n"}
          <span className={syn.timestamp}>2026-01-07T14:30Z</span>{" "}
          <span className={syn.directive}>create</span> <span className={syn.entity}>opinion</span>{" "}
          <span className={syn.string}>"Simple code beats clever code"</span>
          {"\n"}
          {"    "}
          <span className={syn.link}>^simple-beats-clever</span>{" "}
          <span className={syn.tag}>#programming</span>
          {"\n"}
          {"  "}
          <span className={syn.key}>confidence:</span> <span className={syn.string}>"high"</span>
          {"\n\n"}
          {"  "}
          <span className={syn.section}># Claim</span>
          {"\n"}
          {"  "}The best code is boring code that anyone can understand.
          {"\n\n"}
          {"  "}
          <span className={syn.section}># Reasoning</span>
          {"\n"}
          {"  "}- Debugging clever code at 3 AM is painful
          {"\n"}
          {"  "}- Junior developers should be able to modify it
        </>
      )}
      {showUpdated && (
        <>
          {"\n\n"}
          <span className={syn.comment}>... more entries added over time ...</span>
        </>
      )}
    </PanelCode>
  );
}

function SynthesisPanelContent() {
  const { currentStep } = usePlayground();
  const showUpdated = currentStep >= 6;

  return (
    <PanelCode>
      <span className={syn.timestamp}>2026-01-07T14:20Z</span>{" "}
      <span className={syn.directive}>define-synthesis</span>{" "}
      <span className={syn.string}>"Programming Philosophy"</span>
      {"\n"}
      {"    "}
      <span className={syn.link}>^prog-philosophy</span>{" "}
      <span className={syn.tag}>#programming</span>
      {"\n"}
      {"  "}
      <span className={syn.key}>sources:</span> <span className={syn.entity}>opinion</span>
      {" where "}
      <span className={syn.tag}>#programming</span>
      {"\n\n"}
      {"  "}
      <span className={syn.section}># Prompt</span>
      {"\n"}
      {"  "}Synthesize my programming opinions into a cohesive
      {"\n"}
      {"  "}philosophy. Focus on the tension between abstraction
      {"\n"}
      {"  "}and simplicity.
      {showUpdated && (
        <>
          {"\n\n"}
          <span className={syn.comment}>{"// Updated to include new opinions about testing"}</span>
        </>
      )}
    </PanelCode>
  );
}

function ActualizePanelContent() {
  return (
    <PanelCode className="bg-zinc-900 text-zinc-100">
      <span className={syn.termHeader}>{"=== Synthesis: Programming Philosophy ==="}</span>
      {"\n"}
      <span className={syn.termLabel}>Target:</span>{" "}
      <span className="text-cyan-400">^prog-philosophy</span>
      {"\n"}
      <span className={syn.termLabel}>Sources:</span>{" "}
      <span className="text-amber-400">opinion</span>
      <span className={syn.termDim}>{" where "}</span>
      <span className="text-pink-400">#programming</span>
      {"\n\n"}
      <span className={syn.termHeader}>{"--- User Prompt ---"}</span>
      {"\n"}
      Synthesize my programming opinions into a cohesive
      {"\n"}
      philosophy. Focus on the tension between abstraction
      {"\n"}
      and simplicity.
      {"\n\n"}
      <span className={syn.termHeader}>{"--- New Entries (2) ---"}</span>
      {"\n\n"}
      <span className={syn.termDim}>{"[Full entry content included for LLM context]"}</span>
      {"\n\n"}
      <span className={syn.termHeader}>{"--- Instructions ---"}</span>
      {"\n"}
      <span className={syn.termDim}>1.</span> Update content below the synthesis block
      {"\n"}
      <span className={syn.termDim}>2.</span> Place output BEFORE subsequent thalo blocks
      {"\n"}
      <span className={syn.termDim}>3.</span> Append:{" "}
      <span className="text-cyan-400">actualize-synthesis ^prog-philosophy</span>
    </PanelCode>
  );
}

function OutputPanelContent() {
  return (
    <div className="p-5 prose prose-sm dark:prose-invert max-w-none">
      <h2 className="text-lg font-bold mb-4 text-foreground">My Programming Philosophy</h2>
      <p className="text-muted-foreground leading-relaxed">
        After years of building software, I've learned that{" "}
        <strong className="text-foreground">simplicity beats cleverness every time</strong>. The
        code that survives is boring code—code that anyone can understand, modify, and debug at 3
        AM.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">Core Principles</h3>
      <ol className="text-muted-foreground space-y-2 list-decimal list-inside">
        <li>
          <strong className="text-foreground">Resist premature abstraction</strong> — Wait for the
          third instance before abstracting. Early abstractions encode wrong assumptions.
        </li>
        <li>
          <strong className="text-foreground">Write for the next developer</strong> — Code should be
          modifiable by someone who's never seen it before.
        </li>
        <li>
          <strong className="text-foreground">Prefer duplication over wrong abstraction</strong> —
          Some duplication is fine if use cases might diverge.
        </li>
      </ol>

      <div className="mt-6 pt-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground italic">
          Synthesized from 2 opinions tagged #programming
        </p>
      </div>
    </div>
  );
}

// Panels container with visibility logic
function PlaygroundPanels() {
  const { step, panelsRef } = usePlayground();
  const focusedPanels = step.focusedPanels;

  // All 5 panels - only render the 2 that are currently focused
  const panels = [
    {
      index: 0,
      title: "Entities",
      icon: FileCode,
      filename: "entities.thalo",
      iconColor: "text-amber-600 dark:text-amber-400",
      content: <EntityPanelContent />,
    },
    {
      index: 1,
      title: "Entries",
      icon: BookOpen,
      filename: "entries.thalo",
      iconColor: "text-blue-600 dark:text-blue-400",
      content: <EntryPanelContent />,
    },
    {
      index: 2,
      title: "Synthesis",
      icon: Wand2,
      filename: "syntheses.thalo",
      iconColor: "text-violet-600 dark:text-violet-400",
      content: <SynthesisPanelContent />,
    },
    {
      index: 3,
      title: "Actualize",
      icon: Terminal,
      filename: "thalo actualize",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      isTerminal: true,
      content: <ActualizePanelContent />,
    },
    {
      index: 4,
      title: "Output",
      icon: Sparkles,
      filename: "output.md",
      iconColor: "text-pink-600 dark:text-pink-400",
      content: <OutputPanelContent />,
    },
  ];

  // Filter to only show focused panels
  const visiblePanels = panels.filter((p) => focusedPanels.includes(p.index));

  // On small screens, only show the first panel (based on activePanel or first focused)
  // The activePanel indicates which panel is most important for the current step
  const primaryPanelIndex = step.activePanel ?? focusedPanels[0];

  return (
    <div
      ref={panelsRef}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 w-full max-w-6xl mx-auto"
    >
      {visiblePanels.map((panel) => {
        const isPrimary = panel.index === primaryPanelIndex;
        return (
          <div key={panel.index} className={cn(!isPrimary && "hidden md:block")}>
            <PlaygroundPanel
              index={panel.index}
              title={panel.title}
              icon={panel.icon}
              filename={panel.filename}
              iconColor={panel.iconColor}
              isTerminal={panel.isTerminal}
              fixedHeight
            >
              {panel.content}
            </PlaygroundPanel>
          </div>
        );
      })}
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <PlaygroundProvider steps={STEPS}>
      <main className="relative min-h-screen pb-40 md:pb-0">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-64 -top-64 size-[500px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-64 -right-64 size-[500px] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          {/* Header */}
          <header className="mb-8 text-center sm:mb-12">
            <span className="mb-4 inline-block font-mono text-sm tracking-wider text-primary">
              — INTERACTIVE DEMO
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
              See Thalo in <span className="italic text-primary">action</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Walk through the complete workflow: from defining entities to synthesizing knowledge
              with AI.
            </p>
          </header>

          {/* Panels */}
          <section className="mb-6 sm:mb-8">
            <PlaygroundPanels />
          </section>

          {/* Timeline - directly below panels, hidden on mobile (sticky bar handles it) */}
          <section className="mb-12 hidden md:block md:mb-16">
            <PlaygroundTimeline />
          </section>

          {/* CTA - hidden on mobile (sticky bar takes precedence) */}
          <section className="hidden text-center md:block">
            <p className="mb-4 text-muted-foreground">Ready to structure your knowledge?</p>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
            >
              Get Started with Thalo
            </Link>
          </section>
        </div>

        {/* Sticky controls at bottom - shown when single column (below md breakpoint) */}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border/50 bg-background/95 backdrop-blur-sm md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <StickyControls />
          </div>
        </div>
      </main>
    </PlaygroundProvider>
  );
}

/** Comprehensive sticky controls shown at bottom when in single-column view */
function StickyControls() {
  const { currentStep, totalSteps, steps, step, goToStep, nextStep, prevStep } = usePlayground();

  return (
    <div className="space-y-3">
      {/* Step description with badge */}
      <div className="text-center">
        <span className="mb-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <p className="text-sm font-medium text-foreground">{step.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">{step.details}</p>
      </div>

      {/* Step dots - all steps */}
      <div className="flex items-center justify-center gap-1.5">
        {steps.map((s, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <button
              key={s.id}
              onClick={() => goToStep(index)}
              className="group p-1"
              aria-label={`Go to step ${index + 1}: ${s.label}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div
                className={cn(
                  "size-2.5 rounded-full transition-all",
                  isCurrent
                    ? "bg-primary scale-125"
                    : isCompleted
                      ? "bg-primary/50"
                      : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50",
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex size-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:opacity-40"
          aria-label="Previous step"
        >
          <ChevronLeft className="size-5" />
        </button>

        <button
          onClick={nextStep}
          disabled={currentStep === totalSteps - 1}
          className="flex size-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:opacity-40"
          aria-label="Next step"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
