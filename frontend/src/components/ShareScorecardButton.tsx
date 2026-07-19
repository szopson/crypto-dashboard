"use client";

/**
 * Share a trade-review scorecard as a branded PNG — the acquisition wedge:
 * every shared card carries "AI grades your decision, not your PnL — follio.io"
 * into X/Discord feeds. Native share sheet on mobile, copy + download on
 * desktop. Each share method is tracked in PostHog to measure the loop.
 */
import { useRef, useState } from "react";
import { Share2, Copy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { renderScorecardImage } from "@/lib/scorecard-image";
import { analytics } from "@/components/PostHogProvider";
import type { TradeScorecard } from "@/lib/trade-review";

interface ShareScorecardButtonProps {
  scorecard: TradeScorecard;
  /** PostHog surface tag, e.g. "trade-review-result". */
  surface: string;
}

export function ShareScorecardButton({
  scorecard,
  surface,
}: ShareScorecardButtonProps) {
  const [busy, setBusy] = useState<"share" | "copy" | "download" | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const { addToast } = useToast();

  const getBlob = async (): Promise<Blob> => {
    if (!blobRef.current) {
      blobRef.current = await renderScorecardImage(scorecard);
    }
    return blobRef.current;
  };

  const track = (method: string) =>
    analytics.trackScorecardShare(method, scorecard.process_score, surface);

  const nativeShare = async () => {
    setBusy("share");
    try {
      const blob = await getBlob();
      const file = new File([blob], "follio-trade-review.png", {
        type: "image/png",
      });
      await navigator.share({
        files: [file],
        title: "Follio AI Trade Review",
        text: `My decision-quality score: ${scorecard.process_score}/100 — AI grades the process, not the PnL.`,
      });
      track("native");
    } catch (e) {
      // AbortError = user dismissed the sheet — not an error worth surfacing.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        addToast("Sharing failed", "error");
      }
    } finally {
      setBusy(null);
    }
  };

  const copyImage = async () => {
    setBusy("copy");
    try {
      const blob = await getBlob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      addToast("Image copied — paste it anywhere", "success");
      track("copy");
    } catch {
      addToast("Copy not supported here — use Download", "error");
    } finally {
      setBusy(null);
    }
  };

  const downloadImage = async () => {
    setBusy("download");
    try {
      const blob = await getBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "follio-trade-review.png";
      link.click();
      URL.revokeObjectURL(url);
      track("download");
    } catch {
      addToast("Export failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  const spinner = <Loader2 className="size-4 animate-spin" />;

  return (
    <div className="flex items-center gap-2">
      {canNativeShare && (
        <Button variant="outline" onClick={nativeShare} disabled={busy !== null}>
          {busy === "share" ? spinner : <Share2 className="size-4" />} Share
        </Button>
      )}
      <Button variant="outline" onClick={copyImage} disabled={busy !== null}>
        {busy === "copy" ? spinner : <Copy className="size-4" />} Copy image
      </Button>
      <Button variant="outline" onClick={downloadImage} disabled={busy !== null}>
        {busy === "download" ? spinner : <Download className="size-4" />} PNG
      </Button>
    </div>
  );
}
