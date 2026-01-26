import type { Route } from "./+types/blog-post";
import { Link } from "react-router";
import { blogSource } from "@/lib/source";
import { cn } from "@/lib/cn";
import { ArrowLeft, Calendar, User, Check, Link as LinkIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import { TwitterXLogo } from "@/components/logos/twitter-x";
import type { ComponentPropsWithoutRef } from "react";
import browserCollections from "fumadocs-mdx:collections/browser";
import { getMDXComponents } from "@/lib/mdx-components";
import { BlogCodeProvider, BlogCode, BlogChecker } from "@/components/blog";

export async function loader({ params }: Route.LoaderArgs) {
  const page = blogSource.getPage([params.slug]);
  if (!page) {
    throw new Response("Not found", { status: 404 });
  }

  const publishDateSource = "date" in page.data ? page.data.date : new Date();
  const publishDate = new Date(publishDateSource);
  if (Number.isNaN(publishDate.getTime())) {
    throw new Error(`Invalid publish date for blog post at ${page.url}`);
  }
  const publishDateIso = publishDate.toISOString();
  const publishDateDisplay = publishDateFormatter.format(publishDate);

  const heroImage = "image" in page.data ? page.data.image : undefined;
  const ogImage = "ogImage" in page.data ? page.data.ogImage : undefined;
  const author = "author" in page.data ? page.data.author : undefined;

  return {
    path: page.path,
    url: page.url,
    title: page.data.title,
    description: page.data.description ?? "The library for building documentation sites",
    publishDateIso,
    publishDateDisplay,
    heroImage,
    ogImage,
    author,
  };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [{ title: "Not Found" }];
  }

  // Use ogImage for social sharing, fall back to heroImage (header), then default
  // Supports both local paths (e.g., "social.webp") and external URLs (e.g., "https://...")
  const rawImage = data.ogImage ?? data.heroImage;
  const imageUrl = rawImage
    ? rawImage.startsWith("http://") || rawImage.startsWith("https://")
      ? rawImage
      : rawImage.startsWith("/")
        ? rawImage
        : `/${rawImage}`
    : "/social.webp";

  return [
    { title: `${data.title} | Thalo Blog` },
    { name: "description", content: data.description },
    { property: "og:title", content: data.title },
    { property: "og:description", content: data.description },
    { property: "og:type", content: "article" },
    { property: "og:published_time", content: data.publishDateIso },
    { property: "og:authors", content: data.author ? [data.author] : undefined },
    { property: "og:image", content: imageUrl },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: data.title },
    { name: "twitter:description", content: data.description },
    { name: "twitter:image", content: imageUrl },
  ];
}

type TocItem = {
  url?: string;
  title?: string;
  text?: string;
  depth?: number;
  items?: TocItem[];
};

const publishDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function CustomTOC({ items }: { items: TocItem[] }) {
  const getIndentClass = (depth: number) => {
    switch (depth) {
      case 1:
        return "";
      case 2:
        return "";
      case 3:
        return "pl-4";
      case 4:
        return "pl-8";
      case 5:
        return "pl-12";
      case 6:
        return "pl-16";
      default:
        return "pl-16";
    }
  };

  const renderItems = (nodes: TocItem[]) => {
    if (!nodes || nodes.length === 0) {
      return null;
    }

    return (
      <ul className="space-y-1">
        {nodes.map((node) => {
          const label = node.title ?? node.text ?? "";
          const href = node.url ?? "";
          const depth = node.depth ?? 1;
          const indentClass = getIndentClass(depth);

          return (
            <li key={`${href}${label}`}>
              <a
                href={href}
                className={`group relative inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground ${indentClass}`}
              >
                <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
                  <span className="absolute inset-0 rounded-sm border border-border" />
                  <span className="size-2 rotate-45 rounded-sm bg-muted-foreground/30 transition-colors group-hover:bg-primary" />
                </span>
                <span className="whitespace-normal wrap-break-word leading-snug">{label}</span>
              </a>
              {node.items && node.items.length > 0 ? renderItems(node.items) : null}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <nav aria-label="Table of contents" className="space-y-1">
      {renderItems(items)}
    </nav>
  );
}

function Control({ url, author }: { url: string; author?: string }) {
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setShareUrl(`${window.location.origin}${url}`);
  }, [url]);

  const [isChecked, onCopy] = useCopyButton(() => {
    if (shareUrl === "") {
      return;
    }
    void navigator.clipboard.writeText(shareUrl);
  });

  const authorXUrl = useMemo(() => {
    if (!author) {
      return null;
    }
    const normalized = author.toLowerCase();
    if (normalized.includes("wilco")) {
      return "https://x.com/wilcokr";
    }
    if (normalized.includes("jan")) {
      return "https://x.com/jan_schutte";
    }
    return null;
  }, [author]);

  return (
    <div className="space-y-3">
      {authorXUrl ? (
        <a
          href={authorXUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-border/60 bg-card px-4 py-3 text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/5"
        >
          <TwitterXLogo className="size-4" />
          Follow
        </a>
      ) : null}
      {/* Copy Link Button */}
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-border/60 bg-card px-4 py-3 text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/5",
          isChecked &&
            "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        )}
        onClick={onCopy}
      >
        {isChecked ? (
          <>
            <Check className="size-4" />
            Link ready to share
          </>
        ) : (
          <>
            <LinkIcon className="size-4" />
            Copy Article Link
          </>
        )}
      </button>
    </div>
  );
}

const clientLoader = browserCollections.blog.createClientLoader({
  component({ toc, default: Mdx, frontmatter }) {
    const publishDateSource = frontmatter.date;
    if (!publishDateSource) {
      throw new Error(`Missing publish date for blog post`);
    }
    const publishDate = new Date(publishDateSource);
    if (Number.isNaN(publishDate.getTime())) {
      throw new Error(`Invalid publish date for blog post`);
    }
    const publishDateIso = publishDate.toISOString();
    const publishDateDisplay = publishDateFormatter.format(publishDate);

    const heroImage = frontmatter.image;

    const [postUrl, setPostUrl] = useState("");
    useEffect(() => {
      setPostUrl(window.location.pathname);
    }, []);

    return (
      <div className="min-h-screen">
        {/* Hero Section */}
        <div className="relative mb-8 overflow-hidden border-b border-border/50">
          {/* Hero Image Background (if provided) */}
          {heroImage ? (
            <>
              <img
                src={`/${heroImage}`}
                alt={frontmatter.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* Dark overlay for text readability */}
              <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/50 to-black/70 dark:from-black/70 dark:via-black/60 dark:to-black/80" />
            </>
          ) : (
            <>
              {/* Decorative background matching site aesthetic */}
              <div className="absolute inset-0 bg-muted/20" />
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-amber-500/5 blur-3xl" />
              </div>
              {/* Geometric accents */}
              <div className="pointer-events-none absolute -right-8 top-16 size-24 rotate-12 rounded-xl border border-border/30" />
              <div className="pointer-events-none absolute left-1/4 bottom-8 size-16 rounded-full border border-border/20" />
            </>
          )}

          <div className="relative mx-auto max-w-6xl px-6 py-12 md:px-8 md:py-16">
            {/* Back Button */}
            <Link
              to="/blog"
              className={cn(
                "group mb-8 inline-flex items-center gap-2 text-sm font-medium transition-colors",
                heroImage
                  ? "text-white/90 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              Back to blog
            </Link>

            {/* Article Header */}
            <header>
              <span
                className={cn(
                  "mb-4 inline-block font-mono text-sm tracking-wider",
                  heroImage ? "text-white/70" : "text-primary",
                )}
              >
                — ARTICLE
              </span>
              <h1
                className={cn(
                  "mb-5 max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl",
                  heroImage ? "text-white" : "text-foreground",
                )}
              >
                {frontmatter.title}
              </h1>

              {frontmatter.description && (
                <p
                  className={cn(
                    "mb-6 max-w-2xl text-lg leading-relaxed md:text-xl",
                    heroImage ? "text-white/90" : "text-muted-foreground",
                  )}
                >
                  {frontmatter.description}
                </p>
              )}

              {/* Article Meta */}
              <div
                className={cn(
                  "flex flex-wrap items-center gap-5 text-sm",
                  heroImage ? "text-white/70" : "text-muted-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="size-4" />
                  <time dateTime={publishDateIso}>{publishDateDisplay}</time>
                </div>

                {frontmatter.author && (
                  <div className="flex items-center gap-2">
                    <User className="size-4" />
                    <span>{frontmatter.author}</span>
                  </div>
                )}
              </div>
            </header>
          </div>
        </div>

        {/* Article Content */}
        <article className="mx-auto max-w-6xl px-6 pb-16 md:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
            {/* Main Content */}
            <div className="min-w-0 flex-1">
              <div className="prose prose-lg dark:prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary prose-a:no-underline prose-a:hover:underline prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none max-w-none">
                <Mdx
                  components={getMDXComponents({
                    a: (props: ComponentPropsWithoutRef<"a">) => {
                      const { className, ...rest } = props;
                      return (
                        <a
                          {...rest}
                          className={cn(
                            "rounded-sm no-underline underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            className,
                          )}
                        />
                      );
                    },
                    // Blog-specific components
                    BlogCodeProvider,
                    BlogCode,
                    BlogChecker,
                  })}
                />
              </div>
            </div>

            {/* Sidebar */}
            <aside className="lg:w-auto">
              <div className="sticky top-20 space-y-6">
                {/* Table of Contents */}
                {toc.length > 0 && (
                  <div className="relative overflow-hidden rounded-xl border-2 border-border/60 bg-card p-6 shadow-lg">
                    <div className="pointer-events-none absolute right-4 top-4 size-6 rotate-45 border border-border/30" />
                    <h3 className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                      Table of contents
                    </h3>
                    <div className="max-h-[40vh] overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <CustomTOC items={toc as unknown as TocItem[]} />
                    </div>
                  </div>
                )}

                {frontmatter.author ? (
                  <div className="relative overflow-hidden rounded-xl border-2 border-border/60 bg-card p-6 shadow-lg">
                    <div className="pointer-events-none absolute -left-6 -top-6 size-16 rounded-full border border-border/30" />
                    <div className="pointer-events-none absolute bottom-0 right-6 size-10 rotate-12 border-b border-r border-border/30" />
                    <h3 className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                      Stay connected
                    </h3>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full border-2 border-border/60 bg-muted text-sm font-semibold text-foreground">
                        {frontmatter.author
                          .split(" ")
                          .map((part) => part.charAt(0).toUpperCase())
                          .join("")}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{frontmatter.author}</p>
                        <p className="text-xs text-muted-foreground">Author</p>
                      </div>
                    </div>
                    <Control url={postUrl} author={frontmatter.author} />
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-xl border-2 border-border/60 bg-card p-6 shadow-lg">
                    <div className="pointer-events-none absolute -left-6 -top-6 size-16 rounded-full border border-border/30" />
                    <div className="pointer-events-none absolute bottom-0 right-6 size-10 rotate-12 border-b border-r border-border/30" />
                    <h3 className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                      Share
                    </h3>
                    <Control url={postUrl} />
                  </div>
                )}
              </div>
            </aside>
          </div>
        </article>
      </div>
    );
  },
});

export default function BlogPostPage({ loaderData }: Route.ComponentProps) {
  const { path } = loaderData;
  const Content = clientLoader.getComponent(path);

  return <Content />;
}
