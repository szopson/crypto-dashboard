import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Trading Command Center",
  description: "Terms of service for Trading Command Center waitlist and services.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/[0.08] backdrop-blur-sm bg-black/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight hover:text-zinc-300 transition-colors">
            Trading Command Center
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">
              Terms of Service
            </h1>

            <div className="prose prose-invert prose-zinc max-w-none space-y-8">
              <p className="text-zinc-400 text-lg">
                Last updated: February 2026
              </p>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
                <p className="text-zinc-400 leading-relaxed">
                  By signing up for the Trading Command Center waitlist, you agree to these Terms of Service.
                  If you do not agree to these terms, please do not sign up for our waitlist.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">2. Description of Service</h2>
                <p className="text-zinc-400 leading-relaxed">
                  Trading Command Center is a cryptocurrency analysis and portfolio management platform currently
                  in development. By joining our waitlist, you are expressing interest in being notified when
                  the service becomes available.
                </p>
                <p className="text-zinc-400 leading-relaxed">
                  We may also send you occasional updates about our development progress and related content.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">3. Waitlist Terms</h2>
                <p className="text-zinc-400 leading-relaxed">
                  Joining the waitlist does not guarantee:
                </p>
                <ul className="list-disc list-inside text-zinc-400 space-y-2">
                  <li>Access to the final product</li>
                  <li>Any specific features or functionality</li>
                  <li>Any particular launch date or timeline</li>
                  <li>Priority access over other users</li>
                </ul>
                <p className="text-zinc-400 leading-relaxed">
                  We reserve the right to modify, delay, or cancel the launch of our service at any time.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">4. Not Financial Advice</h2>
                <p className="text-zinc-400 leading-relaxed">
                  Any information, reports, or analysis provided by Trading Command Center is for
                  informational purposes only and does not constitute financial, investment, tax, or
                  legal advice. You should consult with qualified professionals before making any
                  investment decisions.
                </p>
                <p className="text-zinc-400 leading-relaxed">
                  Cryptocurrency investments carry significant risk, including the potential loss of
                  your entire investment. Past performance is not indicative of future results.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">5. User Conduct</h2>
                <p className="text-zinc-400 leading-relaxed">
                  You agree to provide accurate information when signing up for the waitlist. You may
                  not use automated systems to sign up multiple times or abuse our services in any way.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">6. Limitation of Liability</h2>
                <p className="text-zinc-400 leading-relaxed">
                  To the maximum extent permitted by law, Trading Command Center and its operators
                  shall not be liable for any indirect, incidental, special, consequential, or
                  punitive damages resulting from your use of or inability to use the service.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">7. Changes to Terms</h2>
                <p className="text-zinc-400 leading-relaxed">
                  We reserve the right to modify these terms at any time. If we make material changes,
                  we will notify you by email or by posting a notice on our website.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">8. Contact</h2>
                <p className="text-zinc-400 leading-relaxed">
                  If you have any questions about these terms, please contact us at:{" "}
                  <a
                    href="mailto:support@tradingcommandcenter.com"
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    support@tradingcommandcenter.com
                  </a>
                </p>
              </section>
            </div>

            <div className="mt-12 pt-8 border-t border-white/[0.08]">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative py-8 border-t border-white/[0.08]">
        <div className="container mx-auto px-4 text-center text-sm text-zinc-500">
          <p>Trading Command Center</p>
        </div>
      </footer>
    </div>
  );
}
