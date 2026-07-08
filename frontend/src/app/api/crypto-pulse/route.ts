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
    // TEMP diagnostic (boolean only, no fetch — ISR-safe). Root cause of the
    // earlier zeros was `cache: "no-store"` fetches breaking ISR rendering;
    // fixed in lib/coinglass.ts. Remove once prod data is confirmed flowing.
    const withDiag = { ...snapshot, key_present: !!resolveCoinglassKey() };
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
