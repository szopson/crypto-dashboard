/**
 * GET /api/crypto-pulse
 *
 * Returns a server-side aggregated snapshot of crypto derivatives metrics
 * (Coinglass v4): funding, OI, ETF flows, positioning, liquidations.
 *
 * Cached for 60s per request via `next: { revalidate }`. The actual key
 * (COINGLASS_API_KEY) never reaches the client.
 */
import { NextResponse } from "next/server";
import { fetchCryptoPulse, resolveCoinglassKey } from "@/lib/coinglass";

// Allow caching at the edge for a minute to absorb refresh storms.
export const revalidate = 60;

export async function GET() {
  try {
    const snapshot = await fetchCryptoPulse();
    // TEMP diagnostic: names only (never values) of env vars containing
    // "coinglass", whether the resolver found a usable key, and a single probe
    // call to Coinglass reporting HTTP status + API code (distinguishes
    // invalid/IP-restricted key from network issues). Remove once data flows.
    const key = resolveCoinglassKey();
    let probe: Record<string, unknown> = { skipped: !key };
    if (key) {
      try {
        const r = await fetch(
          "https://open-api-v4.coinglass.com/api/futures/coins-markets",
          { headers: { "CG-API-KEY": key }, cache: "no-store" },
        );
        const j = (await r.json().catch(() => ({}))) as { code?: unknown; msg?: unknown };
        probe = { http: r.status, code: j.code ?? null, msg: j.msg ?? null, key_len: key.length };
      } catch (err) {
        probe = { error: String(err).slice(0, 200), key_len: key.length };
      }
    }
    const withDiag = {
      ...snapshot,
      key_present: !!key,
      coinglass_env_keys: Object.keys(process.env).filter((k) => /coinglass/i.test(k)),
      cg_probe: probe,
    };
    return NextResponse.json(withDiag, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch crypto pulse", detail: String(e) },
      { status: 500 },
    );
  }
}
