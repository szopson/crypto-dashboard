"use client";

import { useState, useRef, useEffect } from "react";

// Turnstile types
declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

const INTERESTS = [
  { value: "radar", label: "RADAR Analysis" },
  { value: "reports", label: "AI Investment Reports" },
  { value: "alerts", label: "Smart Alerts" },
  { value: "journal", label: "Trade Journal" },
  { value: "all", label: "All Features" },
];

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);

  // Load Turnstile script and render widget
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || typeof window === "undefined") return;

    const scriptId = "turnstile-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const renderWidget = () => {
      if (turnstileRef.current && window.turnstile) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(null),
          theme: "dark",
        });
      }
    };

    // Wait for script to load
    const checkTurnstile = setInterval(() => {
      if (window.turnstile) {
        clearInterval(checkTurnstile);
        renderWidget();
      }
    }, 100);

    return () => clearInterval(checkTurnstile);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          interest: interest || null,
          marketing_consent: consent,
          turnstile_token: turnstileToken,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setEmail("");
        setInterest("");
      } else {
        setError(data.message || "Something went wrong");
      }
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center backdrop-blur-sm">
        <div className="w-12 h-12 mx-auto mb-4 text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          You're on the list!
        </h3>
        <p className="text-zinc-400 mb-2">
          Check your inbox — we're sending your free altcoin investment report.
        </p>
        <p className="text-xs text-zinc-500">
          Don't see it? Check your spam folder.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1 h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
        />
        <Select value={interest} onValueChange={setInterest}>
          <SelectTrigger className="w-full sm:w-48 h-12 bg-white/[0.03] border-white/[0.08] text-white">
            <SelectValue placeholder="I'm interested in..." />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-white/[0.08]">
            {INTERESTS.map((item) => (
              <SelectItem key={item.value} value={item.value} className="text-white focus:bg-white/10">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* GDPR Consent Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/20 focus:ring-offset-0"
        />
        <span className="text-sm text-zinc-400 leading-relaxed">
          I agree to receive marketing emails and accept the{" "}
          <Link href="/terms" className="text-emerald-400 hover:text-emerald-300 underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300 underline">
            Privacy Policy
          </Link>
        </span>
      </label>

      {/* Turnstile Widget */}
      {TURNSTILE_SITE_KEY && (
        <div ref={turnstileRef} className="flex justify-center" />
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white border-0"
        disabled={loading || !email || !consent || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
      >
        {loading ? "Joining..." : "Get Early Access"}
      </Button>
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </form>
  );
}
