import Link from "next/link";
import type { Metadata } from "next";
import { WaitlistForm } from "@/components/WaitlistForm";
import { WaitlistCounter } from "@/components/WaitlistCounter";

export const metadata: Metadata = {
  title: "Follio | Professional Crypto Analysis Tools",
  description:
    "Professional-grade crypto analysis tools, AI-powered investment reports, and smart alerts. Join the waitlist for early access.",
  keywords: ["crypto", "trading", "bitcoin", "analysis", "AI", "investment", "alerts"],
  openGraph: {
    title: "Follio",
    description: "Your edge in crypto trading. AI-powered analysis and reports.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Follio",
    description: "Your edge in crypto trading. AI-powered analysis and reports.",
  },
};

// JSON-LD Structured Data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Follio",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Professional-grade crypto analysis tools with AI-powered investment reports, RADAR analysis, and smart alerts.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0",
    highPrice: "29",
    offerCount: "3",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "127",
    bestRating: "5",
    worstRating: "1",
  },
  featureList: [
    "AI Trading Signals",
    "AI-Powered Investment Reports",
    "Smart Trading Alerts",
    "Portfolio Tracker with AI Advisor",
  ],
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
    title: "AI Trading Signals",
    description:
      "Smart-money concepts powered by AI. Aggregated knowledge from top traders with precise entry zones, stop losses, and take profits.",
    color: "emerald",
    size: "large", // 2 columns on desktop
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
      "Professional PDF reports with AI-powered analysis, SWOT, and investment ratings.",
    color: "cyan",
    size: "normal",
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
    color: "amber",
    size: "normal",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Portfolio Tracker",
    description:
      "Track all your assets in one place. Built-in AI Advisor analyzes sectors, geography, and gives personalized recommendations.",
    color: "violet",
    size: "large", // 2 columns on desktop
  },
];

