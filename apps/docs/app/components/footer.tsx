import { Link } from "react-router";
import { Mail, ExternalLink } from "lucide-react";

/** GitHub icon SVG */
export function GitHubIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** Discord icon SVG */
export function DiscordIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

/** Decorative flourish SVG for elegant dividers */
export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M0 10h60c5 0 10-5 15-5s10 10 25 10 20-10 25-10 10 5 15 5h60"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="100" cy="10" r="3" fill="currentColor" />
    </svg>
  );
}

/** Social icon button with hover effect */
function SocialIconButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      aria-label={label}
      className="group/icon flex size-9 items-center justify-center rounded-full border border-border/50 bg-background/50 text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
    >
      <span className="transition-transform duration-200 group-hover/icon:scale-110">
        {children}
      </span>
    </a>
  );
}

/** Shared social icons row */
export function SocialIcons() {
  return (
    <div className="flex gap-2">
      <SocialIconButton href="https://github.com/rejot-dev/thalo" label="GitHub">
        <GitHubIcon className="size-4" />
      </SocialIconButton>
      <SocialIconButton href="https://discord.gg/jdXZxyGCnC" label="Discord">
        <DiscordIcon className="size-4" />
      </SocialIconButton>
      <SocialIconButton href="mailto:thalo@rejot.dev" label="Email">
        <Mail className="size-4" />
      </SocialIconButton>
    </div>
  );
}

/** Shared copyright line */
export function CopyrightLine() {
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      Crafted with
      <span className="inline-block animate-pulse text-red-500">♥</span>
      in Amsterdam by{" "}
      <a
        href="https://rejot.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary transition-colors hover:text-primary/80"
      >
        ReJot
      </a>
    </p>
  );
}

/** Full footer for home/marketing pages */
export function HomeFooter() {
  const footerLinks = {
    product: [
      { label: "Docs", href: "/docs", internal: true },
      { label: "Blog", href: "/blog", internal: true },
      { label: "Demo", href: "/demo", internal: true },
      { label: "Playground", href: "/playground", internal: true },
      { label: "Rules", href: "/rules", internal: true },
    ],
    developer: [
      { label: "GitHub", href: "https://github.com/rejot-dev/thalo" },
      { label: "Discord", href: "https://discord.gg/jdXZxyGCnC" },
    ],
    company: [
      { label: "ReJot", href: "https://rejot.dev" },
      { label: "Contact", href: "mailto:thalo@rejot.dev" },
    ],
  };

  return (
    <footer className="relative overflow-hidden border-t border-border/30 bg-linear-to-b from-muted/30 to-muted/50">
      {/* Subtle decorative background pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--primary)/3%,transparent_50%),radial-gradient(circle_at_70%_80%,var(--primary)/2%,transparent_50%)]" />

      <div className="relative mx-auto max-w-6xl px-6 py-16 md:px-8 lg:py-20">
        {/* Top section with flourish */}
        <div className="mb-12 flex flex-col items-center">
          <Flourish className="mb-8 h-5 w-48 text-border" />
          <p className="max-w-md text-center font-serif text-lg italic text-muted-foreground">
            "Structure knowledge, collaborate with AI."
          </p>
        </div>

        {/* Main footer grid */}
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand column */}
          <div className="md:col-span-5">
            <Link to="/" className="group inline-flex items-center gap-4">
              <div className="relative">
                <img
                  src="/logo.svg"
                  alt="Thalo"
                  className="size-16 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3"
                />
              </div>
              <div>
                <span className="block text-2xl font-bold tracking-tight text-foreground">
                  Thalo
                </span>
                <span className="block text-sm tracking-wide text-muted-foreground">
                  Thought And Lore Language
                </span>
              </div>
            </Link>

            <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
              A structured plain-text format for capturing knowledge.
            </p>

            {/* Social icons */}
            <div className="mt-6">
              <SocialIcons />
            </div>
          </div>

          {/* Links columns */}
          <div className="grid gap-8 sm:grid-cols-3 md:col-span-7">
            <FooterLinkColumn title="Product" links={footerLinks.product} />
            <FooterLinkColumn title="Developer" links={footerLinks.developer} />
            <FooterLinkColumn title="Company" links={footerLinks.company} />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center gap-4 border-t border-border/30 pt-8 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ReJot. Open source under MIT License.
          </p>
          <CopyrightLine />
        </div>
      </div>
    </footer>
  );
}

/** Footer link column component */
function FooterLinkColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string; internal?: boolean }>;
}) {
  return (
    <div>
      <h3 className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-primary">
        {title}
      </h3>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            {link.internal ? (
              <Link
                to={link.href}
                className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                <span className="relative">
                  {link.label}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-primary transition-all duration-200 group-hover:w-full" />
                </span>
              </Link>
            ) : (
              <a
                href={link.href}
                target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                <span className="relative">
                  {link.label}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-primary transition-all duration-200 group-hover:w-full" />
                </span>
                {!link.href.startsWith("mailto:") && <ExternalLink className="size-3 opacity-50" />}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact footer for docs pages - fits the constrained space with sidebars */
export function DocsFooter() {
  return (
    <footer className="border-t border-border/30 bg-muted/20 py-6 px-6">
      <div className="mx-auto max-w-3xl">
        {/* Main row: logo + links */}
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          {/* Left: Logo and name */}
          <Link to="/" className="group flex items-center gap-2.5">
            <img
              src="/logo.svg"
              alt="Thalo"
              className="size-7 transition-transform duration-200 group-hover:scale-105"
            />
            <span className="font-semibold text-foreground">Thalo</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-sm text-muted-foreground">Thought and Knowledge Language</span>
          </Link>

          {/* Right: Links */}
          <div className="flex items-center gap-4 text-sm">
            <a
              href="https://github.com/rejot-dev/thalo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <GitHubIcon className="size-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <a
              href="https://discord.gg/jdXZxyGCnC"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <DiscordIcon className="size-4" />
              <span className="hidden sm:inline">Discord</span>
            </a>
            <a
              href="mailto:thalo@rejot.dev"
              className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Mail className="size-4" />
              <span className="hidden sm:inline">Contact</span>
            </a>
          </div>
        </div>

        {/* Bottom row: copyright */}
        <div className="mt-4 flex justify-center border-t border-border/20 pt-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} ReJot · Open source under MIT License</span>
        </div>
      </div>
    </footer>
  );
}
