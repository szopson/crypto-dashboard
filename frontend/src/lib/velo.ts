/**
 * Server-only Velo (velodata.app) client.
 *
 * Adds the one signal Coinglass doesn't surface directly: the BTC funding
 * spread between Binance (institutional venue) and Hyperliquid (retail/degen
 * venue). A wide spread = venue divergence worth an execution edge.
 *
 * Unit calibration (verified empirically against Coinglass, 2026-07-08):
 * Velo's `funding_rate` column is a DECIMAL FRACTION normalized to an
 * 8h-equivalent across venues (Hyperliquid's hourly funding comes pre-scaled
 * ×8). Multiply by 100 to get the %/8h convention used across the cockpit.
 *
 * API shape: Basic auth ("api:" + key), CSV rows
 *   exchange,coin,product,time,funding_rate
 * sampled per-minute regardless of the requested resolution — so we fetch
 * three narrow windows (now / 1h ago / 24h ago) instead of a heavy 24h dump.
 *
 * VELO_API_KEY must never reach the client; server-only module. Fetches are
 * revalidate-tagged (never no-store) — a no-store fetch would throw the Next
 * "Dynamic server usage" bailout during ISR rendering of the consumers.
 */
import "server-only";

const BASE = "https://api.velodata.app/api/v1";

/** Resolve the Velo API key tolerantly (VELO_API_KEY, VELO_API, VELO, ...). */
export function resolveVeloKey(): string | undefined {
  const direct = process.env.VELO_API_KEY?.trim();
  if (direct) return direct;
  for (const [k, v] of Object.entries(process.env)) {
    if (/^velo/i.test(k) && v && /^[a-f0-9]{32}$/i.test(v.trim())) return v.trim();
  }
  return undefined;
}

export interface VeloFundingSpread {
  /** %/8h, Coinglass display convention */
  binance_pct_8h: number | null;
  hyperliquid_pct_8h: number | null;
  /** binance − hyperliquid, %/8h; positive = Binance longs paying more */
  spread_pct_8h: number | null;
  spread_1h_ago_pct_8h: number | null;
  spread_24h_ago_pct_8h: number | null;
  source: "velo";
}

/** Latest funding fraction per venue within a CSV window. */
function parseLatestPerVenue(csv: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of csv.trim().split("\n").slice(1)) {
    const [exchange, , , , rate] = line.split(",");
    const n = Number(rate);
    if (exchange && Number.isFinite(n)) out[exchange] = n; // rows are time-ascending
  }
  return out;
}

async function veloWindow(key: string, beginMs: number, endMs: number): Promise<Record<string, number> | null> {
  const params = new URLSearchParams({
    type: "futures",
    exchanges: "binance-futures,hyperliquid",
    products: "BTCUSDT,BTC-USD",
    columns: "funding_rate",
    begin: String(beginMs),
    end: String(endMs),
    resolution: "1m",
  });
  try {
    const res = await fetch(`${BASE}/rows?${params}`, {
      headers: { Authorization: `Basic ${Buffer.from(`api:${key}`).toString("base64")}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return parseLatestPerVenue(await res.text());
  } catch {
    return null;
  }
}

const toPct = (frac: number | undefined): number | null => (frac == null ? null : frac * 100);
const diff = (a: number | undefined, b: number | undefined): number | null =>
  a == null || b == null ? null : (a - b) * 100;

export async function fetchVeloFundingSpread(): Promise<VeloFundingSpread | null> {
  const key = resolveVeloKey();
  if (!key) return null;

  const now = Date.now();
  const MIN = 60_000;
  const [cur, h1, h24] = await Promise.all([
    veloWindow(key, now - 15 * MIN, now),
    veloWindow(key, now - 65 * MIN, now - 55 * MIN),
    veloWindow(key, now - (24 * 60 + 5) * MIN, now - (24 * 60 - 5) * MIN),
  ]);
  if (!cur) return null;

  const bin = cur["binance-futures"];
  const hl = cur["hyperliquid"];
  return {
    binance_pct_8h: toPct(bin),
    hyperliquid_pct_8h: toPct(hl),
    spread_pct_8h: diff(bin, hl),
    spread_1h_ago_pct_8h: h1 ? diff(h1["binance-futures"], h1["hyperliquid"]) : null,
    spread_24h_ago_pct_8h: h24 ? diff(h24["binance-futures"], h24["hyperliquid"]) : null,
    source: "velo",
  };
}
