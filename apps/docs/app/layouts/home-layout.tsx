import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import { Outlet, useLocation } from "react-router";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { Search } from "fumadocs-ui/internal/icons";
import type { ReactNode } from "react";
import { HomeFooter, DocsFooter, GitHubIcon, DiscordIcon } from "@/components/footer";

function SearchButton() {
  const { enabled, hotKey, setOpenSearch } = useSearchContext();
  if (!enabled) {
    return null;
  }

  const hotkeyParts = hotKey.slice(0, 2);

  return (
    <button
      type="button"
      onClick={() => setOpenSearch(true)}
      className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-sm text-foreground/80 shadow-sm transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Open Search"
      data-search
    >
      <Search className="size-4" />
      <span className="hidden lg:inline text-muted-foreground">Search</span>
      <kbd className="hidden sm:inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[12px] font-medium leading-none text-muted-foreground">
        {hotkeyParts.map((k, idx) => (
          <span key={typeof k.key === "string" ? k.key : "mod"} className={idx === 0 ? "" : "ms-1"}>
            {k.display}
          </span>
        ))}
      </kbd>
    </button>
  );
}

export default function Layout({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const isDocsPage = pathname === "/docs" || pathname.startsWith("/docs/");

  return <HomeLayoutWithFooter isDocsPage={isDocsPage}>{children}</HomeLayoutWithFooter>;
}

export function HomeLayoutWithFooter({
  children,
  isDocsPage,
}: {
  children?: ReactNode;
  isDocsPage: boolean;
}) {
  const options = baseOptions();

  return (
    <HomeLayout
      {...options}
      searchToggle={{
        enabled: false,
      }}
      themeSwitch={{
        enabled: false,
        mode: "light-dark-system",
      }}
      nav={{
        ...options.nav,
        title: (
          // Note: Don't wrap in <Link> - HomeLayout already wraps title in a link
          <div className="group flex items-center gap-3">
            <div className="relative size-10 overflow-visible">
              {/* Subtle glow effect on hover */}
              <div className="absolute inset-0 rounded-full bg-primary/0 blur-md transition-all duration-300 group-hover:bg-primary/20" />
              <img
                src="/logo-simple-circle.svg"
                alt="Thalo"
                className="relative size-10 transition-all duration-300 group-hover:opacity-0 group-hover:scale-90"
              />
              <img
                src="/logo.svg"
                alt="Thalo"
                className="absolute inset-0 size-10 opacity-0 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:scale-110 group-hover:rotate-6"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                Thalo
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 sm:block">
                Knowledge Language
              </span>
            </div>
          </div>
        ),
      }}
      links={[
        {
          type: "main",
          on: "all",
          url: "/docs",
          text: "Docs",
        },
        {
          type: "main",
          on: "all",
          url: "/blog",
          text: "Blog",
        },
        {
          type: "main",
          on: "all",
          url: "/demo",
          text: "Demo",
        },
        {
          type: "main",
          on: "all",
          url: "/playground",
          text: "Playground",
        },
        {
          type: "main",
          on: "all",
          url: "/rules",
          text: "Rules",
        },
        {
          type: "custom",
          on: "nav",
          secondary: true,
          children: (
            <div className="flex items-center gap-2 pe-2 max-sm:hidden">
              <SearchButton />
              {/* Subtle separator */}
              <div className="mx-1 h-5 w-px bg-border/50" />
              <a
                href="https://github.com/rejot-dev/thalo"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="group/nav relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="absolute inset-0 rounded-full bg-primary/0 transition-all duration-200 group-hover/nav:bg-primary/10" />
                <GitHubIcon className="relative size-5 transition-transform duration-200 group-hover/nav:scale-110" />
              </a>
              <a
                href="https://discord.gg/QsuEKWwqKV"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Discord"
                className="group/nav relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="absolute inset-0 rounded-full bg-primary/0 transition-all duration-200 group-hover/nav:bg-primary/10" />
                <DiscordIcon className="relative size-5 transition-transform duration-200 group-hover/nav:scale-110" />
              </a>
            </div>
          ),
        },
        {
          type: "icon",
          url: "https://github.com/rejot-dev/thalo",
          text: "GitHub",
          label: "GitHub",
          icon: <GitHubIcon className="size-4" />,
          external: true,
          on: "menu",
        },
        {
          type: "icon",
          url: "https://discord.gg/QsuEKWwqKV",
          text: "Discord",
          label: "Discord",
          icon: <DiscordIcon className="size-4" />,
          external: true,
          on: "menu",
        },
      ]}
    >
      {children ?? <Outlet />}
      {isDocsPage ? <DocsFooter /> : <HomeFooter />}
    </HomeLayout>
  );
}
