"""
Cockpit daily digest — content export for X / Telegram (Phase 3).

Once a day, take the derivatives cockpit state and turn it into a concise,
ready-to-post snapshot for perp traders (OI, funding, liquidations) with a soft
CTA back to the cockpit — the surface that carries the affiliate reflink.

Single source of truth: this reads the frontend's `/api/crypto-pulse` (where the
Coinglass key + 60s cache live) rather than re-aggregating in Python. The
affiliate reflink itself stays in the frontend registry; the digest funnels
traffic to `/cockpit` where that CTA renders — it does not build ref links here.

Human-in-loop: by default the digest is delivered to the Telegram admin chat as a
DRAFT for review, never auto-posted to a public channel. X has no wired
publishing integration, so its post is produced as a draft for manual posting.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import anthropic
import httpx
from loguru import logger

from config import settings
from services.telegram import get_telegram_service


# Persisted under ./data — mounted as a named volume in docker-compose so the
# digest survives container recreates on deploy (the container FS does not).
DIGEST_STATE_FILE = Path("./data/cockpit_digest_latest.json")


DIGEST_SYSTEM_PROMPT = """You write a once-daily crypto derivatives snapshot for \
high-fee-volume perpetual-futures traders. Audience is NOT retail beginners: no \
education, no hype, no emojis-as-decoration, no price predictions, no buy/sell \
signals.

Style:
- Terse, information-dense, factual. Think a sharp desk note.
- Lead with the single most notable deviation (funding flip, OI spike, \
liquidation cluster, funding dispersion across venues, positioning divergence).
- 3-5 short lines max, each a concrete datapoint with its number.
- Plain text suitable for X and Telegram. At most one tasteful emoji if it adds clarity.
- End with the provided soft CTA line VERBATIM on its own line.

