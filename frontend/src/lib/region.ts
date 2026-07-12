/**
 * Best-effort client-side region detection for affiliate compliance gating.
 *
 * This is a MITIGATION, not enforcement: it maps the browser's IANA timezone
 * to a country code for the regions we actually restrict (currently only US).
 * VPNs, wrong system clocks, and unlisted zones defeat it — the ranking layer
 * compensates by failing CLOSED on unknown regions (see affiliate.ts). Proper
 * enforcement needs server-side GeoIP behind Traefik's trusted client IP.
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
