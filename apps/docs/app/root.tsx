import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { RootProvider } from "fumadocs-ui/provider/react-router";
import type { Route } from "./+types/root";
import { NotFoundContent } from "@/components/not-found-content";

import "./app.css";
import { HomeLayoutWithFooter } from "./layouts/home-layout";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const baseUrl =
    import.meta.env.MODE === "development" ? "http://localhost:3000" : "https://thalo.dev";
  const description =
    "Thalo is a structured plain-text language for capturing personal knowledge, thoughts, and references. AI-ready, version-controlled, human-readable.";
  const socialImage = `${baseUrl}/social.webp`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={description} />
        <meta property="og:title" content="Thalo: Personal Thought And Lore Language" />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={socialImage} />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Thalo: Personal Thought And Lore Language" />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={socialImage} />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-screen flex-col">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <RootProvider>
      <Outlet />
    </RootProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  let is404 = false;

  if (isRouteErrorResponse(error)) {
    is404 = error.status === 404;
    message = is404 ? "404" : "Error";
    details = is404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <RootProvider>
      <HomeLayoutWithFooter isDocsPage={false}>
        <NotFoundContent message={message} details={details} stack={stack} is404={is404} />
      </HomeLayoutWithFooter>
    </RootProvider>
  );
}