You receive a JSON snapshot of derivatives metrics and a list of pre-computed \
deviations. Do not invent numbers; use only what is given."""


class CockpitDigestService:
    """Builds and delivers the daily cockpit digest."""

    def __init__(self):
        self.telegram = get_telegram_service()
        # Public URL — lands in the post's CTA link.
        self.base_url = settings.frontend_base_url.rstrip("/")
        # Internal URL — where we fetch the API from (docker network on the
        # VPS); falls back to the public URL for local/dev runs.
        self.internal_url = (settings.frontend_internal_url or settings.frontend_base_url).rstrip("/")
        self.model = settings.report_ai_model
        self._client: Optional[anthropic.Anthropic] = (
            anthropic.Anthropic(api_key=settings.anthropic_api_key)
            if settings.anthropic_api_key
            else None
        )

    @staticmethod
    def snapshot_has_data(snap: Optional[dict]) -> bool:
        """
        Guard against the all-zero snapshot the frontend caches when its
        Coinglass fetches fail (typically the first request after a container
        recreate — see the note in frontend/src/lib/coinglass.ts).
        """
        if not snap:
            return False
        return any((c.get("price") or 0) > 0 for c in snap.get("coins") or [])

    async def fetch_snapshot(self, retries: int = 2, wait_s: float = 75.0) -> Optional[dict]:
        """
        Fetch the shared derivatives snapshot from the frontend API.

        Retries past an empty (all-zero) snapshot: the route caches for 60s,
        so waiting >60s gives the frontend a fresh Coinglass pull.
        """
        url = f"{self.internal_url}/api/crypto-pulse"
        snap: Optional[dict] = None
        for attempt in range(retries + 1):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    snap = resp.json()
            except Exception as e:
                logger.error(f"Cockpit digest: failed to fetch {url}: {e}")
                snap = None
            if self.snapshot_has_data(snap):
                return snap
            if attempt < retries:
                logger.warning(
                    f"Cockpit digest: snapshot empty/all-zero — retrying in {wait_s:.0f}s"
                )
                await asyncio.sleep(wait_s)
        return snap

    def _cta(self) -> str:
        return f"Full derivatives cockpit → {self.base_url}/cockpit"

    def _fallback_post(self, snap: dict) -> str:
        """Deterministic post when the LLM is unavailable."""
        lines = ["BTC derivatives snapshot"]
        for d in (snap.get("deviations") or [])[:4]:
            lines.append(f"• {d.get('symbol', '')}: {d.get('headline', '')} — {d.get('detail', '')}")
        if len(lines) == 1:
            for s in (snap.get("signals") or [])[:4]:
                lines.append(f"• {s}")
        if len(lines) == 1:
            lines.append("• Funding, OI and positioning near baseline.")
        lines.append(self._cta())
        return "\n".join(lines)

    def build_post(self, snap: dict) -> str:
        """Compose the post via Claude, falling back to a deterministic summary."""
        if not self._client:
            return self._fallback_post(snap)

        cta = self._cta()
        # Trim the snapshot to what matters for the post.
        payload = {
            "generated_at": snap.get("generated_at"),
            "coins": snap.get("coins"),
            "funding_aggregate": snap.get("funding_aggregate"),
            "etf": snap.get("etf"),
            "positioning": snap.get("positioning"),
            "deviations": snap.get("deviations"),
        }
        user_message = (
            f"Snapshot JSON:\n{payload}\n\n"
            f"Write today's digest. Use the soft CTA line verbatim as the last line:\n{cta}"
        )
        try:
            message = self._client.messages.create(
                model=self.model,
                max_tokens=512,
                system=DIGEST_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
            text = message.content[0].text.strip()
            # Guarantee the CTA is present even if the model dropped it.
            if cta not in text:
                text = f"{text}\n{cta}"
            return text
        except Exception as e:
            logger.error(f"Cockpit digest: LLM failed, using fallback: {e}")
            return self._fallback_post(snap)

    def _web_body(self, post: str) -> str:
        """Digest body for the /cockpit strip — the CTA line points at the page
        the reader is already on, so it is dropped for the web surface."""
        cta = self._cta()
        return "\n".join(line for line in post.splitlines() if line.strip() != cta).strip()

    def save_latest(self, date: str, post: str) -> None:
        """Persist the latest digest so the frontend can render it on /cockpit."""
        try:
            DIGEST_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            DIGEST_STATE_FILE.write_text(
                json.dumps(
                    {
                        "date": date,
                        "generated_at": datetime.utcnow().isoformat() + "Z",
                        "post": post,
                        "web_body": self._web_body(post),
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
        except Exception as e:
            logger.error(f"Cockpit digest: failed to persist latest digest: {e}")

    @staticmethod
    def load_latest() -> Optional[dict]:
        """Read the persisted digest; None when nothing has been generated yet."""
        try:
            return json.loads(DIGEST_STATE_FILE.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return None
        except Exception as e:
            logger.error(f"Cockpit digest: failed to read persisted digest: {e}")
            return None

    async def generate_and_deliver(self, publish: bool = False) -> dict:
        """
        Build the digest and (optionally) deliver it as a Telegram DRAFT.

        Returns a dict with the draft text; `delivered` indicates whether the
        Telegram draft was sent. Never auto-posts to a public channel.
        """
        snap = await self.fetch_snapshot()
        if not snap:
            return {"success": False, "error": "snapshot unavailable"}
        if not self.snapshot_has_data(snap):
            # Keep the previous good digest rather than publishing a
            # "no data" note; the frontend hides anything older than 48h.
            return {"success": False, "error": "snapshot empty (all-zero)"}

        post = self.build_post(snap)
        date = datetime.utcnow().strftime("%Y-%m-%d")
        self.save_latest(date, post)
        result = {"success": True, "date": date, "post": post, "delivered": False}

        if publish and self.telegram.is_available():
            # Human-in-loop: send to the admin chat for review, not a public channel.
            admin = settings.telegram_admin_chat_id or settings.telegram_chat_id or None
            draft = (
                f"📝 *Cockpit digest — DRAFT ({date})*\n"
                f"_Review before posting to X / Telegram channel._\n\n"
                f"{post}"
            )
            send = await self.telegram.send_message(draft, chat_id=admin)
            result["delivered"] = bool(send.get("success"))
            if not send.get("success"):
                result["delivery_error"] = send.get("error")

        return result


_cockpit_digest_service: Optional[CockpitDigestService] = None


def get_cockpit_digest_service() -> CockpitDigestService:
    global _cockpit_digest_service
    if _cockpit_digest_service is None:
        _cockpit_digest_service = CockpitDigestService()
    return _cockpit_digest_service
