"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INTERESTS = [
  { value: "radar", label: "RADAR Analysis" },
  { value: "reports", label: "AI Investment Reports" },
  { value: "alerts", label: "Smart Alerts" },
  { value: "journal", label: "Trade Journal" },
  { value: "all", label: "All Features" },
];

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, interest: interest || null }),
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
      <Button
        type="submit"
        size="lg"
        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white border-0"
        disabled={loading || !email}
      >
        {loading ? "Joining..." : "Get Early Access"}
      </Button>
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      <p className="text-xs text-zinc-500 text-center">
        No spam. We'll only contact you about early access and updates.
      </p>
    </form>
  );
}
