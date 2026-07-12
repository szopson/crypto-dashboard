"""
Region resolution for affiliate compliance gating (GET /api/region).

Resolves the client's country from GeoLite2-Country and returns it ONLY when
it is one of the configured restricted regions; everything else — an
unrestricted country, a private/unparseable IP, a missing or stale database,
a suspicious forwarded chain — resolves to {"region": null} and the frontend
fails closed (see frontend/src/lib/affiliate.ts).

Trust model: the engine is reachable only from the traefik-public docker
network, and Traefik (with default forwarded-header handling) discards
client-supplied X-Forwarded-For and sets its own single entry. More than one
public hop in the chain therefore indicates a header-trust misconfiguration
upstream and is treated as unknown.

Privacy: raw client IPs / X-Forwarded-For values are NEVER logged — only
reason codes. GeoLite2 data courtesy of MaxMind (attribution required by the
GeoLite EULA; DB must be kept under 30 days old — geoipupdate refreshes it).
"""
import ipaddress
import threading
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Request, Response
from loguru import logger

from config import settings

try:
    import geoip2.database
    import geoip2.errors
    GEOIP2_AVAILABLE = True
except ImportError:  # keeps the engine importable before the dep is installed
    GEOIP2_AVAILABLE = False

router = APIRouter(prefix="/region", tags=["region"])

_reader_lock = threading.Lock()
_reader = None
_reader_mtime: Optional[float] = None


def _get_reader():
    """Module-cached GeoIP reader, reopened when geoipupdate swaps the file."""
    global _reader, _reader_mtime
    if not GEOIP2_AVAILABLE:
        return None
    path = Path(settings.geoip_db_path)
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return None
    with _reader_lock:
        if _reader is None or _reader_mtime != mtime:
            try:
                if _reader is not None:
                    _reader.close()
                _reader = geoip2.database.Reader(str(path))
                _reader_mtime = mtime
            except Exception as e:
                logger.warning(f"GeoIP reader unavailable: {type(e).__name__}")
                _reader = None
                _reader_mtime = None
        return _reader


def geoip_db_age_days() -> Optional[float]:
    """Age of the GeoIP DB file in days, or None when it doesn't exist."""
    try:
        mtime = Path(settings.geoip_db_path).stat().st_mtime
    except OSError:
        return None
    return (time.time() - mtime) / 86400


def extract_client_ip(xff: Optional[str]) -> tuple[Optional[ipaddress.IPv4Address], str]:
    """
    Parse X-Forwarded-For into a usable public client IP, or (None, reason).

    Returns the RIGHTMOST entry (appended by the trusted Traefik hop). Fails
    closed on: missing header, unparseable entries, more than one public hop
    (spoof/misconfig indicator), and private/reserved/loopback addresses.
    IPv4-mapped IPv6 addresses are unwrapped before classification.
    """
    if not xff:
        return None, "no_forwarded_header"
    entries = [e.strip() for e in xff.split(",") if e.strip()]
    if not entries:
        return None, "empty_forwarded_header"
    parsed = []
    for entry in entries:
        try:
            ip = ipaddress.ip_address(entry)
        except ValueError:
            return None, "unparseable_entry"
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        parsed.append(ip)
    public = [ip for ip in parsed if ip.is_global]
    if len(public) > 1:
        # Traefik sets a single entry; multiple public hops means forwarded
        # headers are being trusted from clients somewhere upstream.
        return None, "multiple_public_hops"
    candidate = parsed[-1]
    if not candidate.is_global:
        return None, "non_public_ip"
    return candidate, "ok"


def region_for_ip(ip) -> tuple[Optional[str], bool]:
    """
    (restricted-region code or None, resolved) for the IP.

    `resolved=True` means GeoIP POSITIVELY identified the country — so
    (None, True) is a verified-unrestricted verdict, while (None, False)
    means unknown and the frontend must keep failing closed.
    """
    reader = _get_reader()
    if reader is None:
        return None, False
    try:
        code = reader.country(str(ip)).country.iso_code
    except geoip2.errors.AddressNotFoundError:
        return None, False
    except Exception as e:
        logger.warning(f"GeoIP lookup failed: {type(e).__name__}")
        return None, False
    if not code:
        return None, False
    code = code.upper()
    if code in settings.restricted_regions_set:
        return code, True
    return None, True


@router.get("")
async def get_region(request: Request, response: Response):
    """
    Client's region verdict for CTA gating.

    {"region": "US", "resolved": true}  → restricted region, gate those venues
    {"region": null, "resolved": true}  → verified unrestricted, show all
    {"region": null, "resolved": false} → unknown, frontend fails closed

    Residual risk (accepted): the backend shares the traefik-public network,
    so another container could call it directly with a forged X-Forwarded-For.
    The verdict only shapes the FORGER'S OWN response (no-store, per-request),
    so there is nothing to poison; isolating the engine on an internal network
    would remove even that.
    """
    response.headers["Cache-Control"] = "no-store"
    ip, reason = extract_client_ip(request.headers.get("x-forwarded-for"))
    if ip is None:
        logger.debug(f"region: unresolved ({reason})")
        return {"region": None, "resolved": False}
    region, resolved = region_for_ip(ip)
    return {"region": region, "resolved": resolved}
