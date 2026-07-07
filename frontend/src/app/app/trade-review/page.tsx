"use client";

/**
 * /app/trade-review — "Analiza zagrania"
 *
 * Upload a trade screenshot, get a decision-quality scorecard. Crypto-first: the
 * backend enriches the review with live Coinglass derivatives context.
 */
import { useCallback, useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { TradeScorecard } from "@/components/research/TradeScorecard";
import type { TradeReviewResult } from "@/lib/trade-review";

const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_BYTES = 6 * 1024 * 1024;

export default function TradeReviewPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TradeReviewResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback((f: File | undefined | null) => {
    setError(null);
    setResult(null);
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      setError("Nieobsługiwany format. Użyj PNG, JPEG, GIF lub WebP.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Obraz jest za duży (max 6MB).");
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
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Nie udało się odczytać pliku."));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1];
      const res = await fetch("/api/trade-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64,
          media_type: file.type,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analiza nie powiodła się.");
      setResult(json as TradeReviewResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analiza nie powiodła się.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Analiza zagrania</h1>
        <p className="text-sm text-muted-foreground">
          Wrzuć screenshot zagrania — dostaniesz ocenę jakości decyzji, nie wyniku.
          Bez sygnałów kup/sprzedaj. Krypto wzbogacane o kontekst Coinglass.
        </p>
      </header>

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
                alt="Podgląd zagrania"
                className="w-full rounded-md border"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={reset}
                aria-label="Usuń obraz"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed py-10 text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              <Upload className="size-6" />
              <span className="text-sm">
                Przeciągnij screenshot albo kliknij, aby wybrać
              </span>
              <span className="text-xs">PNG, JPEG, GIF, WebP — do 6MB</span>
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
        placeholder="Opcjonalnie: twoja teza, plan, emocje w trakcie zagrania…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        maxLength={2000}
      />

      <Button
        onClick={analyze}
        disabled={!file || loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Analizuję zagranie…
          </>
        ) : (
          "Oceń zagranie"
        )}
      </Button>

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {result && <TradeScorecard data={result.scorecard} />}
    </div>
  );
}
