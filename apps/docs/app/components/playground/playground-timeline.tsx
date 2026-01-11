"use client";

import { cn } from "@/lib/cn";
import { usePlayground } from "./playground-context";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PlaygroundTimeline() {
  const { currentStep, totalSteps, steps, goToStep, nextStep, prevStep } = usePlayground();

  const step = steps[currentStep];

  return (
    <div className="w-full">
      {/* Step description - with clear labeling */}
      <div className="mb-4 text-center sm:mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
          <span className="text-xs font-medium uppercase tracking-wider text-primary">
            Step {currentStep + 1} of {totalSteps}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground sm:text-xl">{step.description}</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{step.details}</p>
      </div>

      {/* Desktop: Full timeline track */}
      <div className="relative mx-auto hidden max-w-4xl px-4 sm:block">
        {/* Background track */}
        <div className="absolute left-8 right-8 top-4 z-0 h-0.5 bg-border" />

        {/* Progress fill */}
        <div
          className="absolute left-8 top-4 z-0 h-0.5 bg-primary transition-all duration-500 ease-out"
          style={{
            width:
              totalSteps > 1 ? `calc((100% - 64px) * ${currentStep / (totalSteps - 1)})` : "0px",
          }}
        />

        {/* Step nodes */}
        <div className="relative z-10 flex items-start justify-between">
          {steps.map((s, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <button
                key={s.id}
                onClick={() => goToStep(index)}
                className={cn(
                  "group flex flex-col items-center gap-2 transition-all",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg p-1 -m-1",
                )}
                aria-label={`Go to step ${index + 1}: ${s.label}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {/* Node - needs solid background to cover the progress line */}
                <div
                  className={cn(
                    "relative z-10 flex size-8 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground scale-125 shadow-lg shadow-primary/30"
                      : isCompleted
                        ? "border-primary bg-card text-primary"
                        : "border-muted-foreground/30 bg-card text-muted-foreground group-hover:border-muted-foreground/50",
                  )}
                >
                  <span className="text-xs font-bold">{index + 1}</span>

                  {/* Pulse animation for current */}
                  {isCurrent && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-xs font-medium transition-colors max-w-16 text-center leading-tight",
                    isCurrent
                      ? "text-primary"
                      : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls - hidden on mobile (sticky bar handles it) */}
      <div className="mt-6 hidden items-center justify-center gap-3 sm:mt-8 sm:flex">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className={cn(
            "flex size-10 items-center justify-center rounded-full border-2 transition-all",
            "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            currentStep === 0
              ? "border-muted text-muted-foreground cursor-not-allowed opacity-50"
              : "border-border text-foreground hover:border-primary/50",
          )}
          aria-label="Previous step"
        >
          <ChevronLeft className="size-5" />
        </button>

        <button
          onClick={nextStep}
          disabled={currentStep === totalSteps - 1}
          className={cn(
            "flex size-10 items-center justify-center rounded-full border-2 transition-all",
            "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            currentStep === totalSteps - 1
              ? "border-muted text-muted-foreground cursor-not-allowed opacity-50"
              : "border-border text-foreground hover:border-primary/50",
          )}
          aria-label="Next step"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Keyboard hint - desktop only */}
      <p className="mt-4 hidden text-center text-xs text-muted-foreground sm:block">
        Use{" "}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          ←
        </kbd>{" "}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          →
        </kbd>{" "}
        to navigate
      </p>
    </div>
  );
}
