"use client";

/**
 * Playground Page - Interactive Thalo editor with live syntax highlighting.
 *
 * Features:
 * - Single tabbed panel with entities, entries, and synthesis
 * - CodeMirror 6 editor with Thalo semantic highlighting
 * - Animated terminal showing the actualize workflow
 */

import { Link } from "react-router";
import { BookOpen, ArrowRight } from "lucide-react";
import { PlaygroundProvider, PlaygroundTabs, AnimatedTerminal } from "@/components/playground";

export function meta() {
  return [
    { title: "Playground - Thalo" },
    {
      name: "description",
      content:
        "Interactive playground to experiment with Thalo syntax. Write entities, create entries, and define syntheses with live syntax highlighting.",
    },
  ];
}

export default function PlaygroundPage() {
  return (
    <PlaygroundProvider>
      <main className="relative min-h-screen">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-64 -top-64 size-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-64 -right-64 size-[600px] rounded-full bg-violet-500/5 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-8 text-center">
            <span className="mb-3 inline-block font-mono text-sm tracking-wider text-primary">
              — PLAYGROUND
            </span>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Experiment with <span className="italic text-primary">Thalo</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Edit the code below to explore Thalo syntax. Define entities, create entries, and see
              how synthesis queries work.
            </p>
          </header>

          {/* Editor panel */}
          <section className="mx-auto mb-8 max-w-4xl">
            <PlaygroundTabs panels={["entities", "entries", "synthesis"]} />
          </section>

          {/* Terminal section */}
          <section className="mb-12">
            <div className="mb-4 text-center">
              <h2 className="text-lg font-semibold text-foreground">Try the CLI</h2>
              <p className="text-sm text-muted-foreground">
                Run commands on your playground content above
              </p>
            </div>
            <div className="mx-auto max-w-4xl">
              <AnimatedTerminal />
            </div>
          </section>

          {/* CTA */}
          <section className="text-center">
            <div className="mx-auto max-w-xl rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur-sm">
              <BookOpen className="mx-auto mb-4 size-10 text-primary" />
              <h3 className="mb-2 text-xl font-semibold">Ready to start building?</h3>
              <p className="mb-6 text-muted-foreground">
                Learn how to set up Thalo in your project and start capturing your knowledge.
              </p>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
              >
                Read the Docs
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </section>
        </div>
      </main>
    </PlaygroundProvider>
  );
}
