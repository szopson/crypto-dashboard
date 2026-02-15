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

// JSON-LD Structured Data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Trading Command Center",
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
    "AI-Powered Investment Reports",
    "RADAR Market Analysis",
    "Smart Trading Alerts",
    "SNIPER Trade Setups",
    "Portfolio Tracking",
    "AI Copilot Chat",
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
    title: "RADAR Analysis",
    description:
      "Smart-money concepts powered by AI. Aggregated knowledge from top traders, refined with machine learning.",
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

            {/* Wealth Dashboard - Asset Classes */}
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
                  <h4 className="text-lg font-semibold text-white mb-1">Wealth Dashboard</h4>
                  <p className="text-sm text-zinc-400">All your assets in one place</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Supported Asset Classes:</p>

                {/* Available Now */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <span className="text-2xl">₿</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">Cryptocurrencies</p>
                      <p className="text-xs text-zinc-500">BTC, ETH, SOL & 1000+ tokens</p>
                    </div>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">Live</span>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <span className="text-2xl">📈</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">Stocks & ETFs</p>
                      <p className="text-xs text-zinc-500">S&P 500, NASDAQ & global markets</p>
                    </div>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">Live</span>
                  </div>
                </div>

                {/* Coming Soon */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.08] rounded-xl opacity-75">
                    <span className="text-2xl">🥇</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-300">Precious Metals</p>
                      <p className="text-xs text-zinc-500">Gold, Silver, Platinum</p>
                    </div>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full">Coming Soon</span>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.08] rounded-xl opacity-75">
                    <span className="text-2xl">🏠</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-300">Real Estate</p>
                      <p className="text-xs text-zinc-500">Properties & REITs</p>
                    </div>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full">Coming Soon</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RADAR Dashboard */}
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
                  <h4 className="text-lg font-semibold text-white mb-1">RADAR Dashboard</h4>
                  <p className="text-sm text-zinc-400">Multi-timeframe market analysis</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Smart-money concepts powered by AI. Learn from aggregated strategies of top traders,
                refined with machine learning to identify optimal entry and exit points.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">1H</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">4H</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">1D</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">1W</span>
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

      {/* Pricing Teaser Section */}
      <section className="relative py-24 border-t border-white/[0.08]">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl sm:text-3xl font-bold text-center mb-4 tracking-tight">
            Simple, Transparent Pricing
          </h3>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Early supporters get lifetime benefits
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">
              <h4 className="text-lg font-semibold mb-2">Free</h4>
              <div className="mb-6">
                <span className="text-3xl font-bold">$0</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Basic RADAR dashboard
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  1 AI report / month
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Email alerts
                </li>
              </ul>
            </div>

            {/* Pro Tier - Highlighted */}
            <div className="relative bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-2 border-emerald-500/30 rounded-2xl p-8 transform md:-translate-y-4">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black text-xs font-bold px-4 py-1 rounded-full">
                MOST POPULAR
              </div>
              <h4 className="text-lg font-semibold mb-2">Pro</h4>
              <div className="mb-6">
                <span className="text-3xl font-bold">$29</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <ul className="space-y-3 text-sm text-zinc-300">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Full RADAR + SNIPER
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <strong>Unlimited</strong> AI reports
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Telegram alerts
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Wealth Dashboard
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  AI Copilot chat
                </li>
              </ul>
            </div>

            {/* Waitlist Benefit */}
            <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-bold px-4 py-1 rounded-full">
                EARLY BIRD
              </div>
              <h4 className="text-lg font-semibold mb-2">Waitlist</h4>
              <div className="mb-6">
                <span className="text-zinc-500 line-through text-lg">$29</span>
                <span className="text-3xl font-bold ml-2">$19</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Everything in Pro
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <strong>35% off forever</strong>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Early access
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Free AI report bonus
                </li>
              </ul>
            </div>
          </div>

          <p className="text-center text-sm text-zinc-500 mt-8">
            Prices shown are planned launch prices. Final pricing may vary.
          </p>
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
          <p className="mb-2">Trading Command Center</p>
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
