import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Follio",
  description: "Privacy policy for Follio waitlist and services.",
};

export default function PrivacyPage() {
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
            Follio
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">
              Privacy Policy
            </h1>

            <div className="prose prose-invert prose-zinc max-w-none space-y-8">
              <p className="text-zinc-400 text-lg">
                Last updated: February 2026
              </p>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">1. Information We Collect</h2>
                <p className="text-zinc-400 leading-relaxed">
                  When you sign up for our waitlist, we collect the following information:
                </p>
                <ul className="list-disc list-inside text-zinc-400 space-y-2">
                  <li>Your email address (required)</li>
                  <li>Your area of interest in our product (optional)</li>
                  <li>Timestamp of when you signed up</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">2. How We Use Your Information</h2>
                <p className="text-zinc-400 leading-relaxed">
                  We use your email address to:
                </p>
                <ul className="list-disc list-inside text-zinc-400 space-y-2">
                  <li>Send you early access information when we launch</li>
                  <li>Deliver the free AI investment report you requested</li>
                  <li>Occasionally send product updates (no more than once per month)</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">3. Data Sharing</h2>
                <p className="text-zinc-400 leading-relaxed">
                  We do not sell, trade, or share your personal information with third parties.
                  Your email is stored securely and is only accessible to our team.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">4. Data Security</h2>
                <p className="text-zinc-400 leading-relaxed">
                  We implement appropriate security measures to protect your personal information.
                  Your data is stored on secure servers with encryption at rest.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">5. Your Rights</h2>
                <p className="text-zinc-400 leading-relaxed">
                  You have the right to:
                </p>
                <ul className="list-disc list-inside text-zinc-400 space-y-2">
                  <li>Request access to your data</li>
                  <li>Request deletion of your data</li>
                  <li>Unsubscribe from our communications at any time</li>
                </ul>
                <p className="text-zinc-400 leading-relaxed">
                  To exercise any of these rights, please contact us at the email address below.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">6. Analytics</h2>
                <p className="text-zinc-400 leading-relaxed">
                  We use privacy-friendly analytics to understand how visitors use our website.
                  We do not use cookies for tracking, and all analytics data is aggregated and anonymized.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">7. Contact</h2>
                <p className="text-zinc-400 leading-relaxed">
                  If you have any questions about this privacy policy or your data,
                  please contact us at:{" "}
                  <a
                    href="mailto:privacy@tradingcommandcenter.com"
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    privacy@tradingcommandcenter.com
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
          <p>Follio</p>
        </div>
      </footer>
    </div>
  );
}
