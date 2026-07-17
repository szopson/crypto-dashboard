"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Position sizing from the user's OWN risk parameters — the user decides the
// trade; this only does the arithmetic. Linear USDT-perp math only (qty in
// coin, PnL linear in price); inverse contracts are out of scope.
const PREFS_KEY = "follio-risk-prefs";

// Input caps: reject absurd values instead of printing absurd outputs.
const MAX_ACCOUNT = 1_000_000_000;
const MAX_RISK_PCT = 15;
const MAX_PRICE = 100_000_000;
const MAX_LEVERAGE = 125;

export interface RiskSizerPrefill {
  entry: number;
  stopLoss: number;
}

interface RiskSizerProps {
  prefill?: RiskSizerPrefill | null;
}

interface RiskPrefs {
  accountSize: string;
  riskPct: string;
  leverage: string;
}

function loadPrefs(): RiskPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RiskPrefs>;
      return {
        accountSize: typeof parsed.accountSize === "string" ? parsed.accountSize : "",
        riskPct: typeof parsed.riskPct === "string" ? parsed.riskPct : "1",
        leverage: typeof parsed.leverage === "string" ? parsed.leverage : "1",
      };
    }
  } catch {
    // Corrupt/unavailable storage — fall through to defaults.
  }
  return { accountSize: "", riskPct: "1", leverage: "1" };
}

const fmtUsd = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function RiskSizer({ prefill }: RiskSizerProps) {
  const [accountSize, setAccountSize] = useState("");
  const [riskPct, setRiskPct] = useState("1");
  const [leverage, setLeverage] = useState("1");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");

  // Hydrate saved prefs on mount (client-only — avoids SSR/localStorage
  // mismatch by starting from defaults and filling in after hydration).
  useEffect(() => {
    const prefs = loadPrefs();
    setAccountSize(prefs.accountSize);
    setRiskPct(prefs.riskPct);
    setLeverage(prefs.leverage);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ accountSize, riskPct, leverage }),
      );
    } catch {
      // Best-effort persistence.
    }
  }, [accountSize, riskPct, leverage]);

  // Prefilled levels stay editable — the user owns the numbers.
  useEffect(() => {
    if (prefill) {
      setEntry(String(prefill.entry));
      setStopLoss(String(prefill.stopLoss));
    }
  }, [prefill]);

  const acc = parseFloat(accountSize);
  const risk = parseFloat(riskPct);
  const lev = parseFloat(leverage);
  const entryN = parseFloat(entry);
  const slN = parseFloat(stopLoss);

  const problems: string[] = [];
  const allFilled = [accountSize, riskPct, leverage, entry, stopLoss].every(
    (v) => v.trim() !== "",
  );
  if (allFilled) {
    if (!Number.isFinite(acc) || acc <= 0 || acc > MAX_ACCOUNT)
      problems.push(`Account size must be between 0 and ${fmtUsd(MAX_ACCOUNT)}.`);
    if (!Number.isFinite(risk) || risk <= 0 || risk > MAX_RISK_PCT)
      problems.push(`Risk per trade must be between 0 and ${MAX_RISK_PCT}%.`);
    if (!Number.isFinite(lev) || lev < 1 || lev > MAX_LEVERAGE)
      problems.push(`Leverage must be between 1 and ${MAX_LEVERAGE}.`);
    if (!Number.isFinite(entryN) || entryN <= 0 || entryN > MAX_PRICE)
      problems.push("Entry price must be a positive number.");
    if (!Number.isFinite(slN) || slN <= 0 || slN > MAX_PRICE)
      problems.push("Stop-loss must be a positive number.");
    if (
      Number.isFinite(entryN) &&
      Number.isFinite(slN) &&
      entryN > 0 &&
      slN > 0 &&
      entryN === slN
    )
      problems.push("Entry and stop-loss cannot be equal.");
  }

  const valid = allFilled && problems.length === 0;

  let qty = 0;
  let notional = 0;
  let margin = 0;
  if (valid) {
    const riskUsd = acc * (risk / 100);
    qty = riskUsd / Math.abs(entryN - slN);
    notional = qty * entryN;
    margin = notional / lev;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Risk Sizer</CardTitle>
        <p className="text-xs text-muted-foreground">
          Sizing from YOUR account and risk tolerance — not a recommendation.
          Linear USDT-perp contracts only.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rs-account" className="text-xs">Account (USDT)</Label>
            <Input
              id="rs-account"
              type="number"
              inputMode="decimal"
              placeholder="10000"
              value={accountSize}
              onChange={(e) => setAccountSize(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-risk" className="text-xs">Risk per trade (%)</Label>
            <Input
              id="rs-risk"
              type="number"
              inputMode="decimal"
              placeholder="1"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-lev" className="text-xs">Leverage</Label>
            <Input
              id="rs-lev"
              type="number"
              inputMode="decimal"
              placeholder="1"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-entry" className="text-xs">Entry price</Label>
            <Input
              id="rs-entry"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-sl" className="text-xs">Stop-loss (SS)</Label>
            <Input
              id="rs-sl"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
            />
          </div>
        </div>

        {allFilled && problems.length > 0 && (
          <ul className="text-xs text-destructive space-y-1">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}

        {valid && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-(--glass-border) p-3">
              <p className="text-xs text-muted-foreground mb-1">Quantity</p>
              <p className="font-mono font-semibold text-sm">
                {qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </p>
              <p className="text-[10px] text-muted-foreground">coin</p>
            </div>
            <div className="rounded-lg border border-(--glass-border) p-3">
              <p className="text-xs text-muted-foreground mb-1">Notional</p>
              <p className="font-mono font-semibold text-sm">${fmtUsd(notional)}</p>
              <p className="text-[10px] text-muted-foreground">qty × entry</p>
            </div>
            <div className="rounded-lg border border-(--glass-border) p-3">
              <p className="text-xs text-muted-foreground mb-1">Margin</p>
              <p className="font-mono font-semibold text-sm">${fmtUsd(margin)}</p>
              <p className="text-[10px] text-muted-foreground">at {lev}x</p>
            </div>
          </div>
        )}

        {valid && (
          <p className="text-xs text-muted-foreground">
            Risk if stopped: ${fmtUsd(acc * (risk / 100))}. Leverage changes the
            margin you post, not the stop-loss risk — that is set by position
            size and stop distance.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
