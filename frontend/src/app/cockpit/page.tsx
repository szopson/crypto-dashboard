import type { Metadata } from "next";
import { AiRead } from "@/components/cockpit/AiRead";
import { TodaysWatch } from "@/components/cockpit/TodaysWatch";
import { SetupPanel } from "@/components/cockpit/setup/SetupPanel";
import { DerivativesCockpit } from "@/components/cockpit/DerivativesCockpit";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Derivatives Cockpit — live perp funding, OI & liquidations",
  description:
    "One screen for perp traders: open interest, funding & cross-exchange spread, liquidations, long/short positioning and ETF flows — deviations highlighted in real time.",
};

// Regenerate at the data cadence; the underlying Coinglass snapshot is 60s-cached.
export const revalidate = 60;

export default function CockpitPage() {
  return (
    <>
    <SiteHeader />
    <main id="main-content" className="relative mx-auto w-full max-w-3xl overflow-x-clip px-4 py-6 sm:py-8">
      {/* Decorative accent glows behind the content */}
      <div aria-hidden className="glow-blob -z-10 -top-32 -right-24 h-80 w-80 bg-emerald-500/25 animate-pulse-glow" />
      <div aria-hidden className="glow-blob -z-10 top-1/2 -left-32 h-72 w-72 bg-cyan-500/20" />
      <div aria-hidden className="glow-blob -z-10 -bottom-24 right-0 h-80 w-80 bg-violet-500/20" />
      <AiRead />
      <TodaysWatch />
      <SetupPanel />
      <DerivativesCockpit />
    </main>
    <SiteFooter />
    </>
  );
}
