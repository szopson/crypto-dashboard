"use client";

/**
 * /app/trade-review — Trade Review
 *
 * Upload a trade screenshot, get a decision-quality scorecard. Crypto-first: the
 * backend enriches the review with live Coinglass derivatives context.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Loader2, X, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { TradeScorecard } from "@/components/research/TradeScorecard";
import { TradeReviewJournal } from "@/components/research/TradeReviewJournal";
import { TradeInsightsPanel } from "@/components/research/TradeInsightsPanel";
import { TradeReviewDemo } from "@/components/research/TradeReviewDemo";
import { useAuth } from "@/contexts/AuthContext";
import { saveTradeReview, JournalNotProvisionedError } from "@/lib/trade-journal";
import { ShareScorecardButton } from "@/components/ShareScorecardButton";
import type { TradeReviewResult } from "@/lib/trade-review";

const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_BYTES = 6 * 1024 * 1024;

// Context handoff from the journal's "Grade this trade" CTA (sessionStorage,
// not query params — trade numbers must not leak into URLs/history/analytics).
// Read once and cleared on mount so a reload shows no stale banner.
const PENDING_REVIEW_KEY = "follio-pending-review";

interface PendingReview {
  symbol: string;
  direction: string;
  entry: number;
  exit: number;
  pnl: number | null;
}

function readPendingReview(): PendingReview | null {
  try {
    const raw = sessionStorage.getItem(PENDING_REVIEW_KEY);
    sessionStorage.removeItem(PENDING_REVIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingReview>;
    if (
      typeof parsed.symbol !== "string" ||
      typeof parsed.entry !== "number" ||
      typeof parsed.exit !== "number"
    )
      return null;
    return parsed as PendingReview;
  } catch {
    return null;
  }
}

export default function TradeReviewPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TradeReviewResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, session } = useAuth();
  const [pending, setPending] = useState<PendingReview | null>(null);

  useEffect(() => {
    setPending(readPendingReview());
  }, []);

  // Tick an elapsed-seconds counter while analyzing so the wait feels bounded
  // (Opus 4.8 vision is ~20-40s; a silent spinner reads as "hung").
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [journalKey, setJournalKey] = useState(0);

  const accept = useCallback((f: File | undefined | null) => {
    setError(null);
    setResult(null);
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      setError("Unsupported format. Use PNG, JPEG, GIF or WebP.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Image is too large (max 6MB).");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setNotes("");
    setSaved(false);
    setSaveError(null);
  };

  const save = async () => {
    if (!result || !user) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveTradeReview({
        userId: user.id,
        scorecard: result.scorecard,
        notes: notes.trim() || undefined,
      });
      setSaved(true);
      setJournalKey((k) => k + 1);
    } catch (e) {
      setSaveError(
        e instanceof JournalNotProvisionedError
          ? "The journal is not set up yet (Supabase migration not applied)."
          : e instanceof Error
            ? e.message
            : "Failed to save.",
      );
    } finally {
      setSaving(false);
    }
  };

  const analyze = async () => {
    if (!file || !session?.access_token) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read the file."));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1];
      const res = await fetch("/api/trade-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          image_base64: base64,
          media_type: file.type,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        throw new Error("Your session expired — sign in again to review trades.");
      }
      if (!res.ok) throw new Error(json.error || "Analysis failed.");
      setResult(json as TradeReviewResult);
      if (typeof json.remaining_reviews === "number") {
        setRemaining(json.remaining_reviews);
      }
      setSaved(false);
      setSaveError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-2xl overflow-x-clip px-4 py-8 space-y-6">
      {/* Decorative accent glows behind the content */}
      <div aria-hidden className="glow-blob -z-10 -top-24 -right-24 h-72 w-72 bg-emerald-500/20 animate-pulse-glow" />
      <div aria-hidden className="glow-blob -z-10 top-1/3 -left-32 h-80 w-80 bg-violet-500/15" />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Trade Review</h1>
        <p className="text-sm text-muted-foreground">
          Upload a trade screenshot — get a decision-quality score, not an outcome
          grade. No buy/sell signals. Crypto trades are enriched with live Coinglass
          context.
        </p>
      </header>

      {!user ? (
        <TradeReviewDemo />
      ) : (
        <>
      {/* Context from the journal's "Grade this trade" handoff */}
      {pending && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
          <p className="font-medium">
            Grading: {pending.symbol} {pending.direction?.toLowerCase()}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Entry ${pending.entry.toLocaleString()} → exit ${pending.exit.toLocaleString()}
            {typeof pending.pnl === "number" &&
              ` · P&L ${pending.pnl >= 0 ? "+" : ""}$${pending.pnl.toFixed(2)}`}
            . Upload the screenshot of this trade below — the score grades the
            decision, not the outcome.
          </p>
        </div>
      )}

      {/* Dropzone */}
      <Card
        className={dragOver ? "border-primary ring-1 ring-primary" : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          accept(e.dataTransfer.files?.[0]);
        }}
      >
        <CardContent className="pt-6">
          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Trade preview"
                className="w-full rounded-md border"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={reset}
                aria-label="Remove image"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-(--glass-border) py-10 text-muted-foreground transition-all hover:border-emerald-500/40 hover:bg-muted/30 hover:shadow-[0_0_28px_-10px_var(--glow-emerald)]"
            >
              <Upload className="size-6" />
              <span className="text-sm">
                Drag a screenshot here or click to choose
              </span>
              <span className="text-xs">PNG, JPEG, GIF, WebP — up to 6MB</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED.join(",")}
            className="hidden"
            onChange={(e) => accept(e.target.files?.[0])}
          />
        </CardContent>
      </Card>

      <Textarea
        placeholder="Optional: your thesis, plan, emotions during the trade…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        maxLength={2000}
      />

      <Button
        onClick={analyze}
        disabled={!file || loading}
        variant="glow"
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Reviewing trade… {elapsed}s
          </>
        ) : (
          "Review trade"
        )}
      </Button>
      {loading && (
        <p className="-mt-2 text-center text-xs text-muted-foreground">
          Opus 4.8 reads the chart and pulls Coinglass context — usually 20–40s.
        </p>
      )}
      {!loading && remaining != null && (
        <p className="-mt-2 text-center text-xs text-muted-foreground">
          {remaining} review{remaining === 1 ? "" : "s"} left today — resets 00:00 UTC.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <TradeScorecard data={result.scorecard} />

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant={saved ? "secondary" : "default"}
              onClick={save}
              disabled={saving || saved}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : saved ? (
                <>
                  <Check className="size-4" /> Saved to journal
                </>
              ) : (
                <>
                  <Save className="size-4" /> Save to journal
                </>
              )}
            </Button>
            <ShareScorecardButton
              scorecard={result.scorecard}
              surface="trade-review-result"
            />
          </div>
          {saveError && (
            <p className="text-sm text-red-500" role="alert">
              {saveError}
            </p>
          )}
        </div>
      )}
        </>
      )}

      {user && <TradeReviewJournal refreshKey={journalKey} />}
      {user && <TradeInsightsPanel refreshKey={journalKey} />}
    </div>
  );
}
