import { Link } from "react-router";
import { Home, BookOpen } from "lucide-react";

type NotFoundContentProps = {
  message?: string;
  details?: string;
  stack?: string;
  is404?: boolean;
};

export function NotFoundContent({
  message = "404",
  details,
  stack,
  is404 = true,
}: NotFoundContentProps) {
  return (
    <div className="flex min-h-[calc(100vh-256px)] flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="flex flex-col items-center">
          <h1 className="text-fd-foreground text-6xl font-bold tracking-tight">{message}</h1>

          <p className="text-fd-muted-foreground mt-4 max-w-md text-center text-lg">
            {is404 ? "The requested page could not be found." : details}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/"
              className="bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              <Home className="size-4" />
              Back to Home
            </Link>
            <Link
              to="/docs"
              className="border-fd-border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            >
              <BookOpen className="size-4" />
              View Docs
            </Link>
          </div>

          {stack && (
            <div className="mt-8 w-full max-w-3xl">
              <details className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400">
                  Stack trace (dev only)
                </summary>
                <pre className="overflow-x-auto border-t border-red-200 p-4 text-xs text-red-600 dark:border-red-900 dark:text-red-400">
                  <code>{stack}</code>
                </pre>
              </details>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
