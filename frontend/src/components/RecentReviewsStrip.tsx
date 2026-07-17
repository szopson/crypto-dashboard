"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScanSearch } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listTradeReviews, type SavedTradeReview } from "@/lib/trade-journal";

// Last few decision-quality scorecards inline in the journal — closes the
// loop between "what I traded" and "how well I decided". RLS scopes rows to
// the signed-in user; anonymous renders nothing.
export function RecentReviewsStrip() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<SavedTradeReview[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listTradeReviews(3)
      .then((rows) => {
        if (!cancelled) setReviews(rows);
      })
      .catch(() => {
        // Journal not provisioned / transient error — strip just stays hidden.
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || reviews.length === 0) return null;

  const scoreColor = (score: number | null) => {
    if (score == null) return "text-muted-foreground";
    if (score >= 70) return "text-emerald-500";
    if (score >= 40) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="rounded-lg border border-(--glass-border) p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <ScanSearch className="size-4 text-primary" /> Recent trade reviews
        </p>
        <Link
          href="/app/trade-review"
          className="text-xs text-primary hover:underline"
        >
          All reviews →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {reviews.map((r) => (
          <Link
            key={r.id}
            href="/app/trade-review"
            className="rounded-lg border border-(--glass-border) p-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">
                {r.symbol || "Trade"}
              </span>
              <span className={`font-mono font-semibold ${scoreColor(r.process_score)}`}>
                {r.process_score ?? "—"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(r.created_at).toLocaleDateString()} · process score
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
