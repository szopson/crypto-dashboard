import Link from "next/link";
import type { Metadata } from "next";
import { WaitlistForm } from "@/components/WaitlistForm";
import { WaitlistCounter } from "@/components/WaitlistCounter";

export const metadata: Metadata = {
  title: "Trading Command Center | Professional Crypto Analysis Tools",
  description:
    "Professional-grade crypto analysis tools, AI-powered investment reports, and smart alerts. Join the waitlist for early access.",
  keywords: ["crypto", "trading", "bitcoin", "analysis", "AI", "investment", "alerts"],
  openGraph: {
    title: "Trading Command Center",
    description: "Your edge in crypto trading. AI-powered analysis and reports.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trading Command Center",
    description: "Your edge in crypto trading. AI-powered analysis and reports.",
  },
};

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 12L19 12" />
        <path d="M12 2a10 10 0 0 1 0 20" strokeDasharray="4 4" />
      </svg>
    ),
    title: "RADAR Analysis",
    description:
      "Multi-timeframe market regime detection using BBWP, Gaussian Channel, and Williams VIX Fix.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "AI Investment Reports",
    description:
      "Professional 8-page PDF reports with AI-powered analysis, SWOT, and investment ratings.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: "Smart Alerts",
    description:
      "Automated Telegram notifications for regime changes, price levels, and trade setups.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    title: "SNIPER Setups",
    description:
      "High-confluence trade setups with precise entry zones, stop losses, and take profits.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="12" y1="6" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12" y2="16" />
      </svg>
    ),
    title: "Trade Journal",
    description:
      "Track your trades with automatic context capture, P&L analytics, and performance insights.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 10h.01" />
        <path d="M12 10h.01" />
        <path d="M16 10h.01" />
      </svg>
    ),
    title: "AI Copilot",
    description:
      "Chat with Claude about your trades. Get instant analysis and market insights.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/[0.08] backdrop-blur-sm bg-black/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Trading Command Center</h1>
          <Link
            href="/app"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Launch App
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 sm:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Your Edge in{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Crypto Trading
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Professional-grade analysis tools, AI-powered reports, and smart
              alerts. Everything you need to trade with confidence.
            </p>

            {/* Free Report Incentive */}
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-5 py-2.5 text-sm backdrop-blur-sm">
              <span className="text-emerald-400 font-semibold">FREE BONUS</span>
              <span className="text-zinc-300">AI investment report on our top altcoin pick</span>
            </div>

            {/* Waitlist Form */}
            <div className="max-w-lg mx-auto pt-4">
              <WaitlistForm />
            </div>

            {/* Waitlist Counter */}
            <WaitlistCounter />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-24 border-t border-white/[0.08]">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl sm:text-3xl font-bold text-center mb-16 tracking-tight">
            Everything You Need
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group relative bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:-translate-y-1 hover:shadow-[0_10px_40px_-15px_rgba(0,255,157,0.15)] overflow-hidden"
              >
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                <div className="relative">
                  <div className="w-10 h-10 mb-6 text-emerald-400">
                    {feature.icon}
                  </div>
                  <h4 className="text-lg font-semibold mb-3 tracking-tight">{feature.title}</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 border-t border-white/[0.08]">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Ready to Level Up Your Trading?
            </h3>
            <p className="text-zinc-400">
              Join the waitlist and be the first to get access when we launch.
            </p>
            <p className="text-emerald-400 font-medium">
              + FREE AI investment report on our top altcoin pick
            </p>
            <div className="max-w-lg mx-auto pt-2">
              <WaitlistForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 border-t border-white/[0.08]">
        <div className="container mx-auto px-4 text-center text-sm text-zinc-500">
          <p>Trading Command Center</p>
        </div>
      </footer>
    </div>
  );
}
