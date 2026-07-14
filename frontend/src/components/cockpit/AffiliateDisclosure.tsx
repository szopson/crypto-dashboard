/**
 * AffiliateDisclosure — visible, always-on affiliation disclosure.
 *
 * Disclosure is part of the product's DNA, not a footnote: the user's interest
 * (a real fee rebate) and ours (commission) are aligned, and venues are ranked
 * by the user's net cost. Copy lives in config/exchanges.ts.
 *
 * ⚖️ The copy below is subject to MiCA / KNF legal review — it must remain
 * "fair, clear and not misleading". Do not soften or hide it without sign-off.
 */
import { Info } from "lucide-react";
import { AFFILIATE_DISCLOSURE } from "@/config/exchanges";

export function AffiliateDisclosure() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-(--glass-border) bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span>{AFFILIATE_DISCLOSURE}</span>
    </p>
  );
}