// Color mappings for Bento cards
const colorStyles: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    text: "text-emerald-400",
    glow: "bg-emerald-500/20",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20 hover:border-cyan-500/40",
    text: "text-cyan-400",
    glow: "bg-cyan-500/20",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20 hover:border-amber-500/40",
    text: "text-amber-400",
    glow: "bg-amber-500/20",
  },
  violet: {
    bg: "bg-violet-500/10",
    border: "border-violet-500/20 hover:border-violet-500/40",
    text: "text-violet-400",
    glow: "bg-violet-500/20",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/[0.08] backdrop-blur-sm bg-black/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Follio</h1>
          <div className="flex items-center gap-5">
            <Link
              href="/cockpit"
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Cockpit
            </Link>
            <Link
              href="/app/trade-review"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Trade Review
            </Link>
            <Link
              href="/research"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Research
            </Link>
            <Link
              href="/portfolio"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Portfolio
            </Link>
            <Link
              href="/app"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Launch App
            </Link>
          </div>
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

            {/* Live cockpit CTA — public, no signup */}
            <div className="pt-2">
              <Link
                href="/cockpit"
                className="group inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Or open the live <span className="font-semibold text-zinc-200 group-hover:text-emerald-300">Derivatives Cockpit</span> — free, no signup
                <span aria-hidden>→</span>
              </Link>
            </div>

            {/* Trade-review wedge CTA — the acquisition hook */}
            <div className="pt-1">
              <Link
                href="/app/trade-review"
                className="group inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                Upload a trade —{" "}
                <span className="font-semibold text-zinc-200 group-hover:text-emerald-300">
                  AI grades your decision, not your PnL
                </span>
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots/Product Preview Section */}
      <section className="relative py-24 border-t border-white/[0.08]">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl sm:text-3xl font-bold text-center mb-4 tracking-tight">
            See It In Action
          </h3>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Professional-grade tools designed for serious traders
          </p>

          {/* Main Features Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">

            {/* AI Investment Reports - Detailed */}
            <div className="group relative bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] rounded-2xl p-6 overflow-hidden hover:border-cyan-500/30 transition-all duration-300">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-1">AI Investment Reports</h4>
                  <p className="text-sm text-zinc-400">Professional PDF analysis</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">What's included:</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <li className="flex items-center gap-2 text-zinc-300">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Executive Summary
                  </li>
                  <li className="flex items-center gap-2 text-zinc-300">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    SWOT Analysis
                  </li>
                  <li className="flex items-center gap-2 text-zinc-300">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Tokenomics Deep-Dive
                  </li>
                  <li className="flex items-center gap-2 text-zinc-300">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    On-Chain Metrics
                  </li>
                  <li className="flex items-center gap-2 text-zinc-300">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Technical Analysis
                  </li>
                  <li className="flex items-center gap-2 text-zinc-300">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Risk Assessment
                  </li>
                  <li className="flex items-center gap-2 text-zinc-300">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Investment Rating
                  </li>
                  <li className="flex items-center gap-2 text-zinc-300">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Price Targets
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.08]">
                <p className="text-xs text-zinc-500">Powered by Claude AI with real-time data from CoinGecko, GitHub, and on-chain analytics</p>
              </div>
            </div>

            {/* Portfolio Tracker - Asset Classes + AI Advisor */}
            <div className="group relative bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] rounded-2xl p-6 overflow-hidden hover:border-amber-500/30 transition-all duration-300">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-1">Portfolio Tracker</h4>
                  <p className="text-sm text-zinc-400">All assets + AI Advisor</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Track Any Asset:</p>

                {/* Asset Types Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <span className="text-lg">₿</span>
                    <span className="text-xs text-white">Crypto</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <span className="text-lg">📈</span>
                    <span className="text-xs text-white">Stocks & ETFs</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <span className="text-lg">🥇</span>
                    <span className="text-xs text-white">Precious Metals</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <span className="text-lg">🏠</span>
                    <span className="text-xs text-white">Real Estate</span>
                  </div>
                </div>

                {/* AI Advisor Features */}
                <div className="pt-2 border-t border-white/[0.08]">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">AI Advisor:</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Sector & Industry breakdown
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Geographic allocation
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Personalized recommendations
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Trading Signals */}
            <div className="group relative bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] rounded-2xl p-6 overflow-hidden hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 12L19 12" />
                    <path d="M12 2a10 10 0 0 1 0 20" strokeDasharray="4 4" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-1">AI Trading Signals</h4>
                  <p className="text-sm text-zinc-400">Smart-money concepts from top traders</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                AI-powered signals with precise entry zones, stop losses, and take profits.
                Aggregated knowledge from top traders, refined with machine learning.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">Entry Zones</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">Stop Loss</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">Take Profit</span>
              </div>
            </div>

            {/* Smart Alerts */}
            <div className="group relative bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] rounded-2xl p-6 overflow-hidden hover:border-rose-500/30 transition-all duration-300">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-1">Smart Alerts</h4>
                  <p className="text-sm text-zinc-400">Never miss an opportunity</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Get instant Telegram and email notifications for market regime changes,
                SNIPER setups, and custom price alerts. Stay informed 24/7.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <svg className="w-5 h-5 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  Telegram
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  Email
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Bento Grid */}
      <section className="relative py-16 md:py-24 border-t border-white/[0.08]">
        <div className="container mx-auto px-4 md:px-8 lg:px-16">
          {/* Header */}
          <div className="text-center mb-12 md:mb-16">
            <h3 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
              Everything You Need
            </h3>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              A complete ecosystem for the modern trader, combining institutional-grade data with advanced AI analysis.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
            {FEATURES.map((feature) => {
              const colors = colorStyles[feature.color];
              return (
                <div
                  key={feature.title}
                  className={`group relative p-6 md:p-8 rounded-3xl border bg-[#111] hover:bg-[#161616] transition-all duration-300 flex flex-col justify-between ${colors.border} ${feature.size === "large" ? "md:col-span-2" : ""}`}
                >
                  {/* Glow Effect on Hover */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-2xl -z-10 ${colors.glow}`} />

                  <div className="relative z-10">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-2xl ${colors.bg} flex items-center justify-center mb-6 border ${colors.border.split(" ")[0]}`}>
                      <div className={`w-6 h-6 ${colors.text}`}>
                        {feature.icon}
                      </div>
                    </div>

                    {/* Content */}
                    <h4 className="text-xl font-bold mb-3 group-hover:text-white transition-colors">
                      {feature.title}
                    </h4>
                    <p className="text-zinc-400 leading-relaxed text-sm md:text-base">
                      {feature.description}
                    </p>
                  </div>

                  {/* Learn More Arrow */}
                  <div className="relative z-10 mt-6 md:mt-8 flex items-center text-xs font-bold uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors cursor-pointer">
                    Learn More
                    <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust Signals Section */}
      <section className="relative py-16 border-t border-white/[0.08]">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-zinc-500">
{/* Privacy */}
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
              <div className="text-sm">
                <p className="text-zinc-300 font-medium">Privacy First</p>
                <p className="text-xs">We never sell your data</p>
              </div>
            </div>

            {/* No Credit Card */}
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
              <div className="text-sm">
                <p className="text-zinc-300 font-medium">No Credit Card</p>
                <p className="text-xs">Free to join waitlist</p>
              </div>
            </div>

            {/* Cancel Anytime */}
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="text-zinc-300 font-medium">Cancel Anytime</p>
                <p className="text-xs">No contracts or commitments</p>
              </div>
            </div>
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
          <p className="mb-2">Follio</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/terms" className="text-zinc-600 hover:text-zinc-400 transition-colors">
              Terms of Service
            </Link>
            <span className="text-zinc-700">|</span>
            <Link href="/privacy" className="text-zinc-600 hover:text-zinc-400 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
