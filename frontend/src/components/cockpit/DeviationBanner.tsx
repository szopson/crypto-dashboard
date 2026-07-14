/**
 * DeviationBanner — the top of the Derivatives Cockpit.
 *
 * Renders the structured `deviations[]` from the crypto pulse as ranked,
 * colour-coded cards (loudest first). This is the "what's off right now" frame
 * a perp trader reads before anything else — interpretation over raw numbers.
 *
 * Phase 2 will attach an exchange execution CTA per deviation via the
 * `ctaSlot` render prop; kept optional so this component stays presentational.
 */
import { AlertTriangle, Eye, Info } from "lucide-react";
import type { Deviation } from "@/lib/coinglass";

const SEVERITY_STYLES: Record<
  Deviation["severity"],
  { wrap: string; chip: string; icon: React.ReactNode }
> = {
  alert: {
    wrap: "border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  watch: {
    wrap: "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    icon: <Eye className="h-4 w-4" />,
  },
  info: {
    wrap: "border-(--glass-border) bg-muted/40",
    chip: "bg-muted/400/15 text-muted-foreground",
    icon: <Info className="h-4 w-4" />,
  },
};

const DIRECTION_DOT: Record<Deviation["direction"], string> = {
  bullish: "bg-emerald-500",
  bearish: "bg-rose-500",
  neutral: "bg-zinc-400",
};

export function DeviationBanner({
  deviations,
  ctaSlot,
}: {
  deviations: Deviation[];
  ctaSlot?: (d: Deviation) => React.ReactNode;
}) {
  if (!deviations.length) {
    return (
      <div className="rounded-xl border border-(--glass-border) bg-muted/40 p-4 text-sm text-muted-foreground">
        No standout deviations right now — funding, OI and positioning are near baseline.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deviations.map((d, i) => {
        const s = SEVERITY_STYLES[d.severity];
        return (
          <div
            key={`${d.kind}-${d.symbol}-${i}`}
            className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${s.wrap}`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex-shrink-0 rounded-md p-1.5 ${s.chip}`}>{s.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${DIRECTION_DOT[d.direction]}`} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{d.symbol}</span>
                  <span className="text-sm font-semibold">{d.headline}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{d.detail}</p>
              </div>
            </div>
            {ctaSlot && <div className="flex-shrink-0 pl-8 sm:pl-0">{ctaSlot(d)}</div>}
          </div>
        );
      })}
    </div>
  );
}
