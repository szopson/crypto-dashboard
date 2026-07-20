/**
 * Shared public-site footer: secondary navigation + legal. The trade-review
 * wedge CTA is deliberately NOT here — it stays page-contextual (landing
 * hero, portfolio footer) so a global repeat doesn't dilute it.
 */
import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/cockpit", label: "Cockpit" },
  { href: "/app/trade-review", label: "Trade Review" },
  { href: "/research", label: "Research" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/blog", label: "Blog" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-(--glass-border)">
      <div className="container mx-auto px-4 py-8 flex flex-col items-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <Link
          href="/"
          className="font-semibold text-foreground rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Follio
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-foreground transition-colors rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
