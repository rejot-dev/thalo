import type { Route } from "./+types/blog-index";
import { Link } from "react-router";
import { blogSource } from "@/lib/source";
import { Calendar, User, ArrowRight, BookOpen } from "lucide-react";

export function meta() {
  return [
    { title: "Blog | Thalo" },
    { name: "description", content: "News, updates, and insights from the Thalo team." },
  ];
}

export async function loader() {
  const posts = [...blogSource.getPages()]
    .map((post) => ({
      url: post.url,
      title: post.data.title,
      description: post.data.description,
      date: "date" in post.data ? post.data.date : new Date(),
      author: "author" in post.data ? post.data.author : undefined,
      image: "image" in post.data ? post.data.image : undefined,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { posts };
}

export default function BlogPage({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      {/* Hero section */}
      <section className="relative overflow-hidden border-b border-border/50 bg-muted/20 py-16 md:py-24">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-amber-500/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 md:px-8">
          <span className="mb-4 inline-block font-mono text-sm tracking-wider text-primary">
            — NEWS & UPDATES
          </span>
          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
            Thalo <span className="italic text-primary">Blog</span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Insights, tutorials, and updates from the team building the future of personal knowledge
            management.
          </p>
        </div>
      </section>

      {/* Posts section */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          {posts.length === 0 ? (
            <div className="mx-auto max-w-lg">
              <div className="rounded-2xl border-2 border-border/60 bg-card p-10 text-center shadow-lg">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
                  <BookOpen className="size-8 text-muted-foreground" />
                </div>
                <h2 className="mb-2 text-xl font-semibold tracking-tight">No articles yet</h2>
                <p className="text-muted-foreground">
                  We're working on some great content. Check back soon!
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {posts.map((post) => (
                <article key={post.url}>
                  <Link
                    to={post.url}
                    className="group relative block overflow-hidden rounded-xl border-2 border-border/60 bg-card shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
                  >
                    {/* Hover glow */}
                    <div className="pointer-events-none absolute inset-x-4 -top-16 h-32 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />

                    {/* Content */}
                    <div className="relative p-6 md:p-8">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
                        <div className="flex-1">
                          {/* Title */}
                          <h2 className="mb-2 text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary md:text-2xl">
                            {post.title}
                          </h2>

                          {/* Description */}
                          <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                            {post.description}
                          </p>
                        </div>

                        {/* Meta & CTA */}
                        <div className="flex flex-wrap items-center gap-4 md:flex-col md:items-end md:gap-2 md:text-right">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <div className="inline-flex items-center gap-1.5">
                              <Calendar className="size-4 opacity-70" />
                              <time dateTime={new Date(post.date).toISOString()}>
                                {new Date(post.date).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </time>
                            </div>

                            {post.author ? (
                              <div className="inline-flex items-center gap-1.5">
                                <User className="size-4 opacity-70" />
                                <span>{post.author}</span>
                              </div>
                            ) : null}
                          </div>

                          {/* CTA */}
                          <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors group-hover:text-primary/80">
                            <span>Read article</span>
                            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
