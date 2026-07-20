/**
 * Shared public-site chrome: every public page a visitor can land on
 * (portfolio, research, blog, cockpit, landing) mounts this so nobody has to
 * wonder "what can I do next". Server component — no client JS, no active
 * states (usePathname would force a client boundary; deliberate trade-off).
 *
 * Semantic tokens (bg-background, --glass-border) so it renders correctly in
 * either theme, unlike the landing's old hard-coded zinc header.
 */
import Link from "next/link";

const NAV_LINKS = [
  { href: "/cockpit", label: "Cockpit", live: true },
  { href: "/app/trade-review", label: "Trade Review", hideOnMobile: true },
  { href: "/research", label: "Research", hideOnMobile: true },
  { href: "/portfolio", label: "Portfolio", hideOnMobile: true },
];

const linkClass =
  "text-sm text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function SiteHeader() {
  return (
    <>
      {/* Keyboard users can jump past the nav */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:outline-2 focus:outline-primary"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-(--glass-border) bg-background/70 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-gradient-brand rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Follio
          </Link>
          <nav aria-label="Main" className="flex items-center gap-4 sm:gap-5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${linkClass} ${link.hideOnMobile ? "hidden sm:inline-flex" : "inline-flex"} items-center gap-1.5`}
              >
                {link.live && (
                  <span aria-hidden className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                )}
                {link.label}
              </Link>
            ))}
            <Link
              href="/app"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Launch App
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
