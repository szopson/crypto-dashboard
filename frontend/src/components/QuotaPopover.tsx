"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseClient } from "@/lib/supabase";
import {
  DAILY_QUOTAS,
  QUOTA_LABELS,
  utcDayKey,
  type QuotaColumn,
} from "@/config/quotas";

// Reads the user's own ai_setup_usage row via supabase-js (select-own RLS
// from migration 0002) — no engine route, no Traefik rule needed. An absent
// row for today simply means nothing consumed yet (0 used).
type Usage = Record<QuotaColumn, number>;

const ZERO_USAGE: Usage = {
  generations: 0,
  chat_messages: 0,
  trade_reviews: 0,
  insights: 0,
};

export function QuotaPopover() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<Usage>(ZERO_USAGE);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const fetchUsage = useCallback(async () => {
    if (!user) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("ai_setup_usage")
        .select("generations, chat_messages, trade_reviews, insights")
        .eq("user_id", user.id)
        .eq("day", utcDayKey())
        .maybeSingle();
      if (error) throw error;
      setUsage({
        generations: data?.generations ?? 0,
        chat_messages: data?.chat_messages ?? 0,
        trade_reviews: data?.trade_reviews ?? 0,
        insights: data?.insights ?? 0,
      });
      setLoaded(true);
    } catch {
      // Table missing or transient error — leave zeros, popover still opens.
      setLoaded(true);
    }
  }, [user]);

  // Refetch on open so the counters reflect consumption since the last look.
  useEffect(() => {
    if (open) fetchUsage();
  }, [open, fetchUsage]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const columns = Object.keys(DAILY_QUOTAS) as QuotaColumn[];

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="outline"
        size="sm"
        className="h-9 px-2"
        onClick={() => setOpen((v) => !v)}
        aria-label="Daily AI quota"
        aria-expanded={open}
      >
        <Gauge className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-(--glass-border) bg-background/95 backdrop-blur-md p-3 shadow-lg z-50">
          <p className="text-xs font-medium mb-2">Daily AI usage</p>
          <div className="space-y-2">
            {columns.map((col) => {
              const used = usage[col];
              const limit = DAILY_QUOTAS[col];
              const pct = Math.min(100, (used / limit) * 100);
              return (
                <div key={col}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">{QUOTA_LABELS[col]}</span>
                    <span className="font-mono">
                      {loaded ? used : "…"}/{limit}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Resets at 00:00 UTC.
          </p>
        </div>
      )}
    </div>
  );
}
