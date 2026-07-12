# Task: server-side GeoIP region gating behind Traefik

Status: implemented (2026-07-12). Remaining manual steps: create a MaxMind
account (GeoLite2), add `GEOIPUPDATE_ACCOUNT_ID` + `GEOIPUPDATE_LICENSE_KEY`
GitHub secrets, deploy, then run the verification below (US VPN + spoof test).
Until then `/api/region` returns null and gating falls back to the timezone
heuristic (fail-closed either way).

## Why

Region gating for affiliate CTAs is currently a client-side timezone heuristic
(`frontend/src/lib/region.ts`, shipped in 9782cc5). It fails closed, but
VPNs/wrong clocks defeat detection. This task adds an authoritative-ish
server-side GeoIP signal. Framing (per GeoLite terms): this is **risk
reduction, not compliance enforcement** — residual VPN/proxy risk should be
accepted explicitly or paired with account-level country data later.

## Design

**The endpoint lives in FastAPI (engine), not Next.** `/api/*` already routes
to the engine (Traefik `PathPrefix(/api)`, priority 2), so no compose label
changes; secrets infra (`engine/.env`) already exists; use the official
`geoip2` Python package with a module-cached reader (re-open on mtime change).

1. **GeoIP data** — MaxMind **GeoLite2-Country** via the official
   `ghcr.io/maxmind/geoipupdate` sidecar in `docker-compose.yml` — **pin the
   image version** (e.g. v7.x). Env: `GEOIPUPDATE_ACCOUNT_ID`,
   `GEOIPUPDATE_LICENSE_KEY`, `GEOIPUPDATE_EDITION_IDS=GeoLite2-Country`,
   `GEOIPUPDATE_FREQUENCY=72`. Shared named volume mounted **read-only** into
   the engine container at `/geoip`.
2. **Endpoint** `GET /api/region` (no-store) — resolve client IP → country.
   Client IP: run uvicorn with proxy headers enabled and trust only the
   Traefik hop; treat private/reserved/unparseable IPs, reader failure, or
   suspicious multi-hop public XFF as `null` (unknown → frontend fails
   closed). Response: `{ "region": "US" | null }` — return a code **only when
   it appears in the union of registry `restrictedRegions`**, otherwise null
   (limits GeoLite-derived data exposure; add MaxMind attribution to legal
   notices — EULA requires attribution and data ≤ 30 days old).
3. **Header trust verification** — the Traefik instance is managed outside
   this repo: verify `forwardedHeaders` config (no client-trusted IPs,
   `insecure=false`) and run a spoof test — `curl -H "X-Forwarded-For:
   8.8.8.8"` from outside must NOT change the verdict.
4. **Degraded mode** — sidecar healthcheck on a readable non-empty MMDB;
   engine starts fine without the DB and returns `null` (fail closed
   downstream); log DB build epoch at startup; alert (Telegram admin) when DB
   age > 14 days. **Never log raw client IPs/XFF** — reason codes only.
5. **Frontend integration** — small `useRegion()` hook with a module-level
   promise cache (many ExchangeCTA instances → exactly one fetch), 2s
   abortable timeout. Precedence: server verdict → timezone heuristic
   fallback → null. Pending keeps rendering nothing (unchanged).
6. **Secrets & deploy** — add `MAXMIND_*` secrets to the GH Actions deploy
   workflow (explicit upsert step — values documented in `engine/.env` alone
   don't reach the sidecar); post-deploy health assertion for `/api/region`.
   Reconcile `DEPLOYMENT.md` (still documents manual SSH/SCP; the actual ops
   model is workflow_dispatch-only).
7. **Tests** — engine unit tests for IP extraction/policy: IPv4, IPv6,
   IPv4-mapped IPv6, whitespace/multiple headers, private ranges,
   missing/corrupt DB, spoofed XFF. Frontend: hook dedup + fallback ordering.
8. **Docs** — update the exchange-registry entry in `CONTEXT.md` (server
   GeoIP = primary signal, timezone = fallback) + MaxMind attribution.

## Verification

- `curl https://follio.io/api/region` from a US VPN → `{"region":"US"}`;
  from PL → `{"region":null}`; spoofed XFF from outside → unchanged verdict.
- Restricted venues absent from ExchangeCTA on a US VPN; present otherwise.
- geoipupdate volume populated and healthy, checked via a workflow_dispatch
  diagnostics job (no SSH from dev machines).

## Out of scope

Account/KYC-level country, MiCA/KNF legal sign-off of copy, moving Traefik
config into this repo.
