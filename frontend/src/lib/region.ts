/**
 * Region resolution for affiliate compliance gating.
 *
 * Primary signal: the engine's GeoIP verdict (`GET /api/region`, GeoLite2
 * behind Traefik — see engine/api/region.py). Fallback: the browser-timezone
 * heuristic below. Signals are combined restrictively (server verdict first,
 * timezone when the server says unknown/fails), and the ranking layer fails
 * CLOSED on unknown regions (see affiliate.ts) — so every fallback step can
 * only hide venues, never expose a restricted one.
 */

/** IANA zones that resolve to the United States. Prefix entries (trailing "/")
 * cover multi-zone groups like America/Indiana/Indianapolis. */
const US_TIMEZONES = new Set([
  "America/New_York",
  "America/Detroit",
  "America/Chicago",
  "America/Menominee",
  "America/Denver",
  "America/Boise",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Juneau",
  "America/Sitka",
  "America/Metlakatla",
  "America/Yakutat",
  "America/Nome",
  "America/Adak",
  "Pacific/Honolulu",
  // Legacy aliases browsers may still report
  "US/Eastern",
  "US/Central",
  "US/Mountain",
  "US/Pacific",
  "US/Arizona",
  "US/Alaska",
  "US/Hawaii",
]);

const US_TIMEZONE_PREFIXES = ["America/Indiana/", "America/Kentucky/", "America/North_Dakota/"];

/**
 * Detect the user's region as an ISO-3166 alpha-2 code, or null when unknown.
 * Never throws — any Intl failure resolves to null (unknown).
 */
export function detectRegion(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return null;
    if (US_TIMEZONES.has(tz) || US_TIMEZONE_PREFIXES.some((p) => tz.startsWith(p))) {
      return "US";
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The gating decision consumed by affiliate ranking:
 * - known + region "US"  → gate venues restricted in US
 * - known + region null  → POSITIVELY verified unrestricted, show everything
 * - unknown              → ranking fails closed (hides all restricted venues)
 */
export type RegionDecision =
  | { kind: "known"; region: string | null }
  | { kind: "unknown" };

const UNKNOWN: RegionDecision = { kind: "unknown" };
const SERVER_REGION_TIMEOUT_MS = 2000;

async function fetchServerRegion(): Promise<{ region: string | null; resolved: boolean } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_REGION_TIMEOUT_MS);
  try {
    const res = await fetch("/api/region", { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { region?: string | null; resolved?: boolean };
    return {
      region: typeof data.region === "string" ? data.region.toUpperCase() : null,
      resolved: data.resolved === true,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Region can't change within a page lifetime — resolve once and share the
// promise across every caller (many ExchangeCTA instances → one request).
let decisionPromise: Promise<RegionDecision> | null = null;

/**
 * Combine signals RESTRICTIVELY: a restricted verdict from either source
 * wins; "known unrestricted" needs the server's positive verification; and
 * anything less resolves to unknown (which fails closed downstream).
 */
export function resolveRegion(): Promise<RegionDecision> {
  if (!decisionPromise) {
    decisionPromise = fetchServerRegion()
      .catch(() => null)
      .then((server): RegionDecision => {
        const tzRegion = detectRegion();
        if (server?.region) return { kind: "known", region: server.region };
        if (tzRegion) return { kind: "known", region: tzRegion };
        if (server?.resolved) return { kind: "known", region: null };
        return UNKNOWN;
      });
  }
  return decisionPromise;
}
