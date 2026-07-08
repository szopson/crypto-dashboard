import type { Metadata } from "next";
import { AiRead } from "@/components/cockpit/AiRead";
import { DerivativesCockpit } from "@/components/cockpit/DerivativesCockpit";

export const metadata: Metadata = {
  title: "Derivatives Cockpit — live perp funding, OI & liquidations",
  description:
    "One screen for perp traders: open interest, funding & cross-exchange spread, liquidations, long/short positioning and ETF flows — deviations highlighted in real time.",
};

// Regenerate at the data cadence; the underlying Coinglass snapshot is 60s-cached.
export const revalidate = 60;

export default function CockpitPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <AiRead />
      <DerivativesCockpit />
    </main>
  );
}
