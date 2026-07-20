"use client";

/**
 * Share the portfolio page as a branded PNG — same pattern as the
 * trade-review ShareScorecardButton: native share sheet on mobile,
 * copy + download on desktop, PostHog-tracked.
 */
import { useRef, useState } from "react";
import { Share2, Copy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { renderPortfolioImage } from "@/lib/portfolio-image";
import { analytics } from "@/components/PostHogProvider";

export function SharePortfolioButton() {
  const [busy, setBusy] = useState<"share" | "copy" | "download" | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const { addToast } = useToast();

  const getBlob = async (): Promise<Blob> => {
    if (!blobRef.current) {
      blobRef.current = await renderPortfolioImage();
    }
    return blobRef.current;
  };

  const track = (method: string) => analytics.trackPortfolioShare(method);

  const nativeShare = async () => {
    setBusy("share");
    try {
      const blob = await getBlob();
      const file = new File([blob], "follio-portfolio.png", {
        type: "image/png",
      });
      await navigator.share({
        files: [file],
        title: "Altcoin Utility Season Portfolio — Follio",
        text: "My altcoin allocation, published for transparency — not advice. follio.io/portfolio",
      });
      track("native");
    } catch (e) {
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
      addToast("Copy not supported here — use PNG", "error");
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
      link.download = "follio-portfolio.png";
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
        <Button variant="outline" size="sm" onClick={nativeShare} disabled={busy !== null}>
          {busy === "share" ? spinner : <Share2 className="size-4" />} Share
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={copyImage} disabled={busy !== null}>
        {busy === "copy" ? spinner : <Copy className="size-4" />} Copy image
      </Button>
      <Button variant="outline" size="sm" onClick={downloadImage} disabled={busy !== null}>
        {busy === "download" ? spinner : <Download className="size-4" />} PNG
      </Button>
    </div>
  );
}
