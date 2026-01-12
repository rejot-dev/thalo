import { ThemeToggle } from "fumadocs-ui/components/layout/theme-toggle";
import { useState } from "react";
import { Check, Image, Sparkles, FileText, BookOpen, Layers } from "lucide-react";

export function loader() {
  // Only allow access in development mode
  if (import.meta.env.MODE !== "development") {
    throw new Response("Not Found", { status: 404 });
  }
  return null;
}

type ImageVariant = "main" | "docs" | "blog" | "playground";

const variants: { id: ImageVariant; label: string; icon: typeof Image; description: string }[] = [
  { id: "main", label: "Main", icon: Sparkles, description: "Primary social share" },
  { id: "docs", label: "Documentation", icon: BookOpen, description: "Docs pages" },
  { id: "blog", label: "Blog", icon: FileText, description: "Blog articles" },
  { id: "playground", label: "Playground", icon: Layers, description: "Interactive demo" },
];

/** Decorative corner flourish */
function CornerFlourish({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M0 80 Q 40 40, 80 0"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M0 60 Q 30 30, 60 0"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <circle cx="20" cy="60" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="60" cy="20" r="2" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/** Main OG Image - Hero variant with full branding */
function MainOgImage() {
  return (
    <div className="relative flex h-[630px] w-[1200px] flex-col overflow-hidden bg-[#faf3e6] dark:bg-[oklch(0.14_0.015_50)]">
      {/* Background texture - subtle paper grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='a' x='0' y='0'%3E%3CfeTurbulence baseFrequency='.75' stitchTiles='stitch' type='fractalNoise'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)' opacity='.06'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Warm gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-amber-500/8 via-transparent to-orange-500/5 dark:from-amber-500/15 dark:via-transparent dark:to-amber-600/10" />

      {/* Decorative corner flourishes */}
      <CornerFlourish className="absolute -left-2 -top-2 h-24 w-24 rotate-0 text-amber-800/20 dark:text-amber-400/20" />
      <CornerFlourish className="absolute -right-2 -top-2 h-24 w-24 rotate-90 text-amber-800/20 dark:text-amber-400/20" />
      <CornerFlourish className="absolute -bottom-2 -left-2 h-24 w-24 -rotate-90 text-amber-800/20 dark:text-amber-400/20" />
      <CornerFlourish className="absolute -bottom-2 -right-2 h-24 w-24 rotate-180 text-amber-800/20 dark:text-amber-400/20" />

      {/* Subtle diagonal lines */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 top-24 h-px w-96 rotate-35 bg-linear-to-r from-transparent via-amber-700/20 to-transparent dark:via-amber-400/15" />
        <div className="absolute -left-32 bottom-32 h-px w-96 rotate-35 bg-linear-to-r from-transparent via-amber-700/20 to-transparent dark:via-amber-400/15" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-20">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-6">
          <div className="relative">
            {/* Glow behind logo */}
            <div className="absolute -inset-4 rounded-full bg-amber-500/20 blur-2xl dark:bg-amber-400/30" />
            <img src="/logo.svg" alt="" className="relative size-28 drop-shadow-lg" />
          </div>
        </div>

        {/* Title */}
        <h1
          className="mb-4 text-center text-8xl font-bold tracking-tight text-[oklch(0.22_0.03_50)] dark:text-[oklch(0.92_0.02_85)]"
          style={{ fontFamily: "Lora, Georgia, serif" }}
        >
          Thalo
        </h1>

        {/* Tagline */}
        <p
          className="mb-8 text-center text-3xl italic tracking-wide text-[oklch(0.45_0.04_55)] dark:text-[oklch(0.72_0.08_55)]"
          style={{ fontFamily: "Lora, Georgia, serif" }}
        >
          Thought And Lore Language
        </p>

        {/* Divider flourish */}
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px w-24 bg-linear-to-r from-transparent to-amber-700/40 dark:to-amber-400/40" />
          <div className="size-2 rotate-45 border border-amber-700/40 bg-amber-500/20 dark:border-amber-400/40 dark:bg-amber-400/30" />
          <div className="h-px w-24 bg-linear-to-l from-transparent to-amber-700/40 dark:to-amber-400/40" />
        </div>

        {/* Description */}
        <p
          className="max-w-2xl text-center text-xl leading-relaxed text-[oklch(0.5_0.03_50)] dark:text-[oklch(0.68_0.02_85)]"
          style={{ fontFamily: "Lora, Georgia, serif" }}
        >
          A structured plain-text format for capturing personal knowledge, thoughts, and references.
          Human-readable, AI-ready, forever yours.
        </p>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 flex items-center justify-between border-t border-amber-800/10 bg-amber-900/5 px-12 py-5 dark:border-amber-400/10 dark:bg-amber-400/5">
        <div className="flex items-center gap-3">
          <span
            className="text-lg font-medium text-[oklch(0.4_0.05_55)] dark:text-[oklch(0.65_0.08_55)]"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            thalo.rejot.dev
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-600/15 px-4 py-1.5 text-sm font-semibold tracking-wide text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
            Open Source
          </span>
        </div>
      </div>
    </div>
  );
}

/** Documentation OG Image */
function DocsOgImage() {
  return (
    <div className="relative flex h-[630px] w-[1200px] flex-col overflow-hidden bg-[#faf3e6] dark:bg-[oklch(0.14_0.015_50)]">
      {/* Background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-15"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='a' x='0' y='0'%3E%3CfeTurbulence baseFrequency='.75' stitchTiles='stitch' type='fractalNoise'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)' opacity='.05'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 via-transparent to-amber-500/5 dark:from-blue-500/10 dark:to-amber-500/8" />

      {/* Decorative code lines in background */}
      <div className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 space-y-3 opacity-15 dark:opacity-10">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-3 rounded-full bg-amber-800 dark:bg-amber-300"
            style={{ width: `${120 + Math.sin(i * 1.5) * 60}px`, marginLeft: `${i * 8}px` }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 items-center px-20">
        <div className="flex flex-col">
          {/* Badge */}
          <div className="mb-6 flex items-center gap-3">
            <BookOpen className="size-6 text-amber-600 dark:text-amber-400" />
            <span
              className="text-lg font-medium uppercase tracking-widest text-amber-700 dark:text-amber-400"
              style={{ fontFamily: "Lora, Georgia, serif" }}
            >
              Documentation
            </span>
          </div>

          {/* Title */}
          <h1
            className="mb-6 max-w-3xl text-7xl font-bold leading-tight tracking-tight text-[oklch(0.22_0.03_50)] dark:text-[oklch(0.92_0.02_85)]"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            Learn Thalo
          </h1>

          {/* Description */}
          <p
            className="max-w-2xl text-2xl leading-relaxed text-[oklch(0.5_0.03_50)] dark:text-[oklch(0.68_0.02_85)]"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            Comprehensive guides, tutorials, and API reference for building your personal knowledge
            system.
          </p>

          {/* Feature pills */}
          <div className="mt-10 flex flex-wrap gap-3">
            {["Quick Start", "Entities", "Entries", "Syntheses", "CLI", "LSP"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-amber-700/20 bg-amber-50/80 px-5 py-2 text-base font-medium text-amber-900 dark:border-amber-400/20 dark:bg-amber-900/30 dark:text-amber-200"
                style={{ fontFamily: "Lora, Georgia, serif" }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar with logo */}
      <div className="relative z-10 flex items-center gap-4 border-t border-amber-800/10 bg-amber-900/5 px-12 py-5 dark:border-amber-400/10 dark:bg-amber-400/5">
        <img src="/logo.svg" alt="" className="size-10" />
        <span
          className="text-xl font-bold text-[oklch(0.35_0.05_55)] dark:text-[oklch(0.75_0.08_55)]"
          style={{ fontFamily: "Lora, Georgia, serif" }}
        >
          Thalo
        </span>
      </div>
    </div>
  );
}

/** Blog OG Image */
function BlogOgImage() {
  return (
    <div className="relative flex h-[630px] w-[1200px] flex-col overflow-hidden bg-[#faf3e6] dark:bg-[oklch(0.14_0.015_50)]">
      {/* Background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35 dark:opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='a' x='0' y='0'%3E%3CfeTurbulence baseFrequency='.75' stitchTiles='stitch' type='fractalNoise'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)' opacity='.06'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vintage paper edge effect */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-amber-100/50 to-transparent dark:from-amber-900/20" />

      {/* Decorative elements */}
      <div className="pointer-events-none absolute left-20 top-20 size-32 rounded-full border border-amber-700/10 dark:border-amber-400/10" />
      <div className="pointer-events-none absolute right-32 top-32 size-16 rotate-45 border border-amber-700/10 dark:border-amber-400/10" />

      {/* Main content */}
      <div className="relative z-10 flex flex-1 items-center px-20">
        <div className="flex flex-col">
          {/* Category badge */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-600/15 dark:bg-amber-400/15">
              <FileText className="size-5 text-amber-700 dark:text-amber-400" />
            </div>
            <span
              className="text-lg font-medium uppercase tracking-widest text-amber-700 dark:text-amber-400"
              style={{ fontFamily: "Lora, Georgia, serif" }}
            >
              From the Blog
            </span>
          </div>

          {/* Sample blog title */}
          <h1
            className="mb-6 max-w-4xl text-6xl font-bold leading-tight tracking-tight text-[oklch(0.22_0.03_50)] dark:text-[oklch(0.92_0.02_85)]"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            Thoughts on Knowledge, Technology & the Art of Remembering
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-6 text-lg text-[oklch(0.5_0.03_50)] dark:text-[oklch(0.65_0.02_85)]">
            <span style={{ fontFamily: "Lora, Georgia, serif" }}>Updates & Insights</span>
            <span className="text-amber-600/50 dark:text-amber-400/50">•</span>
            <span className="italic" style={{ fontFamily: "Lora, Georgia, serif" }}>
              Plain text, forever
            </span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 flex items-center justify-between border-t border-amber-800/10 bg-amber-900/5 px-12 py-5 dark:border-amber-400/10 dark:bg-amber-400/5">
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="" className="size-10" />
          <span
            className="text-xl font-bold text-[oklch(0.35_0.05_55)] dark:text-[oklch(0.75_0.08_55)]"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            Thalo Blog
          </span>
        </div>
        <span
          className="text-base text-[oklch(0.5_0.03_50)] dark:text-[oklch(0.65_0.02_85)]"
          style={{ fontFamily: "Lora, Georgia, serif" }}
        >
          thalo.rejot.dev/blog
        </span>
      </div>
    </div>
  );
}

/** Playground OG Image */
function PlaygroundOgImage() {
  return (
    <div className="relative flex h-[630px] w-[1200px] flex-col overflow-hidden bg-[#faf3e6] dark:bg-[oklch(0.14_0.015_50)]">
      {/* Background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-15"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='a' x='0' y='0'%3E%3CfeTurbulence baseFrequency='.75' stitchTiles='stitch' type='fractalNoise'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)' opacity='.05'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 via-transparent to-amber-500/5 dark:from-emerald-500/10 dark:to-amber-500/8" />

      {/* Decorative code window shapes */}
      <div className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 flex flex-col gap-4 opacity-20 dark:opacity-15">
        <div className="h-64 w-80 rounded-xl border-2 border-amber-700 dark:border-amber-400">
          <div className="flex gap-2 border-b border-amber-700/50 p-3 dark:border-amber-400/50">
            <div className="size-3 rounded-full bg-red-400/60" />
            <div className="size-3 rounded-full bg-yellow-400/60" />
            <div className="size-3 rounded-full bg-green-400/60" />
          </div>
        </div>
        <div className="ml-8 h-48 w-72 rounded-xl border-2 border-amber-700/60 dark:border-amber-400/60">
          <div className="flex gap-2 border-b border-amber-700/30 p-3 dark:border-amber-400/30">
            <div className="size-3 rounded-full bg-red-400/40" />
            <div className="size-3 rounded-full bg-yellow-400/40" />
            <div className="size-3 rounded-full bg-green-400/40" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 items-center px-20">
        <div className="flex max-w-2xl flex-col">
          {/* Badge */}
          <div className="mb-6 flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 animate-pulse rounded-full bg-emerald-500/20 blur-sm" />
              <Layers className="relative size-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span
              className="text-lg font-medium uppercase tracking-widest text-emerald-700 dark:text-emerald-400"
              style={{ fontFamily: "Lora, Georgia, serif" }}
            >
              Interactive
            </span>
          </div>

          {/* Title */}
          <h1
            className="mb-6 text-7xl font-bold leading-tight tracking-tight text-[oklch(0.22_0.03_50)] dark:text-[oklch(0.92_0.02_85)]"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            Playground
          </h1>

          {/* Description */}
          <p
            className="mb-8 text-2xl leading-relaxed text-[oklch(0.5_0.03_50)] dark:text-[oklch(0.68_0.02_85)]"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            Write Thalo in your browser. See validation, syntax highlighting, and the parsed AST in
            real-time.
          </p>

          {/* CTA-style element */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-emerald-600/15 px-6 py-3 dark:bg-emerald-400/15">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              <span
                className="text-lg font-medium text-emerald-800 dark:text-emerald-300"
                style={{ fontFamily: "Lora, Georgia, serif" }}
              >
                Try it now — no install required
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 flex items-center justify-between border-t border-amber-800/10 bg-amber-900/5 px-12 py-5 dark:border-amber-400/10 dark:bg-amber-400/5">
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="" className="size-10" />
          <span
            className="text-xl font-bold text-[oklch(0.35_0.05_55)] dark:text-[oklch(0.75_0.08_55)]"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            Thalo Playground
          </span>
        </div>
        <span
          className="text-base text-[oklch(0.5_0.03_50)] dark:text-[oklch(0.65_0.02_85)]"
          style={{ fontFamily: "Lora, Georgia, serif" }}
        >
          thalo.rejot.dev/playground
        </span>
      </div>
    </div>
  );
}

const imageComponents: Record<ImageVariant, () => React.JSX.Element> = {
  main: MainOgImage,
  docs: DocsOgImage,
  blog: BlogOgImage,
  playground: PlaygroundOgImage,
};

export default function OgImagePage() {
  const [imageType, setImageType] = useState<ImageVariant>("main");
  const ImageComponent = imageComponents[imageType];

  return (
    <div className="relative min-h-screen bg-linear-to-br from-stone-100 via-amber-50/30 to-stone-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Subtle background pattern */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40 dark:opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C8C7C' fill-opacity='0.08'%3E%3Ccircle cx='30' cy='30' r='1.5'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header className="relative border-b border-amber-800/10 bg-white/60 backdrop-blur-sm dark:border-amber-400/10 dark:bg-zinc-900/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <img src="/logo.svg" alt="Thalo" className="size-10" />
            <div>
              <h1
                className="text-xl font-bold text-[oklch(0.22_0.03_50)] dark:text-[oklch(0.92_0.02_85)]"
                style={{ fontFamily: "Lora, Georgia, serif" }}
              >
                OG Image Preview
              </h1>
              <p className="text-sm text-[oklch(0.5_0.03_50)] dark:text-[oklch(0.65_0.02_85)]">
                Development tool • 1200×630px
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="relative mx-auto max-w-7xl px-6 py-12">
        {/* Variant selector */}
        <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
          {variants.map((variant) => {
            const Icon = variant.icon;
            const isActive = imageType === variant.id;
            return (
              <button
                key={variant.id}
                onClick={() => setImageType(variant.id)}
                className={`group relative flex items-center gap-3 rounded-xl border px-5 py-3 transition-all duration-300 ${
                  isActive
                    ? "border-amber-600/30 bg-amber-100/80 shadow-lg shadow-amber-500/10 dark:border-amber-400/30 dark:bg-amber-900/30"
                    : "border-amber-800/10 bg-white/60 hover:border-amber-600/20 hover:bg-amber-50/80 dark:border-amber-400/10 dark:bg-zinc-800/40 dark:hover:border-amber-400/20 dark:hover:bg-zinc-800/60"
                }`}
              >
                <Icon
                  className={`size-5 transition-colors ${
                    isActive
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-amber-600/60 group-hover:text-amber-600 dark:text-amber-400/50 dark:group-hover:text-amber-400"
                  }`}
                />
                <div className="text-left">
                  <span
                    className={`block text-sm font-semibold transition-colors ${
                      isActive
                        ? "text-amber-900 dark:text-amber-200"
                        : "text-[oklch(0.35_0.03_50)] dark:text-[oklch(0.75_0.02_85)]"
                    }`}
                    style={{ fontFamily: "Lora, Georgia, serif" }}
                  >
                    {variant.label}
                  </span>
                  <span className="block text-xs text-[oklch(0.55_0.02_50)] dark:text-[oklch(0.6_0.02_85)]">
                    {variant.description}
                  </span>
                </div>
                {isActive && <Check className="ml-2 size-4 text-amber-600 dark:text-amber-400" />}
              </button>
            );
          })}
        </div>

        {/* Image preview container */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Decorative shadow layers */}
            <div className="absolute -inset-3 rounded-2xl bg-linear-to-br from-amber-500/10 via-transparent to-amber-600/10 blur-xl" />
            <div className="absolute -inset-1 rounded-xl bg-amber-900/5 dark:bg-amber-400/5" />

            {/* Image frame */}
            <div className="relative overflow-hidden rounded-xl border-2 border-amber-800/15 shadow-2xl shadow-amber-900/10 dark:border-amber-400/15 dark:shadow-amber-400/5">
              <ImageComponent />
            </div>
          </div>
        </div>

        {/* Dimensions badge - below the image */}
        <div className="mt-6 flex justify-center">
          <div className="rounded-full border border-amber-800/20 bg-white/90 px-4 py-1.5 text-xs font-medium text-amber-800 shadow-lg backdrop-blur-sm dark:border-amber-400/20 dark:bg-zinc-900/90 dark:text-amber-300">
            1200 × 630 px
          </div>
        </div>

        {/* Info section */}
        <div className="mt-16 flex justify-center">
          <div className="max-w-xl text-center">
            <p
              className="text-sm italic text-[oklch(0.5_0.03_50)] dark:text-[oklch(0.6_0.02_85)]"
              style={{ fontFamily: "Lora, Georgia, serif" }}
            >
              These images are designed for optimal display when shared on social media platforms
              like Twitter, LinkedIn, and Discord. Toggle dark mode to preview both themes.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
